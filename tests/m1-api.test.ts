import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_VALIDATION_ERROR } from "@/lib/access/email";
import { PENDING_EMAIL_COOKIE } from "@/lib/access/pending-email";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";
import { setCustomerSingletonsForTests } from "@/lib/implementation/customer/runtime";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "secret-test-key-m1",
};

const authMocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-clients", () => ({
  createSupabaseRouteClient: () => ({
    supabase: {
      auth: {
        signInWithOtp: authMocks.signInWithOtp,
        verifyOtp: authMocks.verifyOtp,
        getUser: authMocks.getUser,
      },
    },
    attachAuthCookies: (response: NextResponse) => response,
  }),
  createSupabaseProxyClient: () => ({
    auth: {
      getUser: authMocks.getUser,
    },
  }),
}));

describe("M1 OTP API", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY;
    const store = createMemoryCustomerStore();
    setCustomerSingletonsForTests({
      store,
      service: createCustomerService(store),
    });
    authMocks.signInWithOtp.mockReset();
    authMocks.verifyOtp.mockReset();
    authMocks.getUser.mockReset();
  });

  afterEach(() => {
    setCustomerSingletonsForTests({ store: null, service: null });
  });

  it("AUTH-001 — sends OTP for a valid new email", async () => {
    authMocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    const { POST } = await import("@/app/api/access/otp/send/route");
    const request = new NextRequest("http://localhost:3000/api/access/otp/send", {
      method: "POST",
      body: JSON.stringify({ email: "jane@hotel.com" }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.emailMasked).toBe("j••••@hotel.com");
    expect(authMocks.signInWithOtp).toHaveBeenCalledWith({
      email: "jane@hotel.com",
      options: { shouldCreateUser: true },
    });
    expect(response.cookies.get(PENDING_EMAIL_COOKIE)?.value).toBe("jane@hotel.com");
  });

  it("AUTH-002 — does not call Supabase for an invalid email", async () => {
    const { POST } = await import("@/app/api/access/otp/send/route");
    const request = new NextRequest("http://localhost:3000/api/access/otp/send", {
      method: "POST",
      body: JSON.stringify({ email: "john@" }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe(EMAIL_VALIDATION_ERROR);
    expect(authMocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("AUTH-004 / AUTH-012 — valid OTP authenticates and creates one implementation", async () => {
    authMocks.verifyOtp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "jane@hotel.com" },
        session: { access_token: "a", refresh_token: "r" },
      },
      error: null,
    });
    const { POST } = await import("@/app/api/access/otp/verify/route");
    const request = new NextRequest("http://localhost:3000/api/access/otp/verify", {
      method: "POST",
      headers: {
        cookie: `${PENDING_EMAIL_COOKIE}=jane@hotel.com`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "123456" }),
    });
    const first = await POST(request);
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(firstBody.implementation.id).toBeTruthy();
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      email: "jane@hotel.com",
      token: "123456",
      type: "email",
    });

    const second = await POST(
      new NextRequest("http://localhost:3000/api/access/otp/verify", {
        method: "POST",
        headers: {
          cookie: `${PENDING_EMAIL_COOKIE}=jane@hotel.com`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    const secondBody = await second.json();
    expect(secondBody.implementation.id).toBe(firstBody.implementation.id);
  });

  it("AUTH-005 — wrong OTP does not create a session", async () => {
    authMocks.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid OTP" },
    });
    const { POST } = await import("@/app/api/access/otp/verify/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/access/otp/verify", {
        method: "POST",
        headers: {
          cookie: `${PENDING_EMAIL_COOKIE}=jane@hotel.com`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "000000" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe("That code isn't valid. Check the code and try again.");
  });

  it("AUTH-006 — expired OTP is classified without authenticating", async () => {
    authMocks.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired", message: "OTP has expired" },
    });
    const { POST } = await import("@/app/api/access/otp/verify/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/access/otp/verify", {
        method: "POST",
        headers: {
          cookie: `${PENDING_EMAIL_COOKIE}=jane@hotel.com`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe("otp_expired");
    expect(body.error).toBe("This code has expired. Send a new code to continue.");
  });

  it("AUTH-011 — verify without pending email does not put email in a query string", async () => {
    const { POST } = await import("@/app/api/access/otp/verify/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/access/otp/verify", {
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/@/);
  });
});

describe("M1 property API and tenancy", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY;
    authMocks.getUser.mockReset();
  });

  afterEach(() => {
    setCustomerSingletonsForTests({ store: null, service: null });
  });

  it("PROPERTY-003 / PROPERTY-004 — saves one property and repeats do not duplicate", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    setCustomerSingletonsForTests({ store, service });
    await service.ensureForUser("user-a");
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a", email: "a@hotel.com" } },
      error: null,
    });

    const { POST, GET } = await import("@/app/api/setup/property/route");
    const payload = {
      name: "The Langham London",
      city: "London",
      country: "uk",
      contactName: "John Smith",
      jobTitle: "Director of IT",
    };
    const first = await POST(
      new NextRequest("http://localhost:3000/api/setup/property", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.property.name).toBe("The Langham London");
    const propertyId = firstBody.property.id;

    const second = await POST(
      new NextRequest("http://localhost:3000/api/setup/property", {
        method: "POST",
        body: JSON.stringify({ ...payload, city: "Westminster" }),
      }),
    );
    const secondBody = await second.json();
    expect(secondBody.property.id).toBe(propertyId);
    expect(secondBody.property.city).toBe("Westminster");

    const loaded = await GET(new NextRequest("http://localhost:3000/api/setup/property"));
    const loadedBody = await loaded.json();
    expect(loadedBody.property.id).toBe(propertyId);
  });

  it("SECURITY-001 — customer A cannot read customer B's implementation", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    setCustomerSingletonsForTests({ store, service });
    const a = await service.ensureForUser("user-a");
    await service.ensureForUser("user-b");
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-b", email: "b@hotel.com" } },
      error: null,
    });

    const { GET } = await import("@/app/api/setup/property/route");
    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/setup/property?implementationId=${a.implementation.id}`,
      ),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.implementation).toBeUndefined();
  });

  it("SECURITY-002 — property ID substitution is denied", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    setCustomerSingletonsForTests({ store, service });
    await service.ensureForUser("user-a");
    const saved = await service.saveProperty("user-a", {
      name: "Hotel A",
      city: "Madrid",
      country: "es",
      contactName: "Ana",
    });
    await service.ensureForUser("user-b");
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-b", email: "b@hotel.com" } },
      error: null,
    });

    const { GET } = await import("@/app/api/setup/property/route");
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/setup/property?propertyId=${saved.property?.id}`),
    );
    expect(response.status).toBe(403);
  });
});

describe("M1 setup proxy gate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY;
    authMocks.getUser.mockReset();
  });

  it("redirects unauthenticated /setup/property requests to /access", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/setup/property");
    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/access");
  });

  it("allows authenticated /setup/property requests without an invitation", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-9", email: "jane@hotel.com" } },
      error: null,
    });
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/setup/property");
    const response = await proxy(request);
    expect(response.status).toBe(200);
  });
});
