import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";
import { setCustomerSingletonsForTests } from "@/lib/implementation/customer/runtime";
import { createMemoryAuditStore } from "@/lib/implementation/internal/memory-audit-store";
import { createMemoryQueueStore } from "@/lib/implementation/internal/memory-queue-store";
import { createMemoryStaffStore } from "@/lib/implementation/internal/memory-staff-store";
import { setInternalSingletonsForTests } from "@/lib/implementation/internal/runtime";
import { createInternalSubmissionService } from "@/lib/implementation/internal/service";
import { createMemoryCredentialStore } from "@/lib/setup/credentials/memory-store";
import { createCredentialService } from "@/lib/setup/credentials/service";
import { setCredentialSingletonsForTests } from "@/lib/setup/credentials/runtime";
import type { InternalStaff } from "@/lib/implementation/internal/types";

const TEST_KEY = Buffer.alloc(32, 11).toString("base64");
const SECRET = "internal-reveal-secret-do-not-leak";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-clients", () => ({
  createSupabaseRouteClient: () => ({
    supabase: {
      auth: {
        getUser: authMocks.getUser,
      },
    },
    attachAuthCookies: (response: NextResponse) => response,
  }),
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: authMocks.getUser,
    },
  }),
}));

function staff(userId: string, role: InternalStaff["role"]): InternalStaff {
  return { userId, role, createdAt: "2026-09-04T12:00:00.000Z" };
}

async function seedQueue() {
  process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  const customerStore = createMemoryCustomerStore();
  const customer = createCustomerService(customerStore);
  const credentialStore = createMemoryCredentialStore();
  const queue = createMemoryQueueStore();
  const audit = createMemoryAuditStore();
  const staffStore = createMemoryStaffStore([
    staff("engineer-1", "engineer"),
    staff("viewer-1", "viewer"),
  ]);

  await customer.ensureForUser("user-1");
  await customer.saveProperty("user-1", {
    name: "Hotel Northgate",
    city: "Barcelona",
    country: "Spain",
    hotelBrand: "Northgate Hotels",
    contactName: "Priya Raman",
  });
  await customer.savePmsSelection("user-1", { pmsId: "mews", otherPmsName: "" });
  await customer.saveConnectDetails("user-1", { pmsAccessMethod: "api" });

  const credentialService = createCredentialService(credentialStore, customer);
  await credentialService.submit("user-1", {
    clientId: "id-northgate",
    clientSecret: SECRET,
    applicationKey: "app-northgate",
  });
  const context = await customer.submitSetup("user-1", "priya@northgatehotels.com");
  const row = await queue.insertFromCustomer!({
    implementationId: context.implementation.id,
    record: context.submission!.record,
    submittedAt: context.submission!.submittedAt,
  });
  const receipt = await credentialStore.findByImplementationId(context.implementation.id);
  queue.putReceipt({
    implementationId: context.implementation.id,
    receivedAt: receipt!.receivedAt,
  });

  setCustomerSingletonsForTests({ store: customerStore, service: customer });
  setCredentialSingletonsForTests({ store: credentialStore, service: credentialService });
  setInternalSingletonsForTests({
    staff: staffStore,
    queue,
    audit,
    credentials: credentialStore,
  });

  return { row, queue, audit, credentialStore, context, staffStore };
}

function asUser(id: string, email: string) {
  authMocks.getUser.mockResolvedValue({
    data: { user: { id, email } },
    error: null,
  });
}

