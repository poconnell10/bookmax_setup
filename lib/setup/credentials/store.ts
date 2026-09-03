import type { CredentialEnvelope } from "@/lib/setup/credentials/encrypt";

export type CredentialRecord = {
  implementationId: string;
  envelope: CredentialEnvelope;
  receivedAt: string;
};

export type CredentialStore = {
  findByImplementationId(implementationId: string): Promise<CredentialRecord | null>;
  upsert(implementationId: string, envelope: CredentialEnvelope): Promise<CredentialRecord>;
};
