import { randomUUID } from "node:crypto";
import type { InvitationStore } from "@/lib/implementation/invitation/store";
import type {
  ImplementationDraft,
  ImplementationInvitation,
  ImplementationSubmission,
} from "@/lib/implementation/invitation/types";
import { InvitationError } from "@/lib/implementation/invitation/types";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * In-memory store that mirrors Phase 1 uniqueness / ownership constraints
 * for unit tests and local CLI when no database is available.
 */
export function createMemoryInvitationStore(): InvitationStore {
  const invitations = new Map<string, ImplementationInvitation>();
  const byTokenHash = new Map<string, string>();
  const drafts = new Map<string, ImplementationDraft>();
  const submissions = new Map<string, ImplementationSubmission>();

  return {
    async insertInvitation(invitation) {
      if (byTokenHash.has(invitation.tokenHash)) {
        throw new InvitationError("invalid_input", "token_hash must be unique.");
      }
      invitations.set(invitation.id, invitation);
      byTokenHash.set(invitation.tokenHash, invitation.id);
      return invitation;
    },

    async findInvitationByTokenHash(tokenHash) {
      const id = byTokenHash.get(tokenHash);
      if (!id) {
        return null;
      }
      return invitations.get(id) ?? null;
    },

    async findInvitationById(id) {
      return invitations.get(id) ?? null;
    },

    async updateInvitation(id, patch) {
      const current = invitations.get(id);
      if (!current) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      const next: ImplementationInvitation = {
        ...current,
        ...patch,
        updatedAt: patch.updatedAt ?? nowIso(),
      };
      invitations.set(id, next);
      return next;
    },

    async upsertDraft({ invitationId, payload }) {
      if (!invitations.has(invitationId)) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      const existing = drafts.get(invitationId);
      const stamp = nowIso();
      if (existing) {
        const next = { ...existing, payload, updatedAt: stamp };
        drafts.set(invitationId, next);
        return next;
      }
      const created: ImplementationDraft = {
        id: randomUUID(),
        invitationId,
        payload,
        createdAt: stamp,
        updatedAt: stamp,
      };
      drafts.set(invitationId, created);
      return created;
    },

    async findDraftByInvitationId(invitationId) {
      return drafts.get(invitationId) ?? null;
    },

    async insertSubmission({ invitationId, record, submittedAt }) {
      if (!invitations.has(invitationId)) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      if (submissions.has(invitationId)) {
        throw new InvitationError(
          "duplicate_submission",
          "A final submission already exists for this invitation.",
        );
      }
      const created: ImplementationSubmission = {
        id: randomUUID(),
        invitationId,
        record,
        submittedAt: submittedAt ?? nowIso(),
      };
      submissions.set(invitationId, created);
      return created;
    },

    async findSubmissionByInvitationId(invitationId) {
      return submissions.get(invitationId) ?? null;
    },
  };
}
