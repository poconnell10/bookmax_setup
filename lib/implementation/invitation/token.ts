import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Cryptographically secure raw invitation bearer token (URL-safe). */
export function generateInvitationToken(bytes = 32): string {
  if (bytes < 32) {
    throw new Error("Invitation tokens must be at least 32 bytes.");
  }
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest of the raw token. Persist this; never the raw token. */
export function hashInvitationToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") {
    throw new Error("Invitation token is required.");
  }
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function invitationTokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function buildInvitationUrl(baseUrl: string, rawToken: string): string {
  const root = baseUrl.replace(/\/+$/, "");
  return `${root}/implementation/invite/${encodeURIComponent(rawToken)}`;
}
