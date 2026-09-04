import type { SetupSubmissionRecord } from "@/lib/setup/intake";
import type { SubmissionStatus } from "@/types/implementation";
import type { CredentialReceipt, InternalQueueRow } from "@/lib/implementation/internal/types";

export type InternalQueueStore = {
  list(): Promise<InternalQueueRow[]>;
  getById(id: string): Promise<InternalQueueRow | null>;
  updateWorkflow(
    id: string,
    status: SubmissionStatus,
    actorUserId: string,
  ): Promise<InternalQueueRow>;
  listCredentialReceipts(implementationIds: string[]): Promise<CredentialReceipt[]>;
  /** Test helper: persist a customer snapshot into the internal queue. */
  insertFromCustomer?(input: {
    implementationId: string;
    record: SetupSubmissionRecord;
    submittedAt?: string;
  }): Promise<InternalQueueRow>;
};
