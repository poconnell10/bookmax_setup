import { randomUUID } from "node:crypto";
import type { AuditInsert, InternalAuditStore } from "@/lib/implementation/internal/audit-store";
import type { InternalAuditEvent } from "@/lib/implementation/internal/types";

const FORBIDDEN = /secret|password|token|otp|envelope|client[_-]?id|application[_-]?key/i;

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

export function createMemoryAuditStore(): InternalAuditStore {
  const rows: InternalAuditEvent[] = [];

  return {
    async insert(event: AuditInsert) {
      const created: InternalAuditEvent = {
        id: randomUUID(),
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        implementationId: event.implementationId,
        submissionId: event.submissionId,
        metadata: sanitizeMetadata(event.metadata),
        createdAt: new Date().toISOString(),
      };
      rows.push(created);
      return created;
    },

    async listBySubmissionId(submissionId) {
      return rows
        .filter((row) => row.submissionId === submissionId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
