import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvitationService } from "@/lib/implementation/invitation/service";
import { createMemoryInvitationStore } from "@/lib/implementation/invitation/memory-store";
import { createSupabaseInvitationStore } from "@/lib/implementation/invitation/supabase-store";
import { setInvitationSingletonsForTests } from "@/lib/implementation/invitation/runtime";
import {
  INVITATION_CLAIM_COOKIE,
  INVITATION_COOKIE,
  signInvitationClaim,
} from "@/lib/implementation/invitation/session-cookie";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "secret-test-key-phase3",
};

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

function futureExpiry() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

function mockFrom(handlers: Record<string, unknown>) {
  return {
    from(table: string) {
      const handler = handlers[table];
      if (!handler || typeof handler !== "function") {
        throw new Error(`unexpected table ${table}`);
      }
      return handler();
    },
  };
}

describe("supabase invitation store adapter", () => {
  it("maps invitation rows and never writes a raw token column", async () => {
    const inserted: Record<string, unknown>[] = [];
    const client = mockFrom({
      implementation_invitation: () => ({
        insert(row: Record<string, unknown>) {
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({
                data: {
                  ...row,
                  hotel_group_or_brand: row.hotel_group_or_brand,
                },
                error: null,
              }),
            }),
          };
        },
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "inv-1",
                token_hash: "abc123",
                invited_email: "a@hotel.test",
                contact_name: "Ada",
                property_name: "Hotel A",
                country: "Spain",
                hotel_group_or_brand: null,
                status: "invited",
                expires_at: futureExpiry(),
                auth_user_id: null,
                verified_at: null,
                submitted_at: null,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const store = createSupabaseInvitationStore(client as never);
    const created = await store.insertInvitation({
      id: "inv-1",
      tokenHash: "abc123",
      invitedEmail: "a@hotel.test",
      contactName: "Ada",
      propertyName: "Hotel A",
      country: "Spain",
      hotelGroupOrBrand: null,
      status: "invited",
      expiresAt: futureExpiry(),
      authUserId: null,
      verifiedAt: null,
      submittedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(created.tokenHash).toBe("abc123");
    expect(inserted[0]).not.toHaveProperty("token");
    expect(inserted[0]).toHaveProperty("token_hash", "abc123");
    expect(JSON.stringify(inserted[0])).not.toContain("rawToken");
  });

  it("maps unique submission conflicts to duplicate_submission", async () => {
    const client = mockFrom({
      implementation_submission: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { code: "23505", message: "duplicate key" },
            }),
          }),
        }),
      }),
    });

    const store = createSupabaseInvitationStore(client as never);
    await expect(
      store.insertSubmission({ invitationId: "inv-1", record: { ok: true } }),
    ).rejects.toMatchObject({ code: "duplicate_submission" });
  });
});

