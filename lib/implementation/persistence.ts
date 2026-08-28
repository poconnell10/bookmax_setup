import type { IntakeState, SubmissionRecord } from "@/types/implementation";

export type CredentialPayload = {
  clientId: string;
  clientSecret: string;
  applicationKey: string;
};

export type PersistencePort = {
  saveDraft: (draft: IntakeState) => Promise<{ draftId: string }>;
  loadDraft: (draftId: string) => Promise<IntakeState | null>;
  submitImplementation: (record: SubmissionRecord) => Promise<{ submissionId: string }>;
  submitCredentials: (
    draftId: string,
    payload: CredentialPayload,
  ) => Promise<{ credentialsStatus: "received" }>;
};

const DRAFTS = new Map<string, IntakeState>();
const SUBMISSIONS = new Map<string, SubmissionRecord>();
const CREDENTIAL_RECEIPTS = new Map<string, true>();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function withoutSecrets(draft: IntakeState): IntakeState {
  return { ...draft };
}

export const prototypePersistence: PersistencePort = {
  async saveDraft(draft) {
    const draftId = draft.draftId || newId("draft");
    DRAFTS.set(draftId, withoutSecrets({ ...draft, draftId }));
    return { draftId };
  },

  async loadDraft(draftId) {
    return DRAFTS.get(draftId) ?? null;
  },

  async submitImplementation(record) {
    const submissionId = record.submission_id || newId("BMX");
    const stored = { ...record, submission_id: submissionId };
    SUBMISSIONS.set(submissionId, stored);
    return { submissionId };
  },

  async submitCredentials(draftId, payload) {
    if (!payload.clientId.trim() || !payload.clientSecret.trim() || !payload.applicationKey.trim()) {
      throw new Error("All credential fields are required together.");
    }

    CREDENTIAL_RECEIPTS.set(draftId, true);
    const draft = DRAFTS.get(draftId);

    if (draft) {
      DRAFTS.set(draftId, { ...draft, credentialsStatus: "received" });
    }

    return { credentialsStatus: "received" };
  },
};

export function getPrototypeSubmission(id: string): SubmissionRecord | undefined {
  return SUBMISSIONS.get(id);
}

export function credentialsWereReceived(draftId: string): boolean {
  return CREDENTIAL_RECEIPTS.has(draftId);
}
