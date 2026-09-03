import { createCustomerService, type CustomerService } from "@/lib/implementation/customer/service";
import { createSupabaseCustomerStore } from "@/lib/implementation/customer/supabase-store";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import { createServiceClient } from "@/lib/supabase/service";

let storeSingleton: CustomerStore | null = null;
let serviceSingleton: CustomerService | null = null;

export function getCustomerStore(): CustomerStore {
  if (!storeSingleton) {
    storeSingleton = createSupabaseCustomerStore(createServiceClient());
  }
  return storeSingleton;
}

export function getCustomerService(): CustomerService {
  if (!serviceSingleton) {
    serviceSingleton = createCustomerService(getCustomerStore());
  }
  return serviceSingleton;
}

/** Test-only: replace singletons. */
export function setCustomerSingletonsForTests(input: {
  store?: CustomerStore | null;
  service?: CustomerService | null;
}) {
  if ("store" in input) {
    storeSingleton = input.store ?? null;
  }
  if ("service" in input) {
    serviceSingleton = input.service ?? null;
  }
}
