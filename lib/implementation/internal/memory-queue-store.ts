import { randomUUID } from "node:crypto";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/types/implementation";
import type { InternalQueueStore } from "@/lib/implementation/internal/queue-store";
import { InternalError, type CredentialReceipt, type InternalQueueRow } from "@/lib/implementation/internal/types";

export type MemoryQueueStore = InternalQueueStore & {
  putReceipt(receipt: CredentialReceipt): void;
};

export function createMemoryQueueStore(seed: {
  rows?: InternalQueueRow[];
  receipts?: CredentialReceipt[];
} = {}): MemoryQueueStore {
  const rows = new Map<string, InternalQueueRow>((seed.rows ?? []).map((row) => [row.id, row]));
  const receipts = new Map<string, CredentialReceipt>(
    (seed.receipts ?? []).map((row) => [row.implementationId, row]),
  );

  return {
    async list() {
      return [...rows.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    },

    async getById(id) {
      return rows.get(id) ?? null;
    },

    async updateWorkflow(id, status: SubmissionStatus, actorUserId) {
      if (!SUBMISSION_STATUSES.includes(status)) {
        throw new InternalError("invalid_input", "Invalid status.");
      }
      const current = rows.get(id);
      if (!current) {
        throw new InternalError("not_found", "Submission was not found.");
      }
      const updated: InternalQueueRow = {
        ...current,
        workflowStatus: status,
        workflowUpdatedAt: new Date().toISOString(),
        workflowUpdatedBy: actorUserId,
      };
      rows.set(id, updated);
      return updated;
    },

    async listCredentialReceipts(implementationIds) {
      return implementationIds
        .map((implementationId) => receipts.get(implementationId))
        .filter((row): row is CredentialReceipt => Boolean(row));
    },

    async insertFromCustomer(input) {
      const created: InternalQueueRow = {
        id: randomUUID(),
        implementationId: input.implementationId,
        record: input.record,
        submittedAt: input.submittedAt ?? input.record.submittedAt,
        workflowStatus: "Submitted",
        workflowUpdatedAt: input.submittedAt ?? input.record.submittedAt,
        workflowUpdatedBy: null,
      };
      rows.set(created.id, created);
      return created;
    },

    putReceipt(receipt: CredentialReceipt) {
      receipts.set(receipt.implementationId, receipt);
    },
  };
}
