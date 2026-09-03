import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFileInvitationStore } from "@/lib/implementation/invitation/file-store";
import {
  intakePatchFromInvitation,
  resolveCountryCode,
} from "@/lib/implementation/invitation/prefill";
import {
  setInvitationSingletonsForTests,
} from "@/lib/implementation/invitation/runtime";
import { createInvitationService } from "@/lib/implementation/invitation/service";
import {
  INVITATION_CLAIM_COOKIE,
  INVITATION_COOKIE,
  signInvitationClaim,
  verifyInvitationClaim,
} from "@/lib/implementation/invitation/session-cookie";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "secret-test-key-phase2",
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

describe("phase 2 invitation claim cookies", () => {
  it("signs and verifies an invitation claim", () => {
    const raw = signInvitationClaim(
      { invitationId: "inv-1", authUserId: "user-1" },
      ENV,
    );
    expect(raw).toContain(".");
    expect(verifyInvitationClaim(raw, ENV)).toEqual({
      invitationId: "inv-1",
      authUserId: "user-1",
    });
    expect(verifyInvitationClaim(`${raw}tampered`, ENV)).toBeNull();
    expect(verifyInvitationClaim(raw, { ...ENV, SUPABASE_SECRET_KEY: "other" })).toBeNull();
  });

  it("maps invitation country labels to catalogue codes for prefill", () => {
    expect(resolveCountryCode("Spain")).toBe("es");
    expect(resolveCountryCode("es")).toBe("es");
    const patch = intakePatchFromInvitation({
      id: "inv-1",
      invitedEmail: "elena.marquez@hotelabc.com",
      contactName: "Elena Márquez",
      propertyName: "Hotel ABC Barcelona",
      country: "Spain",
      hotelGroupOrBrand: "Hotel ABC Group",
      status: "verified",
      expiresAt: "2099-01-01T00:00:00.000Z",
      authUserId: "user-1",
      verifiedAt: "2026-01-01T00:00:00.000Z",
      submittedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(patch.country).toBe("es");
    expect(patch.accessVerified).toBe(true);
    expect(patch.propertyLocked).toBe(true);
  });
});

describe("phase 2 OTP API routes", () => {
  let storePath = "";
  let invitationId = "";
  const invitedEmail = "elena.marquez@hotelabc.com";

  beforeEach(async () => {
    storePath = mkdtempSync(join(tmpdir(), "bookmax-p2-"));
    const file = join(storePath, "invitations.json");
    process.env.BOOKMAX_INVITATION_STORE_PATH = file;
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY;

    setInvitationSingletonsForTests({ store: null, service: null });
    const store = createFileInvitationStore(file);
    const service = createInvitationService(store, { baseUrl: "http://localhost:3000" });
    setInvitationSingletonsForTests({ store, service });

    const created = await service.createInvitation({
      invitedEmail,
      contactName: "Elena Márquez",
      propertyName: "Hotel ABC Barcelona",
      country: "Spain",
      hotelGroupOrBrand: "Hotel ABC Group",
      expiresAt: "2099-12-31T00:00:00.000Z",
    });
    invitationId = created.invitation.id;

    authMocks.signInWithOtp.mockReset();
    authMocks.verifyOtp.mockReset();
  });

  afterEach(() => {
    setInvitationSingletonsForTests({ store: null, service: null });
    delete process.env.BOOKMAX_INVITATION_STORE_PATH;
    rmSync(storePath, { recursive: true, force: true });
  });

  it("sends OTP only to the invitation email", async () => {
    authMocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    const { POST } = await import("@/app/api/implementation/otp/send/route");
    const request = new NextRequest("http://localhost:3000/api/implementation/otp/send", {
      method: "POST",
      headers: { cookie: `${INVITATION_COOKIE}=${invitationId}` },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(authMocks.signInWithOtp).toHaveBeenCalledWith({
      email: invitedEmail,
      options: { shouldCreateUser: true },
    });
  });

  it("rejects send without invitation cookie", async () => {
    const { POST } = await import("@/app/api/implementation/otp/send/route");
    const request = new NextRequest("http://localhost:3000/api/implementation/otp/send", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("invalid_input");
  });

  it("verifies OTP, binds auth user, and sets claim cookie", async () => {
    authMocks.verifyOtp.mockResolvedValue({
      data: {
        user: { id: "auth-user-1", email: invitedEmail },
        session: { access_token: "a", refresh_token: "r" },
      },
      error: null,
    });

    const { POST } = await import("@/app/api/implementation/otp/verify/route");
    const request = new NextRequest("http://localhost:3000/api/implementation/otp/verify", {
      method: "POST",
      headers: {
        cookie: `${INVITATION_COOKIE}=${invitationId}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "123456" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invitation.authUserId).toBe("auth-user-1");
    expect(body.intakePatch.country).toBe("es");
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      email: invitedEmail,
      token: "123456",
      type: "email",
    });

    const claim = response.cookies.get(INVITATION_CLAIM_COOKIE)?.value;
    expect(verifyInvitationClaim(claim, ENV)).toEqual({
      invitationId,
      authUserId: "auth-user-1",
    });
  });

  it("fails cleanly for wrong OTP", async () => {
    authMocks.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Token has expired or is invalid" },
    });

    const { POST } = await import("@/app/api/implementation/otp/verify/route");
    const request = new NextRequest("http://localhost:3000/api/implementation/otp/verify", {
      method: "POST",
      headers: {
        cookie: `${INVITATION_COOKIE}=${invitationId}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "000000" }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe("otp_invalid");
    expect(response.cookies.get(INVITATION_CLAIM_COOKIE)).toBeUndefined();
  });
});

describe("phase 2 proxy session gate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY;
    authMocks.getUser.mockReset();
  });

  it("redirects unauthenticated setup requests to sign-in", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/implementation/property");
    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/implementation");
  });

  it("allows authenticated requests with a matching invitation claim", async () => {
    const claim = signInvitationClaim(
      { invitationId: "inv-9", authUserId: "user-9" },
      ENV,
    );
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-9", email: "elena.marquez@hotelabc.com" } },
      error: null,
    });
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/implementation/property", {
      headers: {
        cookie: `${INVITATION_COOKIE}=inv-9; ${INVITATION_CLAIM_COOKIE}=${claim}`,
      },
    });
    const response = await proxy(request);
    expect(response.status).toBe(200);
  });

  it("does not gate the sign-in route", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/implementation");
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(authMocks.getUser).not.toHaveBeenCalled();
  });
});
