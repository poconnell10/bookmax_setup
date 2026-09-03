import "server-only";

const KEY_BYTES = 32;

export function getCredentialEncryptionKey(
  source: Record<string, string | undefined> = process.env,
): Buffer {
  if (source.NEXT_PUBLIC_CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error("Credential encryption key must not use the NEXT_PUBLIC prefix.");
  }

  const raw = source.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Credential encryption key is not configured.");
  }

  const hex = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }

  const fromBase64 = Buffer.from(hex, "base64");
  if (fromBase64.length === KEY_BYTES) {
    return fromBase64;
  }

  throw new Error("Credential encryption key must be 32 bytes (hex or base64).");
}
