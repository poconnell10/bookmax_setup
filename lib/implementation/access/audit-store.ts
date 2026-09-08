import type { AccessAuditEventType } from "@/lib/implementation/access/types";

export type AccessAuditInsert = {
  eventType: AccessAuditEventType;
  actorUserId: string;
  targetUserId: string;
  previousState: Record<string, string | number | boolean | null>;
  newState: Record<string, string | number | boolean | null>;
};

export type AccessAuditEvent = AccessAuditInsert & {
  id: string;
  createdAt: string;
};

export type AccessAuditStore = {
  insert(event: AccessAuditInsert): Promise<AccessAuditEvent>;
  listByTarget(targetUserId: string): Promise<AccessAuditEvent[]>;
};
