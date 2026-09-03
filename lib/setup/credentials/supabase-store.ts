import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CredentialEnvelope } from "@/lib/setup/credentials/encrypt";
import type { CredentialRecord, CredentialStore } from "@/lib/setup/credentials/store";
import { CustomerError } from "@/lib/implementation/customer/types";

type CredentialRow = {
  implementation_id: string;
  envelope: CredentialEnvelope;
  received_at: string;
};

function mapRecord(row: CredentialRow): CredentialRecord {
  return {
    implementationId: row.implementation_id,
    envelope: row.envelope,
    receivedAt: row.received_at,
  };
}

function throwStoreError(): never {
  throw new CustomerError("unavailable", "The service is temporarily unavailable. Please try again.");
}

export function createSupabaseCredentialStore(client: SupabaseClient): CredentialStore {
  return {
    async findByImplementationId(implementationId) {
      const { data, error } = await client
        .from("implementation_credentials")
        .select("implementation_id, envelope, received_at")
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) {
        throwStoreError();
      }
      return data ? mapRecord(data as CredentialRow) : null;
    },

    async upsert(implementationId, envelope: CredentialEnvelope) {
      const receivedAt = new Date().toISOString();
      const { data: existing, error: findError } = await client
        .from("implementation_credentials")
        .select("implementation_id, envelope, received_at")
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (findError) {
        throwStoreError();
      }

      if (existing) {
        const { data, error } = await client
          .from("implementation_credentials")
          .update({ envelope, received_at: receivedAt })
          .eq("implementation_id", implementationId)
          .select("implementation_id, envelope, received_at")
          .single();
        if (error || !data) {
          throwStoreError();
        }
        return mapRecord(data as CredentialRow);
      }

      const { data, error } = await client
        .from("implementation_credentials")
        .insert({
          implementation_id: implementationId,
          envelope,
          received_at: receivedAt,
        })
        .select("implementation_id, envelope, received_at")
        .single();
      if (error || !data) {
        throwStoreError();
      }
      return mapRecord(data as CredentialRow);
    },
  };
}
