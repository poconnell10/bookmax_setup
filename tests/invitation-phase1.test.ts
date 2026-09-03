import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createInvitationService,
  createMemoryInvitationStore,
  generateInvitationToken,
  hashInvitationToken,
  InvitationError,
} from "@/lib/implementation/invitation";

function futureExpiry(days = 14): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function seedInvitation(
  overrides: Partial<{
    email: string;
    property: string;
  }> = {},
) {
  const store = createMemoryInvitationStore();
  const service = createInvitationService(store, { baseUrl: "http://localhost:3000" });
  const created = await service.createInvitation({
    propertyName: overrides.property ?? "Hotel ABC Barcelona",
    country: "Spain",
    contactName: "Elena Márquez",
    invitedEmail: overrides.email ?? "elena.marquez@hotelabc.com",
    hotelGroupOrBrand: "Hotel ABC Group",
    expiresAt: futureExpiry(),
  });
  return { store, service, created };
}

describe("invitation tokens", () => {
  it("generates cryptographically random tokens of sufficient entropy", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(Buffer.from(a, "base64url").length).toBeGreaterThanOrEqual(32);
  });

  it("stores hash not raw token in the invitation record", async () => {
    const { store, created } = await seedInvitation();
    const stored = await store.findInvitationById(created.invitation.id);
    expect(stored).toBeTruthy();
    expect(stored!.tokenHash).toBe(hashInvitationToken(created.rawToken));
    expect(JSON.stringify(stored)).not.toContain(created.rawToken);
    expect(created.invitation).not.toHaveProperty("tokenHash");
    expect(created.invitation).not.toHaveProperty("rawToken");
  });

  it("resolves the same raw token to the correct invitation", async () => {
    const { service, created } = await seedInvitation();
    const resolved = await service.resolveByRawToken(created.rawToken);
    expect(resolved.id).toBe(created.invitation.id);
    expect(resolved.propertyName).toBe("Hotel ABC Barcelona");
  });

  it("does not resolve an invalid token", async () => {
    const { service } = await seedInvitation();
    await expect(service.resolveByRawToken(generateInvitationToken())).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("invitation lifecycle authorization", () => {
  it("rejects expired invitations by expires_at", async () => {
    const { store, service, created } = await seedInvitation();
    await store.updateInvitation(created.invitation.id, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await expect(service.resolveByRawToken(created.rawToken)).rejects.toMatchObject({
      code: "expired",
    });
  });

  it("rejects revoked invitations", async () => {
    const { store, service, created } = await seedInvitation();
    await store.updateInvitation(created.invitation.id, { status: "revoked" });
    await expect(service.resolveByRawToken(created.rawToken)).rejects.toMatchObject({
      code: "revoked",
    });
  });

  it("binds auth user when email matches and refuses rebind to another user", async () => {
    const { service, created } = await seedInvitation({
      email: "elena.marquez@hotelabc.com",
    });

    await expect(
      service.bindAuthUser(created.invitation.id, {
        authUserId: "user-a",
        email: "other@hotelabc.com",
      }),
    ).rejects.toMatchObject({ code: "email_mismatch" });

    const bound = await service.bindAuthUser(created.invitation.id, {
      authUserId: "user-a",
      email: "elena.marquez@hotelabc.com",
    });
    expect(bound.authUserId).toBe("user-a");
    expect(bound.status).toBe("verified");

    await expect(
      service.bindAuthUser(created.invitation.id, {
        authUserId: "user-b",
        email: "elena.marquez@hotelabc.com",
      }),
    ).rejects.toMatchObject({ code: "rebind_conflict" });

    const again = await service.bindAuthUser(created.invitation.id, {
      authUserId: "user-a",
      email: "Elena.Marquez@hotelabc.com",
    });
    expect(again.authUserId).toBe("user-a");
  });

  it("prevents user A from accessing invitation or draft owned by user B", async () => {
    const { service, created } = await seedInvitation();
    await service.bindAuthUser(created.invitation.id, {
      authUserId: "user-a",
      email: "elena.marquez@hotelabc.com",
    });
    await service.saveDraft(
      created.invitation.id,
      {
        authUserId: "user-a",
        email: "elena.marquez@hotelabc.com",
      },
      { step: "property" },
    );

    await expect(
      service.getOwnedInvitation(created.invitation.id, {
        authUserId: "user-b",
        email: "other@example.com",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      service.getDraft(created.invitation.id, {
        authUserId: "user-b",
        email: "other@example.com",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("keeps one active draft per invitation", async () => {
    const { store, service, created } = await seedInvitation();
    const principal = {
      authUserId: "user-a",
      email: "elena.marquez@hotelabc.com",
    };
    await service.bindAuthUser(created.invitation.id, principal);
    const first = await service.saveDraft(created.invitation.id, principal, { v: 1 });
    const second = await service.saveDraft(created.invitation.id, principal, { v: 2 });
    expect(second.id).toBe(first.id);
    const loaded = await store.findDraftByInvitationId(created.invitation.id);
    expect(loaded?.payload).toEqual({ v: 2 });
  });

  it("prevents duplicate final submissions", async () => {
    const { service, created } = await seedInvitation();
    const principal = {
      authUserId: "user-a",
      email: "elena.marquez@hotelabc.com",
    };
    await service.bindAuthUser(created.invitation.id, principal);
    await service.submitFinal(created.invitation.id, principal, {
      property: "Hotel ABC Barcelona",
    });
    await expect(
      service.submitFinal(created.invitation.id, principal, {
        property: "Hotel ABC Barcelona",
      }),
    ).rejects.toMatchObject({ code: "duplicate_submission" });
  });
});

describe("phase 1 security baselines", () => {
  it("keeps service credentials out of the browser client module", () => {
    const clientSource = readFileSync(
      path.join(process.cwd(), "lib/supabase/client.ts"),
      "utf8",
    );
    expect(clientSource).not.toMatch(/SUPABASE_SECRET_KEY|SERVICE_ROLE|createServiceClient/);
    expect(clientSource).toContain("createBrowserClient");

    const serviceSource = readFileSync(
      path.join(process.cwd(), "lib/supabase/service.ts"),
      "utf8",
    );
    expect(serviceSource).toContain('import "server-only"');
  });

  it("migration stores token_hash, enables RLS, and forbids permissive policies", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260831220000_implementation_invitation.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");
    const sqlWithoutComments = sql
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");

    expect(sql).toMatch(/create table if not exists public\.implementation_invitation/i);
    expect(sql).toMatch(/token_hash text not null/i);
    expect(sqlWithoutComments).not.toMatch(/\btoken text\b/i);
    expect(sql).toMatch(/create table if not exists public\.implementation_draft/i);
    expect(sql).toMatch(/create table if not exists public\.implementation_submission/i);
    expect(sql).toMatch(/unique \(invitation_id\)/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/auth_user_id is not null and auth_user_id = auth\.uid\(\)/i);
    expect(sqlWithoutComments).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sqlWithoutComments).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    expect(sql).toMatch(/implementation_invitation_select_own/);
    expect(sql).toMatch(/implementation_draft_select_own/);
    expect(sql).toMatch(/implementation_submission_select_own/);
  });

  it("exposes InvitationError codes for callers without leaking hashes", async () => {
    const { service } = await seedInvitation();
    try {
      await service.resolveByRawToken("not-a-real-token-value-000000000000000000000000");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(InvitationError);
      expect(String(error)).not.toMatch(/token_hash|sha-256|SUPABASE_SECRET/i);
    }
  });
});