describe("customer draft and submit authorization", () => {
  const invitedEmail = "ada@hotela.test";
  let invitationId = "";

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY;

    const store = createMemoryInvitationStore();
    const service = createInvitationService(store, { baseUrl: "http://localhost:3000" });
    setInvitationSingletonsForTests({ store, service });

    const created = await service.createInvitation({
      invitedEmail,
      contactName: "Ada",
      propertyName: "Hotel A",
      country: "Spain",
      hotelGroupOrBrand: "Group A",
      expiresAt: futureExpiry(),
    });
    invitationId = created.invitation.id;
    await service.bindAuthUser(invitationId, { authUserId: "user-a", email: invitedEmail });
    authMocks.getUser.mockReset();
  });

  afterEach(() => {
    setInvitationSingletonsForTests({ store: null, service: null });
  });

  function cookiesFor(userId: string, inviteId = invitationId) {
    const claim = signInvitationClaim({ invitationId: inviteId, authUserId: userId }, ENV);
    return `${INVITATION_COOKIE}=${inviteId}; ${INVITATION_CLAIM_COOKIE}=${claim}`;
  }

  it("rejects unauthenticated draft reads", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { GET } = await import("@/app/api/implementation/draft/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/implementation/draft"));
    expect(response.status).toBe(403);
  });

  it("ignores client-supplied invitation identity when saving a draft", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a", email: invitedEmail } },
      error: null,
    });
    const { POST } = await import("@/app/api/implementation/draft/route");
    const request = new NextRequest("http://localhost:3000/api/implementation/draft", {
      method: "POST",
      headers: {
        cookie: cookiesFor("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        draft: {
          invitation_id: "00000000-0000-0000-0000-000000000099",
          auth_user_id: "user-b",
          invited_email: "intruder@evil.test",
          contactName: "Hacker",
          properties: ["Other Hotel"],
          technicalContact: "Jane",
        },
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draftId).toBe(invitationId);

    const { GET } = await import("@/app/api/implementation/draft/route");
    const loaded = await GET(
      new NextRequest("http://localhost:3000/api/implementation/draft?id=other-draft", {
        headers: { cookie: cookiesFor("user-a") },
      }),
    );
    const payload = await loaded.json();
    expect(payload.draft.properties).toEqual(["Hotel A"]);
    expect(payload.draft.contactEmail).toBe(invitedEmail);
    expect(payload.draft.technicalContact).toBe("Jane");
    expect(payload.draft.invitation_id).toBeUndefined();
    expect(payload.draft.auth_user_id).toBeUndefined();
  });

  it("does not let user A submit as invitation B", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a", email: invitedEmail } },
      error: null,
    });
    const { POST } = await import("@/app/api/implementation/submit/route");
    const request = new NextRequest("http://localhost:3000/api/implementation/submit", {
      method: "POST",
      headers: {
        cookie: cookiesFor("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        record: {
          invitation_id: "invite-b",
          organisation: "Group B",
          properties: ["Hotel B"],
          primary_contact_email: "b@hotelb.test",
        },
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.submissionId).toBeTruthy();

    const store = (await import("@/lib/implementation/invitation/runtime")).getInvitationStore();
    const submission = await store.findSubmissionByInvitationId(invitationId);
    expect(submission?.record.invitation_id).toBe(invitationId);
    expect(submission?.record.properties).toEqual(["Hotel A"]);
    expect(submission?.record.primary_contact_email).toBe(invitedEmail);
    expect(await store.findSubmissionByInvitationId("invite-b")).toBeNull();
  });
});

describe("phase 3 persistence wiring", () => {
  it("uses the Supabase store for customer runtime", () => {
    const runtime = readFileSync(
      path.join(process.cwd(), "lib/implementation/invitation/runtime.ts"),
      "utf8",
    );
    expect(runtime).toContain("createSupabaseInvitationStore");
    expect(runtime).not.toContain("createFileInvitationStore");
    expect(runtime).not.toContain("invitations-local.json");
  });

  it("keeps customer draft and submit APIs off prototypePersistence", () => {
    const draft = readFileSync(
      path.join(process.cwd(), "app/api/implementation/draft/route.ts"),
      "utf8",
    );
    const submit = readFileSync(
      path.join(process.cwd(), "app/api/implementation/submit/route.ts"),
      "utf8",
    );
    expect(draft).not.toMatch(/prototypePersistence/);
    expect(submit).not.toMatch(/prototypePersistence/);
    expect(draft).toContain("requireCustomerInvitationApi");
    expect(submit).toContain("requireCustomerInvitationApi");
  });

  it("switches the invitation CLI to Supabase without printing secrets", () => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts/create-invitation.ts"),
      "utf8",
    );
    expect(source).toContain("createSupabaseInvitationStore");
    expect(source).not.toContain("createFileInvitationStore");
    expect(source).not.toContain("invitations-local.json");
    const printed = [...source.matchAll(/console\.log\((.*)\)/g)].map((match) => match[1]).join("\n");
    expect(printed).not.toMatch(/tokenHash|token_hash|SUPABASE_SECRET|service key|secretKey/i);
    expect(printed).toContain("Invitation ID:");
    expect(printed).toContain("Secure invitation URL:");
  });

  it("keeps RLS policies free of unrestricted true predicates", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260831220000_implementation_invitation.sql"),
      "utf8",
    )
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });
});
