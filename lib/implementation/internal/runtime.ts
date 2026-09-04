import { createInternalSubmissionService, type InternalSubmissionService } from "@/lib/implementation/internal/service";
import { createSupabaseAuditStore } from "@/lib/implementation/internal/supabase-audit-store";
import { createSupabaseQueueStore } from "@/lib/implementation/internal/supabase-queue-store";
import { createSupabaseStaffStore } from "@/lib/implementation/internal/supabase-staff-store";
import type { InternalAuditStore } from "@/lib/implementation/internal/audit-store";
import type { InternalQueueStore } from "@/lib/implementation/internal/queue-store";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";
import { getCredentialStore } from "@/lib/setup/credentials/runtime";
import type { CredentialStore } from "@/lib/setup/credentials/store";
import { createServiceClient } from "@/lib/supabase/service";

let staffSingleton: InternalStaffStore | null = null;
let queueSingleton: InternalQueueStore | null = null;
let auditSingleton: InternalAuditStore | null = null;
let serviceSingleton: InternalSubmissionService | null = null;
let credentialOverride: CredentialStore | null | undefined;

export function getStaffStore(): InternalStaffStore {
  if (!staffSingleton) {
    staffSingleton = createSupabaseStaffStore(createServiceClient());
  }
  return staffSingleton;
}

export function getQueueStore(): InternalQueueStore {
  if (!queueSingleton) {
    queueSingleton = createSupabaseQueueStore(createServiceClient());
  }
  return queueSingleton;
}

export function getAuditStore(): InternalAuditStore {
  if (!auditSingleton) {
    auditSingleton = createSupabaseAuditStore(createServiceClient());
  }
  return auditSingleton;
}

export function getInternalSubmissionService(): InternalSubmissionService {
  if (!serviceSingleton) {
    serviceSingleton = createInternalSubmissionService({
      queue: getQueueStore(),
      audit: getAuditStore(),
      credentials: credentialOverride ?? getCredentialStore(),
    });
  }
  return serviceSingleton;
}

/** Test-only: replace singletons. */
export function setInternalSingletonsForTests(input: {
  staff?: InternalStaffStore | null;
  queue?: InternalQueueStore | null;
  audit?: InternalAuditStore | null;
  credentials?: CredentialStore | null;
  service?: InternalSubmissionService | null;
}) {
  if ("staff" in input) {
    staffSingleton = input.staff ?? null;
  }
  if ("queue" in input) {
    queueSingleton = input.queue ?? null;
  }
  if ("audit" in input) {
    auditSingleton = input.audit ?? null;
  }
  if ("credentials" in input) {
    credentialOverride = input.credentials;
  }
  if ("service" in input) {
    serviceSingleton = input.service ?? null;
  } else {
    serviceSingleton = null;
  }
}
