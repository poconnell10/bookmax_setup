import { createInvitationService } from "@/lib/implementation/invitation/service";
import type { InvitationService } from "@/lib/implementation/invitation/service";
import { createSupabaseInvitationStore } from "@/lib/implementation/invitation/supabase-store";
import type { InvitationStore } from "@/lib/implementation/invitation/store";
import { createServiceClient } from "@/lib/supabase/service";

let storeSingleton: InvitationStore | null = null;
let serviceSingleton: InvitationService | null = null;

export function getInvitationStore(): InvitationStore {
  if (!storeSingleton) {
    storeSingleton = createSupabaseInvitationStore(createServiceClient());
  }
  return storeSingleton;
}

export function getInvitationService(): InvitationService {
  if (!serviceSingleton) {
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    serviceSingleton = createInvitationService(getInvitationStore(), { baseUrl });
  }
  return serviceSingleton;
}

/** Test-only: replace singletons. */
export function setInvitationSingletonsForTests(input: {
  store?: InvitationStore | null;
  service?: InvitationService | null;
}) {
  if ("store" in input) {
    storeSingleton = input.store ?? null;
  }
  if ("service" in input) {
    serviceSingleton = input.service ?? null;
  }
}
