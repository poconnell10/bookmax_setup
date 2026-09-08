import { randomUUID } from "node:crypto";
import type { AccessAuditEvent, AccessAuditInsert, AccessAuditStore } from "@/lib/implementation/access/audit-store";

const FORBIDDEN = /secret|password|token|otp|envelope|client[_-]?id|application[_-]?key/i;

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

export function createMemoryAccessAuditStore(): AccessAuditStore {
  const rows: AccessAuditEvent[] = [];
  return {
    async insert(event: AccessAuditInsert) {
      const created: AccessAuditEvent = {
        ...event,
        previousState: sanitize(event.previousState),
        newState: sanitize(event.newState),
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      rows.unshift(created);
      return created;
    },
    async listByTarget(targetUserId) {
      return rows.filter((row) => row.targetUserId === targetUserId);
    },
  };
}
