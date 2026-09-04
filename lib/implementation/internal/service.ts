import { logAccess } from "@/lib/access/log";
import { decryptCredentialSecrets } from "@/lib/setup/credentials/encrypt";
import type { CredentialStore } from "@/lib/setup/credentials/store";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/types/implementation";
import type { InternalAuditStore } from "@/lib/implementation/internal/audit-store";
import { toInternalSubmissionView, credentialTypeForIntake } from "@/lib/implementation/internal/map-record";
import type { InternalQueueStore } from "@/lib/implementation/internal/queue-store";
import { InternalError, type InternalStaff, type InternalSubmissionView, type RevealedCredentials } from "@/lib/implementation/internal/types";

export function createInternalSubmissionService(deps: {
  queue: InternalQueueStore;
  audit: InternalAuditStore;
  credentials: CredentialStore;
}) {
  async function receiptsByImplementation(rows: { implementationId: string }[]) {
    const receipts = await deps.queue.listCredentialReceipts(rows.map((row) => row.implementationId));
    return new Map(receipts.map((row) => [row.implementationId, row]));
  }

  async function list(staff: InternalStaff): Promise<InternalSubmissionView[]> {
    const rows = await deps.queue.list();
    const receipts = await receiptsByImplementation(rows);
    return rows.map((row) =>
      toInternalSubmissionView(row, receipts.get(row.implementationId) ?? null, staff.role),
    );
  }

  async function get(staff: InternalStaff, id: string): Promise<InternalSubmissionView> {
    const row = await deps.queue.getById(id);
    if (!row) {
      throw new InternalError("not_found", "Submission was not found.");
    }
    const receipts = await receiptsByImplementation([row]);
    return toInternalSubmissionView(row, receipts.get(row.implementationId) ?? null, staff.role);
  }

  async function updateStatus(
    staff: InternalStaff,
    id: string,
    status: SubmissionStatus,
  ): Promise<InternalSubmissionView> {
    if (staff.role !== "engineer") {
      throw new InternalError("forbidden", "You cannot change implementation status.");
    }
    if (!SUBMISSION_STATUSES.includes(status)) {
      throw new InternalError("invalid_input", "Invalid status.");
    }
    const current = await deps.queue.getById(id);
    if (!current) {
      throw new InternalError("not_found", "Submission was not found.");
    }
    const updated = await deps.queue.updateWorkflow(id, status, staff.userId);
    await deps.audit.insert({
      eventType: "status_changed",
      actorUserId: staff.userId,
      implementationId: updated.implementationId,
      submissionId: updated.id,
      metadata: {
        from: current.workflowStatus,
        to: status,
      },
    });
    logAccess("internal_status_changed", {
      submissionId: updated.id,
      implementationId: updated.implementationId,
      from: current.workflowStatus,
      to: status,
    });
    return get(staff, id);
  }

  async function revealCredentials(staff: InternalStaff, id: string): Promise<RevealedCredentials> {
    if (staff.role !== "engineer") {
      throw new InternalError("forbidden", "You cannot open secure credentials.");
    }
    const row = await deps.queue.getById(id);
    if (!row) {
      throw new InternalError("not_found", "Submission was not found.");
    }
    const stored = await deps.credentials.findByImplementationId(row.implementationId);
    if (!stored) {
      throw new InternalError("not_found", "Credentials have not been received.");
    }
    const secrets = decryptCredentialSecrets(stored.envelope);
    const credentialType = credentialTypeForIntake(row.record.intake);
    await deps.audit.insert({
      eventType: "credential_opened",
      actorUserId: staff.userId,
      implementationId: row.implementationId,
      submissionId: row.id,
      metadata: {
        credentialType,
        receivedAt: stored.receivedAt,
      },
    });
    logAccess("internal_credential_opened", {
      submissionId: row.id,
      implementationId: row.implementationId,
      credentialType,
    });
    return {
      submissionId: row.id,
      implementationId: row.implementationId,
      credentialType,
      receivedAt: stored.receivedAt,
      clientId: secrets.clientId,
      clientSecret: secrets.clientSecret,
      applicationKey: secrets.applicationKey,
    };
  }

  return { list, get, updateStatus, revealCredentials };
}

export type InternalSubmissionService = ReturnType<typeof createInternalSubmissionService>;
