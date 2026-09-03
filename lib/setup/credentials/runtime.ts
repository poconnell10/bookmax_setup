import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { createCredentialService, type CredentialService } from "@/lib/setup/credentials/service";
import { createSupabaseCredentialStore } from "@/lib/setup/credentials/supabase-store";
import type { CredentialStore } from "@/lib/setup/credentials/store";
import { createServiceClient } from "@/lib/supabase/service";

let storeSingleton: CredentialStore | null = null;
let serviceSingleton: CredentialService | null = null;

export function getCredentialStore(): CredentialStore {
  if (!storeSingleton) {
    storeSingleton = createSupabaseCredentialStore(createServiceClient());
  }
  return storeSingleton;
}

export function getCredentialService(): CredentialService {
  if (!serviceSingleton) {
    serviceSingleton = createCredentialService(getCredentialStore(), getCustomerService());
  }
  return serviceSingleton;
}

/** Test-only: replace singletons. */
export function setCredentialSingletonsForTests(input: {
  store?: CredentialStore | null;
  service?: CredentialService | null;
}) {
  if ("store" in input) {
    storeSingleton = input.store ?? null;
  }
  if ("service" in input) {
    serviceSingleton = input.service ?? null;
  }
}