describe("internal submissions authorization", () => {
  beforeEach(async () => {
    authMocks.getUser.mockReset();
    await seedQueue();
  });

  afterEach(() => {
    setCustomerSingletonsForTests({ store: null, service: null });
    setCredentialSingletonsForTests({ store: null, service: null });
    setInternalSingletonsForTests({
      staff: null,
      queue: null,
      audit: null,
      credentials: null,
      service: null,
    });
  });

  it("rejects unauthenticated list, detail, status, and credential retrieval", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { GET: listGet } = await import("@/app/api/implementation/submissions/route");
    const { GET: detailGet, PATCH } = await import("@/app/api/implementation/submissions/[id]/route");
    const { POST: reveal } = await import("@/app/api/implementation/submissions/[id]/credentials/route");
    const params = Promise.resolve({ id: "missing" });

    expect((await listGet(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(403);
    expect(
      (await detailGet(new NextRequest("http://localhost:3000/api/implementation/submissions/missing"), { params })).status,
    ).toBe(403);
    expect(
      (
        await PATCH(
          new NextRequest("http://localhost:3000/api/implementation/submissions/missing", {
            method: "PATCH",
            body: JSON.stringify({ status: "Under Review" }),
          }),
          { params },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await reveal(new NextRequest("http://localhost:3000/api/implementation/submissions/missing/credentials", {
          method: "POST",
        }), { params })
      ).status,
    ).toBe(403);
  });

  it("lets a customer use setup but not the internal queue or credential references", async () => {
    asUser("user-1", "priya@northgatehotels.com");
    const { GET: listGet } = await import("@/app/api/implementation/submissions/route");
    const { GET: setupContext } = await import("@/app/api/setup/context/route");
    const { GET: credStatus } = await import("@/app/api/setup/credentials/status/route");
    const listed = await listGet(new NextRequest("http://localhost:3000/api/implementation/submissions"));
    const context = await setupContext(new NextRequest("http://localhost:3000/api/setup/context"));
    const status = await credStatus(new NextRequest("http://localhost:3000/api/setup/credentials/status"));
    const listBody = await listed.json();
    const statusBody = await status.json();

    expect(listed.status).toBe(403);
    expect(JSON.stringify(listBody)).not.toContain(SECRET);
    expect(context.status).toBe(200);
    expect(status.status).toBe(200);
    expect(statusBody.credentialsReceived).toBe(true);
    expect(statusBody).not.toHaveProperty("clientSecret");
    expect(statusBody).not.toHaveProperty("envelope");
    expect(JSON.stringify(statusBody)).not.toContain(SECRET);
  });

  it("shows a submitted implementation in the internal queue without secrets", async () => {
    asUser("viewer-1", "viewer@bookmax.ai");
    const { GET } = await import("@/app/api/implementation/submissions/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/implementation/submissions"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0].organisation).toBe("Northgate Hotels");
    expect(body.submissions[0].credentials_status).toBe("received");
    expect(body.submissions[0].credential_type).toBe("API Credentials");
    expect(body.submissions[0].can_open_credentials).toBe(false);
    expect(body.submissions[0].can_update_status).toBe(false);
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain("envelope");
    expect(JSON.stringify(body)).not.toContain("clientSecret");
    expect(body.submissions[0]).not.toHaveProperty("clientId");
  });

  it("lets a viewer read metadata but not change status or retrieve secrets", async () => {
    asUser("viewer-1", "viewer@bookmax.ai");
    const seeded = await seedQueue();
    const { GET, PATCH } = await import("@/app/api/implementation/submissions/[id]/route");
    const { POST: reveal } = await import("@/app/api/implementation/submissions/[id]/credentials/route");
    const params = Promise.resolve({ id: seeded.row.id });

    const detail = await GET(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}`),
      { params },
    );
    const patched = await PATCH(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Under Review" }),
      }),
      { params },
    );
    const opened = await reveal(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}/credentials`, {
        method: "POST",
      }),
      { params },
    );

    expect(detail.status).toBe(200);
    expect((await detail.json()).submission.can_open_credentials).toBe(false);
    expect(patched.status).toBe(403);
    expect(opened.status).toBe(403);
    expect(JSON.stringify(await opened.json())).not.toContain(SECRET);
  });

  it("lets an engineer change status and persists it for a second service instance", async () => {
    const seeded = await seedQueue();
    asUser("engineer-1", "engineer@bookmax.ai");
    const { PATCH, GET } = await import("@/app/api/implementation/submissions/[id]/route");
    const params = Promise.resolve({ id: seeded.row.id });
    const patched = await PATCH(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Under Review" }),
      }),
      { params },
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).submission.status).toBe("Under Review");

    const second = createInternalSubmissionService({
      queue: seeded.queue,
      audit: seeded.audit,
      credentials: seeded.credentialStore,
    });
    const again = await second.get(staff("engineer-1", "engineer"), seeded.row.id);
    expect(again.status).toBe("Under Review");

    const events = await seeded.audit.listBySubmissionId(seeded.row.id);
    expect(events[0]?.eventType).toBe("status_changed");
    expect(events[0]?.metadata).toEqual({ from: "Submitted", to: "Under Review" });
    expect(JSON.stringify(events)).not.toContain(SECRET);

    const reread = await GET(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}`),
      { params },
    );
    expect((await reread.json()).submission.status).toBe("Under Review");
  });

  it("lets an engineer open the secure credential path, audits it, and keeps secrets off the log APIs", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const seeded = await seedQueue();
    asUser("engineer-1", "engineer@bookmax.ai");
    const { GET } = await import("@/app/api/implementation/submissions/[id]/route");
    const { GET: listGet } = await import("@/app/api/implementation/submissions/route");
    const { POST: reveal, GET: revealGet } = await import(
      "@/app/api/implementation/submissions/[id]/credentials/route"
    );
    const params = Promise.resolve({ id: seeded.row.id });

    const listed = await listGet(new NextRequest("http://localhost:3000/api/implementation/submissions"));
    const detail = await GET(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}`),
      { params },
    );
    const getBlocked = await revealGet();
    const opened = await reveal(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${seeded.row.id}/credentials`, {
        method: "POST",
      }),
      { params },
    );
    const body = await opened.json();
    const listedBody = await listed.json();
    const detailBody = await detail.json();
    const logs = spy.mock.calls.map((call) => String(call[0])).join("\n");
    const events = await seeded.audit.listBySubmissionId(seeded.row.id);

    expect(listed.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(getBlocked.status).toBe(405);
    expect(opened.status).toBe(200);
    expect(opened.headers.get("cache-control")).toMatch(/no-store/);
    expect(getBlocked.headers.get("cache-control")).toMatch(/no-store/);
    expect(body.clientSecret).toBe(SECRET);
    expect(body.clientId).toBe("id-northgate");
    expect(listedBody.submissions[0].can_open_credentials).toBe(true);
    expect(JSON.stringify(listedBody)).not.toContain(SECRET);
    expect(JSON.stringify(detailBody)).not.toContain(SECRET);
    expect(JSON.stringify(detailBody)).not.toContain("id-northgate");
    expect(events.some((event) => event.eventType === "credential_opened")).toBe(true);
    expect(JSON.stringify(events)).not.toContain(SECRET);
    expect(logs).toContain("internal_credential_opened");
    expect(logs).not.toContain(SECRET);
    spy.mockRestore();
  });
});

describe("internal submissions freeze", () => {
  it("keeps secrets off the queue store, log APIs, and HTML credential shell", () => {
    const root = process.cwd();
    const queue = readFileSync(path.join(root, "lib/implementation/internal/supabase-queue-store.ts"), "utf8");
    const list = readFileSync(path.join(root, "app/api/implementation/submissions/route.ts"), "utf8");
    const detail = readFileSync(path.join(root, "app/api/implementation/submissions/[id]/route.ts"), "utf8");
    const page = readFileSync(path.join(root, "app/implementation/(workspace)/submissions/page.tsx"), "utf8");
    const review = readFileSync(path.join(root, "components/submissions/SubmissionReview.tsx"), "utf8");
    const credentialsPage = readFileSync(
      path.join(root, "app/implementation/(workspace)/submissions/[id]/credentials/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(path.join(root, "components/submissions/SecureCredentialsPanel.tsx"), "utf8");
    const reveal = readFileSync(
      path.join(root, "app/api/implementation/submissions/[id]/credentials/route.ts"),
      "utf8",
    );
    const migration = readFileSync(
      path.join(root, "supabase/migrations/20260904181449_internal_submissions_access.sql"),
      "utf8",
    );

    expect(queue).toContain('select("implementation_id, received_at")');
    expect(queue).not.toContain("envelope");
    expect(list).not.toContain("listPrototypeSubmissions");
    expect(list).not.toContain("decryptCredentialSecrets");
    expect(detail).not.toContain("decryptCredentialSecrets");
    expect(page).not.toContain("listPrototypeSubmissions");
    expect(review).toContain("Open secure credentials");
    expect(review).not.toContain("clientSecret");
    expect(credentialsPage).not.toContain("decryptCredentialSecrets");
    expect(credentialsPage).not.toContain("clientSecret");
    expect(panel).toContain('cache: "no-store"');
    expect(panel).toContain("setRevealed(null)");
    expect(panel).not.toContain("localStorage");
    expect(panel).not.toContain("sessionStorage");
    expect(reveal).toContain("requireEngineer");
    expect(reveal).toContain("revealCredentials");
    expect(reveal).toContain("no-store");
    expect(migration).not.toContain("drop table");
    expect(migration).toContain("internal_staff");
    expect(migration).toContain("implementation_audit_events");
    expect(existsSync(path.join(root, "app/admin/submissions/page.tsx"))).toBe(true);
  });
});
