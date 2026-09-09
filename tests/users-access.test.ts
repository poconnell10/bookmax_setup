import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_EMAIL_COOKIE } from "@/lib/access/pending-email";
import { landingPath, resolveAuthorization } from "@/lib/access/authorization";
import { createMemoryIdentityStore } from "@/lib/implementation/access/identity-store";
import { createMemoryAccessAuditStore } from "@/lib/implementation/access/memory-audit-store";
import { setAccessSingletonsForTests } from "@/lib/implementation/access/runtime";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";
import { setCustomerSingletonsForTests } from "@/lib/implementation/customer/runtime";
import { createMemoryAuditStore } from "@/lib/implementation/internal/memory-audit-store";
import { createMemoryQueueStore } from "@/lib/implementation/internal/memory-queue-store";
import { createMemoryStaffStore } from "@/lib/implementation/internal/memory-staff-store";
import { setInternalSingletonsForTests } from "@/lib/implementation/internal/runtime";
import { createMemoryCredentialStore } from "@/lib/setup/credentials/memory-store";
import { createCredentialService } from "@/lib/setup/credentials/service";
import { setCredentialSingletonsForTests } from "@/lib/setup/credentials/runtime";
import type { InternalRole, InternalStaff, StaffStatus } from "@/lib/implementation/internal/types";

