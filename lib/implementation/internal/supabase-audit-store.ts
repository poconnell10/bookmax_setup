import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditInsert, InternalAuditStore } from "@/lib/implementation/internal/audit-store";
import { InternalError, type InternalAuditEvent } from "@/lib/implementation/internal/types";

const FORBIDDEN = /secret|password|token|otp|envelope|client[_-]?id|application[_-]?key/i;

type AuditRow = {
  id: string;
  event_type: InternalAuditEvent["eventType"];
  actor_user_id: string;
  implementation_id: string | null;
  submission_id: string | null;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

function sanitizeMetadata(
  metadata: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN.test(key)) {
      continue;
    }
    if (typeof value === "string" && FORBIDDEN.test(value)) {
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function mapAudit(row: AuditRow): InternalAuditEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    implementationId: row.implementation_id,
    submissionId: row.submission_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function createSupabaseAuditStore(client: SupabaseClient): InternalAuditStore {
  return {
    async insert(event: AuditInsert) {
      const { data, error } = await client
        .from("implementation_audit_events")
        .insert({
          event_type: event.eventType,
          actor_user_id: event.actorUserId,
          implementation_id: event.implementationId,
          submission_id: event.submissionId,
          metadata: sanitizeMetadata(event.metadata),
        })
        .select("id, event_type, actor_user_id, implementation_id, submission_id, metadata, created_at")
        .single();
      if (error || !data) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return mapAudit(data as AuditRow);
    },

    async listBySubmissionId(submissionId) {
      const { data, error } = await client
        .from("implementation_audit_events")
        .select("id, event_type, actor_user_id, implementation_id, submission_id, metadata, created_at")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return ((data ?? []) as AuditRow[]).map(mapAudit);
    },
  };
}
