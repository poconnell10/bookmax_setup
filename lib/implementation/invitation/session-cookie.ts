import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServerEnv } from "@/lib/supabase/env";

export const INVITATION_COOKIE = "bookmax.invitation";
export const INVITATION_CLAIM_COOKIE = "bookmax.invitation_claim";

export type InvitationClaim = {
  invitationId: string;
  authUserId: string;
};

function signingKey(source?: Record<string, string | undefined>): string {
  return getSupabaseServerEnv(source).secretKey;
}

export function signInvitationClaim(
  claim: InvitationClaim,
  source?: Record<string, string | undefined>,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      invitationId: claim.invitationId,
      authUserId: claim.authUserId,
    }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", signingKey(source)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyInvitationClaim(
  raw: string | undefined | null,
  source?: Record<string, string | undefined>,
): InvitationClaim | null {
  if (!raw) {
    return null;
  }
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = createHmac("sha256", signingKey(source)).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as InvitationClaim;
    if (!parsed.invitationId || !parsed.authUserId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function invitationCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
