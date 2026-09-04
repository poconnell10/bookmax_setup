import type { InternalAuditEvent, InternalAuditEventType } from "@/lib/implementation/internal/types";

export type AuditInsert = {
  eventType: InternalAuditEventType;
  actorUserId: string;
  implementationId: string | null;
  submissionId: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type InternalAuditStore = {
  insert(event: AuditInsert): Promise<InternalAuditEvent>;
  listBySubmissionId(submissionId: string): Promise<InternalAuditEvent[]>;
};
