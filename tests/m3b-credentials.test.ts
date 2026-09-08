import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";
import { setCustomerSingletonsForTests, getCustomerService } from "@/lib/implementation/customer/runtime";
import {
  decryptCredentialSecrets,
  encryptCredentialSecrets,
} from "@/lib/setup/credentials/encrypt";
import { createMemoryCredentialStore } from "@/lib/setup/credentials/memory-store";
import { createCredentialService } from "@/lib/setup/credentials/service";
import { setCredentialSingletonsForTests } from "@/lib/setup/credentials/runtime";
import { createMemoryStaffStore } from "@/lib/implementation/internal/memory-staff-store";
import { setInternalSingletonsForTests } from "@/lib/implementation/internal/runtime";
import type { CredentialStore } from "@/lib/setup/credentials/store";

const TEST_KEY = Buffer.alloc(32, 9).toString("base64");
const SECRET = "super-secret-value-do-not-store";

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
}));

async function seedCloudCustomer() {
  const customerStore = createMemoryCustomerStore();
  const customer = createCustomerService(customerStore);
  const credentialStore = createMemoryCredentialStore();
  setCustomerSingletonsForTests({ store: customerStore, service: customer });
  setInternalSingletonsForTests({ staff: createMemoryStaffStore() });
  setCredentialSingletonsForTests({
    store: credentialStore,
    service: createCredentialService(credentialStore, customer),
  });
  await customer.ensureForUser("user-1");
  await customer.saveProperty("user-1", {
    name: "Hotel",
    city: "London",
    country: "uk",
    contactName: "Jane",
  });
  await customer.savePmsSelection("user-1", { pmsId: "mews", otherPmsName: "" });
  return { customer, credentialStore };
}

describe("M3B.1 credential encryption", () => {
  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  });

  it("round-trips AES-256-GCM without leaving plaintext on the envelope", () => {
    const envelope = encryptCredentialSecrets({
      clientId: "id-1",
      clientSecret: SECRET,
      applicationKey: "app-1",
    });
    expect(envelope.alg).toBe("aes-256-gcm");
    expect(JSON.stringify(envelope)).not.toContain(SECRET);
    expect(JSON.stringify(envelope)).not.toContain("id-1");
    const opened = decryptCredentialSecrets(envelope);
    expect(opened.clientId).toBe("id-1");
    expect(opened.clientSecret).toBe(SECRET);
    expect(opened.applicationKey).toBe("app-1");
  });

  it("rejects a NEXT_PUBLIC encryption key", async () => {
    const { getCredentialEncryptionKey } = await import("@/lib/setup/credentials/env");
    expect(() =>
      getCredentialEncryptionKey({
        NEXT_PUBLIC_CREDENTIAL_ENCRYPTION_KEY: TEST_KEY,
        CREDENTIAL_ENCRYPTION_KEY: TEST_KEY,
      }),
    ).toThrow(/NEXT_PUBLIC/);
  });
});

