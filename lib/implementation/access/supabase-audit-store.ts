import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessAuditEvent, AccessAuditInsert, AccessAuditStore } from "@/lib/implementation/access/audit-store";
import { ACCESS_AUDIT_EVENTS } from "@/lib/implementation/access/types";
import { InternalError } from "@/lib/implementation/internal/types";

const FORBIDDEN = /secret|password|token|otp|envelope|client[_-]?id|application[_-]?key/i;

type Row = {
  id: string;
  event_type: string;
  actor_user_id: string;
  target_user_id: string;
  previous_state: Record<string, string | number | boolean | null>;
  new_state: Record<string, string | number | boolean | null>;
  created_at: string;
};

function sanitize(state: Record<string, string | number | boolean | null>) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(state)) {
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

function mapRow(row: Row): AccessAuditEvent {
  if (!(ACCESS_AUDIT_EVENTS as readonly string[]).includes(row.event_type)) {
    throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
  }
  return {
    id: row.id,
    eventType: row.event_type as AccessAuditEvent["eventType"],
    actorUserId: row.actor_user_id,
    targetUserId: row.target_user_id,
    previousState: row.previous_state ?? {},
    newState: row.new_state ?? {},
    createdAt: row.created_at,
  };
}

export function createSupabaseAccessAuditStore(client: SupabaseClient): AccessAuditStore {
  return {
    async insert(event: AccessAuditInsert) {
      const { data, error } = await client
        .from("access_audit_events")
        .insert({
          event_type: event.eventType,
          actor_user_id: event.actorUserId,
          target_user_id: event.targetUserId,
          previous_state: sanitize(event.previousState),
          new_state: sanitize(event.newState),
        })
        .select("id, event_type, actor_user_id, target_user_id, previous_state, new_state, created_at")
        .single();
      if (error || !data) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return mapRow(data as Row);
    },

    async listByTarget(targetUserId) {
      const { data, error } = await client
        .from("access_audit_events")
        .select("id, event_type, actor_user_id, target_user_id, previous_state, new_state, created_at")
        .eq("target_user_id", targetUserId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return ((data ?? []) as Row[]).map(mapRow);
    },
  };
}
