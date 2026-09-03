import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getCredentialEncryptionKey } from "@/lib/setup/credentials/env";

export const CREDENTIAL_ALG = "aes-256-gcm";
const IV_LENGTH = 12;

export type CredentialSecrets = {
  clientId: string;
  clientSecret: string;
  applicationKey: string;
};

export type CredentialEnvelope = {
  v: 1;
  alg: typeof CREDENTIAL_ALG;
  iv: string;
  tag: string;
  data: string;
};

export function encryptCredentialSecrets(
  secrets: CredentialSecrets,
  source: Record<string, string | undefined> = process.env,
): CredentialEnvelope {
  const key = getCredentialEncryptionKey(source);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(CREDENTIAL_ALG, key, iv);
  const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: CREDENTIAL_ALG,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

/** Test/operator helper. Customer APIs must not return decrypted values. */
export function decryptCredentialSecrets(
  envelope: CredentialEnvelope,
  source: Record<string, string | undefined> = process.env,
): CredentialSecrets {
  if (envelope.v !== 1 || envelope.alg !== CREDENTIAL_ALG) {
    throw new Error("Unsupported credential envelope.");
  }
  const key = getCredentialEncryptionKey(source);
  const decipher = createDecipheriv(
    CREDENTIAL_ALG,
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<CredentialSecrets>;
  return {
    clientId: typeof parsed.clientId === "string" ? parsed.clientId : "",
    clientSecret: typeof parsed.clientSecret === "string" ? parsed.clientSecret : "",
    applicationKey: typeof parsed.applicationKey === "string" ? parsed.applicationKey : "",
  };
}
