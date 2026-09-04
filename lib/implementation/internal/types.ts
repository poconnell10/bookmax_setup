import type { SetupSubmissionRecord } from "@/lib/setup/intake";
import type { CredentialLabel, SubmissionRecord, SubmissionStatus } from "@/types/implementation";

export const INTERNAL_ROLES = ["viewer", "engineer"] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export const INTERNAL_AUDIT_EVENTS = ["status_changed", "credential_opened"] as const;
export type InternalAuditEventType = (typeof INTERNAL_AUDIT_EVENTS)[number];

export type InternalStaff = {
  userId: string;
  role: InternalRole;
  createdAt: string;
};

export type InternalAuditEvent = {
  id: string;
  eventType: InternalAuditEventType;
  actorUserId: string;
  implementationId: string | null;
  submissionId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type InternalQueueRow = {
  id: string;
  implementationId: string;
  record: SetupSubmissionRecord;
  submittedAt: string;
  workflowStatus: SubmissionStatus;
  workflowUpdatedAt: string;
  workflowUpdatedBy: string | null;
};

export type CredentialReceipt = {
  implementationId: string;
  receivedAt: string;
};

export type InternalSubmissionView = SubmissionRecord & {
  credentials_received_at: string | null;
  credential_type: CredentialLabel | null;
  can_open_credentials: boolean;
  can_update_status: boolean;
};

export type RevealedCredentials = {
  submissionId: string;
  implementationId: string;
  credentialType: CredentialLabel;
  receivedAt: string;
  clientId: string;
  clientSecret: string;
  applicationKey: string;
};

export class InternalError extends Error {
  readonly code: "forbidden" | "not_found" | "invalid_input" | "unavailable";

  constructor(
    code: "forbidden" | "not_found" | "invalid_input" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "InternalError";
    this.code = code;
  }
}
