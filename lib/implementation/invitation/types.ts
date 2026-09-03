export const INVITATION_STATUSES = [
  "invited",
  "opened",
  "verified",
  "in_progress",
  "submitted",
  "expired",
  "revoked",
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export type ImplementationInvitation = {
  id: string;
  tokenHash: string;
  invitedEmail: string;
  contactName: string;
  propertyName: string;
  country: string;
  hotelGroupOrBrand: string | null;
  status: InvitationStatus;
  expiresAt: string;
  authUserId: string | null;
  verifiedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Safe customer/admin view — never includes token_hash or raw token. */
export type InvitationPublicView = {
  id: string;
  invitedEmail: string;
  contactName: string;
  propertyName: string;
  country: string;
  hotelGroupOrBrand: string | null;
  status: InvitationStatus;
  expiresAt: string;
  authUserId: string | null;
  verifiedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImplementationDraft = {
  id: string;
  invitationId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ImplementationSubmission = {
  id: string;
  invitationId: string;
  record: Record<string, unknown>;
  submittedAt: string;
};

export type CreateInvitationInput = {
  invitedEmail: string;
  contactName: string;
  propertyName: string;
  country: string;
  hotelGroupOrBrand?: string | null;
  expiresAt: string | Date;
};

export type CreateInvitationResult = {
  invitation: InvitationPublicView;
  /** Returned ONCE. Never log or persist. */
  rawToken: string;
  invitationUrl: string;
};

export type AuthPrincipal = {
  authUserId: string;
  email: string;
};

export class InvitationError extends Error {
  readonly code:
    | "not_found"
    | "expired"
    | "revoked"
    | "submitted"
    | "forbidden"
    | "rebind_conflict"
    | "email_mismatch"
    | "duplicate_submission"
    | "invalid_input";

  constructor(
    code:
      | "not_found"
      | "expired"
      | "revoked"
      | "submitted"
      | "forbidden"
      | "rebind_conflict"
      | "email_mismatch"
      | "duplicate_submission"
      | "invalid_input",
    message: string,
  ) {
    super(message);
    this.name = "InvitationError";
    this.code = code;
  }
}

export function toInvitationPublicView(
  invitation: ImplementationInvitation,
): InvitationPublicView {
  return {
    id: invitation.id,
    invitedEmail: invitation.invitedEmail,
    contactName: invitation.contactName,
    propertyName: invitation.propertyName,
    country: invitation.country,
    hotelGroupOrBrand: invitation.hotelGroupOrBrand,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    authUserId: invitation.authUserId,
    verifiedAt: invitation.verifiedAt,
    submittedAt: invitation.submittedAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