const SECRET = "users-access-secret-do-not-leak";
const STAMP = "2026-09-08T12:00:00.000Z";
const TEST_KEY = Buffer.alloc(32, 13).toString("base64");

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-clients", () => ({
  createSupabaseRouteClient: () => ({
    supabase: {
      auth: {
        getUser: authMocks.getUser,
        verifyOtp: authMocks.verifyOtp,
        signOut: authMocks.signOut,
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

function staffOf(userId: string, role: InternalRole, status: StaffStatus = "active"): InternalStaff {
  return {
    userId,
    role,
    status,
    createdAt: STAMP,
    updatedAt: STAMP,
    provisionedBy: null,
  };
}

function asUser(id: string | null, email = "user@bookmax.ai") {
  authMocks.getUser.mockResolvedValue({
    data: { user: id ? { id, email } : null },
    error: null,
  });
}

async function seedWorld() {
  process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  const identities = createMemoryIdentityStore([
    { userId: "admin-1", email: "admin@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "admin-2", email: "admin2@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "engineer-1", email: "engineer@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "viewer-1", email: "viewer@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "customer-1", email: "priya@hotel.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "gauge-1", email: "asena@in-gauge.io", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "fpg-customer", email: "alex@frontlinepg.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-1", email: "new@hotel.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-2", email: "viewer-new@frontlinepg.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-3", email: "cust-new@hotel.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-fpg", email: "nshaw@frontlinepg.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-fpg-admin", email: "lead@frontlinepg.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-fpg-cust", email: "cust@frontlinepg.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-gauge", email: "pending@in-gauge.io", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-gauge-admin", email: "lead@in-gauge.io", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-gauge-cust", email: "cust@in-gauge.io", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-mixed", email: "Andy@IN-GAUGE.IO", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "pending-yopmail", email: "qa@yopmail.com", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "disabled-1", email: "disabled@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
    { userId: "both-1", email: "both@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
  ]);
  const staffStore = createMemoryStaffStore([
    staffOf("admin-1", "admin"),
    staffOf("admin-2", "admin"),
    staffOf("engineer-1", "engineer"),
    staffOf("viewer-1", "viewer"),
    staffOf("disabled-1", "engineer", "disabled"),
    staffOf("both-1", "engineer"),
  ]);
  const customers = createMemoryCustomerStore();
  const customer = createCustomerService(customers);
  await customer.ensureForUser("customer-1");
  await customer.saveProperty("customer-1", {
    name: "Hotel Northgate",
    city: "Barcelona",
    country: "Spain",
    contactName: "Priya Raman",
  });
  await customer.ensureForUser("gauge-1");
  await customer.saveProperty("gauge-1", {
    name: "Disney's Coronado Springs",
    city: "Orlando",
    country: "USA",
    contactName: "Asena",
  });
  await customer.ensureForUser("fpg-customer");
  await customer.saveProperty("fpg-customer", {
    name: "Frontline Property",
    city: "Dublin",
    country: "Ireland",
    contactName: "Alex",
  });
  await customer.ensureForUser("both-1");
  const credentials = createMemoryCredentialStore();
  const credentialService = createCredentialService(credentials, customer);
  const queue = createMemoryQueueStore();
  const audit = createMemoryAuditStore();
  const accessAudit = createMemoryAccessAuditStore();

  setCustomerSingletonsForTests({ store: customers, service: customer });
  setCredentialSingletonsForTests({ store: credentials, service: credentialService });
  setInternalSingletonsForTests({
    staff: staffStore,
    queue,
    audit,
    credentials,
  });
  setAccessSingletonsForTests({ identities, audit: accessAudit });

  return { identities, staffStore, customers, customer, queue, credentials, credentialService, accessAudit };
}

async function verifyOtpFor(userId: string, email: string) {
  authMocks.verifyOtp.mockResolvedValue({
    data: { user: { id: userId, email }, session: { access_token: "a", refresh_token: "r" } },
    error: null,
  });
  const { POST } = await import("@/app/api/access/otp/verify/route");
  return POST(
    new NextRequest("http://localhost:3000/api/access/otp/verify", {
      method: "POST",
      headers: {
        cookie: `${PENDING_EMAIL_COOKIE}=${email}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "123456" }),
    }),
  );
}

describe("Users & Access authorization", () => {
  beforeEach(async () => {
    authMocks.getUser.mockReset();
    authMocks.verifyOtp.mockReset();
    authMocks.signOut.mockReset();
    authMocks.signOut.mockResolvedValue({ error: null });
    await seedWorld();
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
    setAccessSingletonsForTests({ identities: null, audit: null, directory: null });
  });

  it("1. unauthenticated internal access is denied", async () => {
    asUser(null);
    const { GET: users } = await import("@/app/api/implementation/users/route");
    const { GET: submissions } = await import("@/app/api/implementation/submissions/route");
    expect((await users(new NextRequest("http://localhost:3000/api/implementation/users"))).status).toBe(401);
    expect((await submissions(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(401);
  });

  it("2. unknown authenticated user is pending, not a customer", async () => {
    const decision = await resolveAuthorization({ userId: "pending-1", email: "new@hotel.com" });
    expect(decision.kind).toBe("pending");
    expect(landingPath(decision)).toBe("/access/pending");
    const response = await verifyOtpFor("pending-1", "new@hotel.com");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.resumePath).toBe("/access/pending");
    expect(body.implementation).toBeNull();
  });

  it("3. customer OTP resumes the customer setup path", async () => {
    const response = await verifyOtpFor("customer-1", "priya@hotel.com");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.resumePath).toBe("/setup/pms");
    expect(body.implementation.id).toBeTruthy();
  });

  it("4. engineer OTP routes to submissions", async () => {
    const response = await verifyOtpFor("engineer-1", "engineer@bookmax.ai");
    const body = await response.json();
    expect(body.resumePath).toBe("/implementation/submissions");
  });

  it("5. viewer OTP routes to submissions", async () => {
    const response = await verifyOtpFor("viewer-1", "viewer@bookmax.ai");
    const body = await response.json();
    expect(body.resumePath).toBe("/implementation/submissions");
  });

  it("6. admin OTP routes to Users & Access", async () => {
    const response = await verifyOtpFor("admin-1", "admin@bookmax.ai");
    const body = await response.json();
    expect(body.resumePath).toBe("/implementation/users");
  });

  it("7. disabled engineer is denied", async () => {
    asUser("disabled-1", "disabled@bookmax.ai");
    const { GET } = await import("@/app/api/implementation/submissions/route");
    const { GET: users } = await import("@/app/api/implementation/users/route");
    expect((await GET(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(403);
    expect((await users(new NextRequest("http://localhost:3000/api/implementation/users"))).status).toBe(403);
    const otp = await verifyOtpFor("disabled-1", "disabled@bookmax.ai");
    expect((await otp.json()).resumePath).toBe("/access/denied");
  });

  it("8. internal membership wins over customer mapping", async () => {
    const decision = await resolveAuthorization({ userId: "both-1", email: "both@bookmax.ai" });
    expect(decision.kind).toBe("internal");
    expect(landingPath(decision)).toBe("/implementation/submissions");
    asUser("both-1", "both@bookmax.ai");
    const { GET: submissions } = await import("@/app/api/implementation/submissions/route");
    const { GET: setup } = await import("@/app/api/setup/context/route");
    expect((await submissions(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(200);
    expect((await setup(new NextRequest("http://localhost:3000/api/setup/context"))).status).toBe(403);
  });

  it("9-12. only a real admin can list users", async () => {
    const { GET } = await import("@/app/api/implementation/users/route");
    const request = (query = "") => new NextRequest(`http://localhost:3000/api/implementation/users${query}`);
    asUser("customer-1", "priya@hotel.com");
    expect((await GET(request("?role=admin"))).status).toBe(403);
    asUser("engineer-1", "engineer@bookmax.ai");
    expect((await GET(request("?user_id=admin-1"))).status).toBe(403);
    asUser("viewer-1", "viewer@bookmax.ai");
    expect((await GET(request())).status).toBe(403);
    asUser("admin-1", "admin@bookmax.ai");
    const allowed = await GET(request());
    const body = await allowed.json();
    expect(allowed.status).toBe(200);
    expect(body.users.some((row: { userId: string }) => row.userId === "pending-1")).toBe(true);
  });

  it("13-15. admin can provision engineer, viewer, and customer", async () => {
    asUser("admin-1", "admin@bookmax.ai");
    const { POST, GET } = await import("@/app/api/implementation/users/route");
    const listed = await GET(new NextRequest("http://localhost:3000/api/implementation/users"));
    const implementationId = (await listed.json()).implementations[0].id;

    const engineer = await POST(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "POST",
        body: JSON.stringify({ userId: "pending-fpg", accountType: "internal", role: "engineer" }),
      }),
    );
    expect(engineer.status).toBe(200);
    expect((await engineer.json()).user.role).toBe("engineer");

    asUser("admin-1", "admin@bookmax.ai");
    const viewer = await POST(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "POST",
        body: JSON.stringify({ userId: "pending-2", accountType: "internal", role: "viewer" }),
      }),
    );
    const customer = await POST(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "POST",
        body: JSON.stringify({ userId: "pending-3", accountType: "customer", implementationId }),
      }),
    );
    expect(viewer.status).toBe(200);
    expect((await viewer.json()).user.role).toBe("viewer");
    expect(customer.status).toBe(200);
    expect((await customer.json()).user.accountType).toBe("customer");
  });

  it("16-18. admin can promote, disable, and reactivate", async () => {
    asUser("admin-1", "admin@bookmax.ai");
    const { PATCH } = await import("@/app/api/implementation/users/route");
    const promoted = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: "viewer-1", action: "role", role: "admin" }),
      }),
    );
    expect(promoted.status).toBe(200);
    expect((await promoted.json()).user.role).toBe("admin");
    const disabled = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: "engineer-1", action: "disable" }),
      }),
    );
    expect(disabled.status).toBe(200);
    expect((await disabled.json()).user.status).toBe("disabled");
    const reactivated = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: "engineer-1", action: "reactivate" }),
      }),
    );
    expect(reactivated.status).toBe(200);
    expect((await reactivated.json()).user.status).toBe("active");
  });

  it("19-20. role and user_id spoofing cannot grant admin APIs", async () => {
    asUser("engineer-1", "engineer@bookmax.ai");
    const { GET, POST } = await import("@/app/api/implementation/users/route");
    expect(
      (
        await GET(new NextRequest("http://localhost:3000/api/implementation/users?role=admin&user_id=admin-1"))
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          new NextRequest("http://localhost:3000/api/implementation/users?role=admin", {
            method: "POST",
            body: JSON.stringify({ userId: "pending-1", accountType: "internal", role: "admin" }),
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("21. the last active Admin cannot be disabled or downgraded", async () => {
    const staffStore = createMemoryStaffStore([staffOf("admin-1", "admin")]);
    setInternalSingletonsForTests({ staff: staffStore });
    setAccessSingletonsForTests({
      identities: createMemoryIdentityStore([
        { userId: "admin-1", email: "admin@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
      ]),
      audit: createMemoryAccessAuditStore(),
    });
    asUser("admin-1", "admin@bookmax.ai");
    const { PATCH } = await import("@/app/api/implementation/users/route");
    const disabled = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: "admin-1", action: "disable" }),
      }),
    );
    const downgraded = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: "admin-1", action: "role", role: "engineer" }),
      }),
    );
    expect(disabled.status).toBe(403);
    expect(downgraded.status).toBe(403);
  });

  it("does not grant Engineer or Admin from @in-gauge.io or @frontlinepg.com", async () => {
    const decision = await resolveAuthorization({
      userId: "gauge-1",
      email: "asena@in-gauge.io",
    });
    expect(decision.kind).toBe("customer");
    expect(landingPath(decision)).toBe("/setup/property");
    const fpg = await resolveAuthorization({
      userId: "pending-fpg",
      email: "nshaw@frontlinepg.com",
    });
    expect(fpg.kind).toBe("pending");
  });

  it("admin can convert an existing customer to Internal / Engineer", async () => {
    asUser("admin-1", "admin@bookmax.ai");
    const { PATCH } = await import("@/app/api/implementation/users/route");
    const converted = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: "gauge-1",
          action: "accountType",
          accountType: "internal",
          role: "engineer",
        }),
      }),
    );
    expect(converted.status).toBe(200);
    const body = await converted.json();
    expect(body.user.accountType).toBe("internal");
    expect(body.user.role).toBe("engineer");
    expect(body.user.status).toBe("active");

    const decision = await resolveAuthorization({
      userId: "gauge-1",
      email: "asena@in-gauge.io",
    });
    expect(decision.kind).toBe("internal");
    if (decision.kind === "internal") {
      expect(decision.role).toBe("engineer");
    }
    expect(landingPath(decision)).toBe("/implementation/submissions");

    asUser("gauge-1", "asena@in-gauge.io");
    const { GET: submissions } = await import("@/app/api/implementation/submissions/route");
    const { GET: users } = await import("@/app/api/implementation/users/route");
    const { GET: setup } = await import("@/app/api/setup/context/route");
    expect((await submissions(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(200);
    expect((await users(new NextRequest("http://localhost:3000/api/implementation/users"))).status).toBe(403);
    expect((await setup(new NextRequest("http://localhost:3000/api/setup/context"))).status).toBe(403);
  });

  it("admin can convert an eligible customer to Internal / Admin", async () => {
    asUser("admin-1", "admin@bookmax.ai");
    const { PATCH } = await import("@/app/api/implementation/users/route");
    const converted = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: "gauge-1",
          action: "accountType",
          accountType: "internal",
          role: "admin",
        }),
      }),
    );
    expect(converted.status).toBe(200);
    expect((await converted.json()).user.role).toBe("admin");
    const decision = await resolveAuthorization({
      userId: "gauge-1",
      email: "asena@in-gauge.io",
    });
    expect(landingPath(decision)).toBe("/implementation/users");
  });

  it("admin can convert Internal / Engineer back to Customer with an implementation", async () => {
    asUser("admin-1", "admin@bookmax.ai");
    const { GET, PATCH } = await import("@/app/api/implementation/users/route");
    const listed = await GET(new NextRequest("http://localhost:3000/api/implementation/users"));
    const implementationId = (await listed.json()).implementations[0].id;
    const converted = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: "engineer-1",
          action: "accountType",
          accountType: "customer",
          implementationId,
        }),
      }),
    );
    expect(converted.status).toBe(200);
    const body = await converted.json();
    expect(body.user.accountType).toBe("customer");
    expect(body.user.role).toBe("customer");
    expect(body.user.implementationId).toBe(implementationId);
    const decision = await resolveAuthorization({
      userId: "engineer-1",
      email: "engineer@bookmax.ai",
    });
    expect(decision.kind).toBe("customer");
    expect(landingPath(decision)).toBe("/setup/property");
  });

  it("enforces Internal domain eligibility on provision and conversion", async () => {
    asUser("admin-1", "admin@bookmax.ai");
    const { POST, GET, PATCH } = await import("@/app/api/implementation/users/route");
    const { GET: getUser } = await import("@/app/api/implementation/users/[id]/route");
    const listed = await GET(new NextRequest("http://localhost:3000/api/implementation/users"));
    const implementationId = (await listed.json()).implementations[0].id;

    async function post(body: object) {
      asUser("admin-1", "admin@bookmax.ai");
      return POST(
        new NextRequest("http://localhost:3000/api/implementation/users", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    }
    async function patch(body: object) {
      asUser("admin-1", "admin@bookmax.ai");
      return PATCH(
        new NextRequest("http://localhost:3000/api/implementation/users", {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      );
    }

    const fpgCustomer = await post({
      userId: "pending-fpg-cust",
      accountType: "customer",
      implementationId,
    });
    expect(fpgCustomer.status).toBe(200);
    expect((await fpgCustomer.json()).user.accountType).toBe("customer");

    const fpgEngineer = await post({
      userId: "pending-fpg",
      accountType: "internal",
      role: "engineer",
    });
    expect(fpgEngineer.status).toBe(200);
    expect((await fpgEngineer.json()).user).toMatchObject({ accountType: "internal", role: "engineer" });

    const fpgAdmin = await post({
      userId: "pending-fpg-admin",
      accountType: "internal",
      role: "admin",
    });
    expect(fpgAdmin.status).toBe(200);
    expect((await fpgAdmin.json()).user.role).toBe("admin");

    const gaugeCustomer = await post({
      userId: "pending-gauge-cust",
      accountType: "customer",
      implementationId,
    });
    expect(gaugeCustomer.status).toBe(200);
    expect((await gaugeCustomer.json()).user.accountType).toBe("customer");

    const gaugeEngineer = await post({
      userId: "pending-gauge",
      accountType: "internal",
      role: "engineer",
    });
    expect(gaugeEngineer.status).toBe(200);
    expect((await gaugeEngineer.json()).user).toMatchObject({ accountType: "internal", role: "engineer" });

    const gaugeAdmin = await post({
      userId: "pending-gauge-admin",
      accountType: "internal",
      role: "admin",
    });
    expect(gaugeAdmin.status).toBe(200);
    expect((await gaugeAdmin.json()).user.role).toBe("admin");

    const mixed = await post({
      userId: "pending-mixed",
      accountType: "internal",
      role: "engineer",
    });
    expect(mixed.status).toBe(200);
    expect((await mixed.json()).user.role).toBe("engineer");

    const hotelCustomer = await post({
      userId: "pending-1",
      accountType: "customer",
      implementationId,
    });
    expect(hotelCustomer.status).toBe(200);
    expect((await hotelCustomer.json()).user.accountType).toBe("customer");

    const hotelInternal = await post({
      userId: "pending-3",
      accountType: "internal",
      role: "engineer",
    });
    expect(hotelInternal.status).toBe(400);
    expect((await hotelInternal.json()).error).toMatch(/frontlinepg\.com or in-gauge\.io/i);

    const yopmailInternal = await post({
      userId: "pending-yopmail",
      accountType: "internal",
      role: "admin",
    });
    expect(yopmailInternal.status).toBe(400);

    const hotelConvert = await patch({
      userId: "customer-1",
      action: "accountType",
      accountType: "internal",
      role: "engineer",
    });
    expect(hotelConvert.status).toBe(400);

    const fpgConvert = await patch({
      userId: "fpg-customer",
      action: "accountType",
      accountType: "internal",
      role: "engineer",
    });
    expect(fpgConvert.status).toBe(200);
    expect((await fpgConvert.json()).user).toMatchObject({ accountType: "internal", role: "engineer" });

    const domainOnly = await resolveAuthorization({
      userId: "pending-yopmail",
      email: "qa@yopmail.com",
    });
    expect(domainOnly.kind).toBe("pending");
    const eligiblePending = await resolveAuthorization({
      userId: "pending-gauge-cust",
      email: "cust@in-gauge.io",
    });
    expect(eligiblePending.kind).toBe("customer");

    asUser("pending-fpg", "nshaw@frontlinepg.com");
    const { GET: submissions } = await import("@/app/api/implementation/submissions/route");
    const { GET: users } = await import("@/app/api/implementation/users/route");
    expect((await submissions(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(200);
    expect((await users(new NextRequest("http://localhost:3000/api/implementation/users"))).status).toBe(403);

    asUser("admin-1", "admin@bookmax.ai");
    const detail = await getUser(new NextRequest("http://localhost:3000/api/implementation/users/fpg-customer"), {
      params: Promise.resolve({ id: "fpg-customer" }),
    });
    const audit = (await detail.json()).audit as { eventType: string }[];
    expect(audit.some((event) => event.eventType === "ACCOUNT_TYPE_CHANGED")).toBe(true);
  });

  it("the last active Admin cannot be converted to Customer", async () => {
    const staffStore = createMemoryStaffStore([staffOf("admin-1", "admin")]);
    setInternalSingletonsForTests({ staff: staffStore });
    setAccessSingletonsForTests({
      identities: createMemoryIdentityStore([
        { userId: "admin-1", email: "admin@bookmax.ai", lastSignInAt: STAMP, createdAt: STAMP },
      ]),
      audit: createMemoryAccessAuditStore(),
    });
    asUser("admin-1", "admin@bookmax.ai");
    const { PATCH } = await import("@/app/api/implementation/users/route");
    const converted = await PATCH(
      new NextRequest("http://localhost:3000/api/implementation/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: "admin-1",
          action: "accountType",
          accountType: "customer",
          implementationId: "missing",
        }),
      }),
    );
    expect(converted.status).toBe(403);
  });

  it("22-25. submissions stay role-scoped", async () => {
    asUser("engineer-1", "engineer@bookmax.ai");
    const { GET } = await import("@/app/api/implementation/submissions/route");
    expect((await GET(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(200);
    asUser("viewer-1", "viewer@bookmax.ai");
    expect((await GET(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(200);
    asUser("customer-1", "priya@hotel.com");
    expect((await GET(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(403);
    asUser("pending-1", "new@hotel.com");
    expect((await GET(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(403);
  });

  it("26. viewer cannot reveal credentials", async () => {
    const world = await seedWorld();
    asUser("customer-1", "priya@hotel.com");
    await world.customer.savePmsSelection("customer-1", { pmsId: "mews", otherPmsName: "" });
    await world.customer.saveConnectDetails("customer-1", { pmsAccessMethod: "api" });
    await world.credentialService.submit("customer-1", {
      clientId: "id-1",
      clientSecret: SECRET,
      applicationKey: "app-1",
    });
    const context = await world.customer.submitSetup("customer-1", "priya@hotel.com");
    const row = await world.queue.insertFromCustomer!({
      implementationId: context.implementation.id,
      record: context.submission!.record,
      submittedAt: context.submission!.submittedAt,
    });
    asUser("viewer-1", "viewer@bookmax.ai");
    const { POST } = await import("@/app/api/implementation/submissions/[id]/credentials/route");
    const opened = await POST(
      new NextRequest(`http://localhost:3000/api/implementation/submissions/${row.id}/credentials`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: row.id }) },
    );
    expect(opened.status).toBe(403);
    expect(JSON.stringify(await opened.json())).not.toContain(SECRET);
  });

  it("27-28. logout clears the session and denies protected routes", async () => {
    asUser("engineer-1", "engineer@bookmax.ai");
    const { POST } = await import("@/app/api/access/logout/route");
    const loggedOut = await POST(new NextRequest("http://localhost:3000/api/access/logout", { method: "POST" }));
    expect(loggedOut.status).toBe(200);
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    asUser(null);
    const { GET: users } = await import("@/app/api/implementation/users/route");
    const { GET: submissions } = await import("@/app/api/implementation/submissions/route");
    expect((await users(new NextRequest("http://localhost:3000/api/implementation/users"))).status).toBe(401);
    expect((await submissions(new NextRequest("http://localhost:3000/api/implementation/submissions"))).status).toBe(401);
  });
});
