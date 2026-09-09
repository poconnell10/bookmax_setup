import { createAccessDirectoryService, type AccessDirectoryService } from "@/lib/implementation/access/service";
import { createMemoryAccessAuditStore } from "@/lib/implementation/access/memory-audit-store";
import { createSupabaseAccessAuditStore } from "@/lib/implementation/access/supabase-audit-store";
import { createMemoryIdentityStore, type IdentityStore } from "@/lib/implementation/access/identity-store";
import { createSupabaseIdentityStore } from "@/lib/implementation/access/supabase-identity-store";
import type { AccessAuditStore } from "@/lib/implementation/access/audit-store";
import {
  createMemoryTransitionStore,
  type AccessTransitionStore,
} from "@/lib/implementation/access/transition-store";
import { createSupabaseTransitionStore } from "@/lib/implementation/access/supabase-transition-store";
import { getCustomerStore } from "@/lib/implementation/customer/runtime";
import { getStaffStore } from "@/lib/implementation/internal/runtime";
import { createServiceClient } from "@/lib/supabase/service";

let identitySingleton: IdentityStore | null = null;
let accessAuditSingleton: AccessAuditStore | null = null;
let transitionSingleton: AccessTransitionStore | null = null;
let directorySingleton: AccessDirectoryService | null = null;

export function getIdentityStore(): IdentityStore {
  if (!identitySingleton) {
    identitySingleton = createSupabaseIdentityStore(createServiceClient());
  }
  return identitySingleton;
}

export function getAccessAuditStore(): AccessAuditStore {
  if (!accessAuditSingleton) {
    accessAuditSingleton = createSupabaseAccessAuditStore(createServiceClient());
  }
  return accessAuditSingleton;
}

export function getAccessTransitionStore(): AccessTransitionStore {
  if (!transitionSingleton) {
    transitionSingleton = createSupabaseTransitionStore(createServiceClient());
  }
  return transitionSingleton;
}

export function getAccessDirectoryService(): AccessDirectoryService {
  if (!directorySingleton) {
    directorySingleton = createAccessDirectoryService({
      identities: getIdentityStore(),
      staff: getStaffStore(),
      customers: getCustomerStore(),
      audit: getAccessAuditStore(),
      transitions: getAccessTransitionStore(),
    });
  }
  return directorySingleton;
}

export function setAccessSingletonsForTests(input: {
  identities?: IdentityStore | null;
  audit?: AccessAuditStore | null;
  transitions?: AccessTransitionStore | null;
  directory?: AccessDirectoryService | null;
}) {
  if ("identities" in input) {
    identitySingleton = input.identities ?? null;
  }
  if ("audit" in input) {
    accessAuditSingleton = input.audit ?? null;
  }
  if ("transitions" in input) {
    transitionSingleton = input.transitions ?? null;
  }
  if ("directory" in input) {
    directorySingleton = input.directory ?? null;
  } else {
    directorySingleton = null;
  }
}

export { createMemoryAccessAuditStore, createMemoryIdentityStore, createMemoryTransitionStore };
