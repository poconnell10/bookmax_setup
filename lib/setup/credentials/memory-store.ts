import type { CredentialEnvelope } from "@/lib/setup/credentials/encrypt";
import type { CredentialRecord, CredentialStore } from "@/lib/setup/credentials/store";

export function createMemoryCredentialStore(): CredentialStore {
  const rows = new Map<string, CredentialRecord>();

  return {
    async findByImplementationId(implementationId) {
      return rows.get(implementationId) ?? null;
    },

    async upsert(implementationId, envelope: CredentialEnvelope) {
      const record: CredentialRecord = {
        implementationId,
        envelope,
        receivedAt: new Date().toISOString(),
      };
      rows.set(implementationId, record);
      return record;
    },
  };
}
