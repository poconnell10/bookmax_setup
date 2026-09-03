import type {
  AuthPrincipal,
  ImplementationInvitation,
  InvitationPublicView,
} from "@/lib/implementation/invitation/types";
import { InvitationError, normalizeEmail } from "@/lib/implementation/invitation/types";

export function isInvitationExpired(
  invitation: Pick<ImplementationInvitation, "expiresAt" | "status">,
  now: Date = new Date(),
): boolean {
  if (invitation.status === "expired") {
    return true;
  }
  return new Date(invitation.expiresAt).getTime() <= now.getTime();
}

export function assertInvitationResolvable(
  invitation: ImplementationInvitation | null | undefined,
  now: Date = new Date(),
): ImplementationInvitation {
  if (!invitation) {
    throw new InvitationError("not_found", "Invitation was not found.");
  }
  if (invitation.status === "revoked") {
    throw new InvitationError("revoked", "Invitation has been revoked.");
  }
  if (isInvitationExpired(invitation, now)) {
    throw new InvitationError("expired", "Invitation has expired.");
  }
  return invitation;
}

/**
 * Authoritative ownership after OTP bind.
 * auth_user_id = auth.uid() is required for authenticated access.
 */
export function assertInvitationOwnedByAuthUser(
  invitation: ImplementationInvitation,
  principal: AuthPrincipal,
): InvitationPublicView {
  if (!invitation.authUserId) {
    throw new InvitationError(
      "forbidden",
      "Invitation is not bound to an authenticated user.",
    );
  }
  if (invitation.authUserId !== principal.authUserId) {
    throw new InvitationError("forbidden", "Invitation access denied.");
  }
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

/**
 * Initial bind: verified Supabase email must match invited_email.
 * Already-bound invitations must never rebind to a different auth user.
 */
export function assertCanBindAuthUser(
  invitation: ImplementationInvitation,
  principal: AuthPrincipal,
  now: Date = new Date(),
): void {
  assertInvitationResolvable(invitation, now);

  if (normalizeEmail(invitation.invitedEmail) !== normalizeEmail(principal.email)) {
    throw new InvitationError(
      "email_mismatch",
      "Authenticated email does not match the invitation.",
    );
  }

  if (invitation.authUserId && invitation.authUserId !== principal.authUserId) {
    throw new InvitationError(
      "rebind_conflict",
      "Invitation is already bound to a different authenticated user.",
    );
  }
}

export function assertCanAccessDraftOrSubmission(
  invitation: ImplementationInvitation,
  principal: AuthPrincipal,
): void {
  assertInvitationOwnedByAuthUser(invitation, principal);
}