describe("M3B.1 credential API", () => {
  let credentialStore: CredentialStore;

  beforeEach(async () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
    authMocks.getUser.mockReset();
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "jane@hotel.com" } },
      error: null,
    });
    const seeded = await seedCloudCustomer();
    credentialStore = seeded.credentialStore;
  });

  afterEach(() => {
    setCustomerSingletonsForTests({ store: null, service: null });
    setCredentialSingletonsForTests({ store: null, service: null });
    setInternalSingletonsForTests({ staff: null, service: null });
  });

  it("rejects unauthenticated POST and GET", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/setup/credentials/route");
    const { GET } = await import("@/app/api/setup/credentials/status/route");
    const post = await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({ clientId: "id", clientSecret: SECRET }),
      }),
    );
    const get = await GET(new NextRequest("http://localhost:3000/api/setup/credentials/status"));
    expect(post.status).toBe(403);
    expect(get.status).toBe(403);
  });

  it("rejects on-premise PMS", async () => {
    const customerStore = createMemoryCustomerStore();
    const customer = createCustomerService(customerStore);
    const store = createMemoryCredentialStore();
    setCustomerSingletonsForTests({ store: customerStore, service: customer });
    setInternalSingletonsForTests({ staff: createMemoryStaffStore() });
    setCredentialSingletonsForTests({ store, service: createCredentialService(store, customer) });
    await customer.ensureForUser("user-1");
    await customer.saveProperty("user-1", { name: "Hotel", city: "London", country: "uk", contactName: "Jane" });
    await customer.savePmsSelection("user-1", { pmsId: "opera5", otherPmsName: "" });

    const { POST } = await import("@/app/api/setup/credentials/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({ clientId: "id", clientSecret: SECRET }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await store.findByImplementationId((await customer.getForUser("user-1")).implementation.id)).toBeNull();
  });

  it("requires Client ID and client secret; application key is optional", async () => {
    const { POST } = await import("@/app/api/setup/credentials/route");
    const missing = await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({ clientId: "id" }),
      }),
    );
    expect(missing.status).toBe(400);

    const ok = await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({ clientId: "id-1", clientSecret: SECRET }),
      }),
    );
    const body = (await ok.json()) as Record<string, unknown>;
    expect(ok.status).toBe(200);
    expect(body).toEqual({ ok: true, credentialsReceived: true });
    expect(Object.keys(body).sort()).toEqual(["credentialsReceived", "ok"]);
  });

  it("refuses already-submitted implementations", async () => {
    const customerStore = createMemoryCustomerStore();
    const customer = createCustomerService(customerStore);
    const store = createMemoryCredentialStore();
    setCustomerSingletonsForTests({ store: customerStore, service: customer });
    setInternalSingletonsForTests({ staff: createMemoryStaffStore() });
    setCredentialSingletonsForTests({ store, service: createCredentialService(store, customer) });
    await customer.ensureForUser("user-1");
    await customer.saveProperty("user-1", { name: "Hotel", city: "London", country: "uk", contactName: "Jane" });
    await customer.savePmsSelection("user-1", { pmsId: "mews", otherPmsName: "" });
    await customer.submitSetup("user-1", "jane@hotel.com");

    const { POST } = await import("@/app/api/setup/credentials/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({ clientId: "id", clientSecret: SECRET }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("stores only ciphertext and does not write secrets into intake, submission, or logs", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const customer = getCustomerService();
    const before = await customer.getForUser("user-1");

    const { POST } = await import("@/app/api/setup/credentials/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({
          clientId: "id-1",
          clientSecret: SECRET,
          applicationKey: "app-key",
        }),
      }),
    );
    expect(response.status).toBe(200);

    const after = await customer.getForUser("user-1");
    expect(after.intake?.payload).toEqual(before.intake?.payload);
    expect(JSON.stringify(after.intake)).not.toContain(SECRET);

    const stored = await credentialStore.findByImplementationId(after.implementation.id);
    expect(stored).not.toBeNull();
    expect(JSON.stringify(stored?.envelope)).not.toContain(SECRET);
    expect(JSON.stringify(stored?.envelope)).not.toContain("app-key");
    expect(decryptCredentialSecrets(stored!.envelope).clientSecret).toBe(SECRET);

    const submitted = await customer.submitSetup("user-1", "jane@hotel.com");
    expect(JSON.stringify(submitted.submission?.record)).not.toContain(SECRET);
    expect(JSON.stringify(submitted.submission?.record.intake)).not.toContain("clientSecret");

    const printed = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(printed).toContain("credentials_received");
    expect(printed).not.toContain(SECRET);
    spy.mockRestore();
  });

  it("GET status returns receipt metadata only", async () => {
    const { GET } = await import("@/app/api/setup/credentials/status/route");
    const empty = await GET(new NextRequest("http://localhost:3000/api/setup/credentials/status"));
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody).toEqual({ ok: true, credentialsReceived: false, receivedAt: null });

    const { POST } = await import("@/app/api/setup/credentials/route");
    await POST(
      new NextRequest("http://localhost:3000/api/setup/credentials", {
        method: "POST",
        body: JSON.stringify({ clientId: "id-1", clientSecret: SECRET }),
      }),
    );

    const received = await GET(new NextRequest("http://localhost:3000/api/setup/credentials/status"));
    const body = (await received.json()) as Record<string, unknown>;
    expect(received.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.credentialsReceived).toBe(true);
    expect(typeof body.receivedAt).toBe("string");
    expect(body).not.toHaveProperty("clientId");
    expect(body).not.toHaveProperty("clientSecret");
    expect(body).not.toHaveProperty("envelope");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});

describe("M3B.1 freeze static checks", () => {
  it("does not add credentialsReceived to setup context or decrypt in the status route", () => {
    const root = process.cwd();
    const context = readFileSync(path.join(root, "app/api/setup/context/route.ts"), "utf8");
    const status = readFileSync(path.join(root, "app/api/setup/credentials/status/route.ts"), "utf8");
    const intake = readFileSync(path.join(root, "lib/setup/intake.ts"), "utf8");
    const connect = readFileSync(path.join(root, "components/setup/ConnectSetupScreen.tsx"), "utf8");
    const review = readFileSync(path.join(root, "components/setup/ReviewSetupScreen.tsx"), "utf8");
    expect(context).not.toContain("credentialsReceived");
    expect(status).not.toContain("decryptCredentialSecrets");
    expect(intake).not.toContain("clientSecret");
    expect(connect).toContain("/api/setup/credentials");
    expect(review).toContain("/api/setup/credentials/status");
    expect(existsSync(path.join(root, "lib/setup/credentials/encrypt.ts"))).toBe(true);
  });
});
