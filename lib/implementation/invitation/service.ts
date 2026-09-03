import { randomUUID } from "node:crypto";
import {
  assertCanAccessDraftOrSubmission,
  assertCanBindAuthUser,
  assertInvitationOwnedByAuthUser,
  assertInvitationResolvable,
} from "@/lib/implementation/invitation/authorization";
import type { InvitationStore } from "@/lib/implementation/invitation/store";
import {
  buildInvitationUrl,
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/implementation/invitation/token";
import type {
  AuthPrincipal,
  CreateInvitationInput,
  CreateInvitationResult,
  ImplementationDraft,
  ImplementationSubmission,
  InvitationPublicView,
} from "@/lib/implementation/invitation/types";
import {
  InvitationError,
  normalizeEmail,
  toInvitationPublicView,
} from "@/lib/implementation/invitation/types";

function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

function requireNonEmpty(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvitationError("invalid_input", `${label} is required.`);
  }
  return trimmed;
}

export function createInvitationService(store: InvitationStore, options?: { baseUrl?: string }) {
  const baseUrl = options?.baseUrl ?? "http://localhost:3000";

  return {
    async createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
      const invitedEmail = normalizeEmail(requireNonEmpty("invited email", input.invitedEmail));
      const contactName = requireNonEmpty("contact name", input.contactName);
      const propertyName = requireNonEmpty("property name", input.propertyName);
      const country = requireNonEmpty("country", input.country);
      const hotelGroupOrBrand = input.hotelGroupOrBrand?.trim()
        ? input.hotelGroupOrBrand.trim()
        : null;

      const expiresAtDate =
        input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
      if (Number.isNaN(expiresAtDate.getTime())) {
        throw new InvitationError("invalid_input", "expiresAt must be a valid date.");
      }
      if (expiresAtDate.getTime() <= Date.now()) {
        throw new InvitationError("invalid_input", "expiresAt must be in the future.");
      }

      const rawToken = generateInvitationToken();
      const tokenHash = hashInvitationToken(rawToken);
      const stamp = nowIso();

      const invitation = await store.insertInvitation({
        id: randomUUID(),
        tokenHash,
        invitedEmail,
        contactName,
        propertyName,
        country,
        hotelGroupOrBrand,
        status: "invited",
        expiresAt: expiresAtDate.toISOString(),
        authUserId: null,
        verifiedAt: null,
        submittedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      });

      return {
        invitation: toInvitationPublicView(invitation),
        rawToken,
        invitationUrl: buildInvitationUrl(baseUrl, rawToken),
      };
    },

    async resolveByRawToken(rawToken: string, now: Date = new Date()): Promise<InvitationPublicView> {
      const tokenHash = hashInvitationToken(rawToken);
      const invitation = await store.findInvitationByTokenHash(tokenHash);
      const resolved = assertInvitationResolvable(invitation, now);
      return toInvitationPublicView(resolved);
    },

    async markOpened(invitationId: string, now: Date = new Date()): Promise<InvitationPublicView> {
      const invitation = assertInvitationResolvable(
        await store.findInvitationById(invitationId),
        now,
      );
      if (invitation.status === "invited") {
        const updated = await store.updateInvitation(invitation.id, {
          status: "opened",
          updatedAt: nowIso(now),
        });
        return toInvitationPublicView(updated);
      }
      return toInvitationPublicView(invitation);
    },

    /**
     * Bind auth.uid() after successful OTP. Email must match invited_email.
     * Never rebinds to a different auth user.
     */
    async bindAuthUser(
      invitationId: string,
      principal: AuthPrincipal,
      now: Date = new Date(),
    ): Promise<InvitationPublicView> {
      const invitation = assertInvitationResolvable(
        await store.findInvitationById(invitationId),
        now,
      );
      assertCanBindAuthUser(invitation, principal, now);

      if (invitation.authUserId === principal.authUserId) {
        return toInvitationPublicView(invitation);
      }

      const updated = await store.updateInvitation(invitation.id, {
        authUserId: principal.authUserId,
        status: invitation.status === "submitted" ? invitation.status : "verified",
        verifiedAt: invitation.verifiedAt ?? nowIso(now),
        updatedAt: nowIso(now),
      });
      return toInvitationPublicView(updated);
    },

    async getOwnedInvitation(
      invitationId: string,
      principal: AuthPrincipal,
    ): Promise<InvitationPublicView> {
      const invitation = await store.findInvitationById(invitationId);
      if (!invitation) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      return assertInvitationOwnedByAuthUser(invitation, principal);
    },

    async saveDraft(
      invitationId: string,
      principal: AuthPrincipal,
      payload: Record<string, unknown>,
    ): Promise<ImplementationDraft> {
      const invitation = await store.findInvitationById(invitationId);
      if (!invitation) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      assertCanAccessDraftOrSubmission(invitation, principal);
      if (invitation.status === "submitted") {
        throw new InvitationError("submitted", "Invitation has already been submitted.");
      }
      const draft = await store.upsertDraft({ invitationId, payload });
      if (invitation.status === "verified" || invitation.status === "opened") {
        await store.updateInvitation(invitationId, {
          status: "in_progress",
          updatedAt: nowIso(),
        });
      }
      return draft;
    },

    async getDraft(
      invitationId: string,
      principal: AuthPrincipal,
    ): Promise<ImplementationDraft | null> {
      const invitation = await store.findInvitationById(invitationId);
      if (!invitation) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      assertCanAccessDraftOrSubmission(invitation, principal);
      return store.findDraftByInvitationId(invitationId);
    },

    async submitFinal(
      invitationId: string,
      principal: AuthPrincipal,
      record: Record<string, unknown>,
      now: Date = new Date(),
    ): Promise<ImplementationSubmission> {
      const invitation = await store.findInvitationById(invitationId);
      if (!invitation) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      assertCanAccessDraftOrSubmission(invitation, principal);
      if (invitation.status === "submitted" || (await store.findSubmissionByInvitationId(invitationId))) {
        throw new InvitationError(
          "duplicate_submission",
          "A final submission already exists for this invitation.",
        );
      }

      const submission = await store.insertSubmission({
        invitationId,
        record: {
          ...record,
          invitation_id: invitationId,
        },
        submittedAt: nowIso(now),
      });

      await store.updateInvitation(invitationId, {
        status: "submitted",
        submittedAt: submission.submittedAt,
        updatedAt: nowIso(now),
      });

      return submission;
    },
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
