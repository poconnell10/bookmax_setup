import type {
  CreateInvitationInput,
  ImplementationDraft,
  ImplementationInvitation,
  ImplementationSubmission,
  InvitationStatus,
} from "@/lib/implementation/invitation/types";

export type InvitationStore = {
  insertInvitation(
    invitation: ImplementationInvitation,
  ): Promise<ImplementationInvitation>;
  findInvitationByTokenHash(tokenHash: string): Promise<ImplementationInvitation | null>;
  findInvitationById(id: string): Promise<ImplementationInvitation | null>;
  updateInvitation(
    id: string,
    patch: Partial<
      Pick<
        ImplementationInvitation,
        | "status"
        | "authUserId"
        | "verifiedAt"
        | "submittedAt"
        | "updatedAt"
        | "expiresAt"
      >
    >,
  ): Promise<ImplementationInvitation>;
  upsertDraft(input: {
    invitationId: string;
    payload: Record<string, unknown>;
  }): Promise<ImplementationDraft>;
  findDraftByInvitationId(invitationId: string): Promise<ImplementationDraft | null>;
  insertSubmission(input: {
    invitationId: string;
    record: Record<string, unknown>;
    submittedAt?: string;
  }): Promise<ImplementationSubmission>;
  findSubmissionByInvitationId(
    invitationId: string,
  ): Promise<ImplementationSubmission | null>;
};

export type CreateInvitationRecord = CreateInvitationInput & {
  tokenHash: string;
  status?: InvitationStatus;
};
