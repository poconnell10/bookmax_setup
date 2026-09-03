import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { InvitationStore } from "@/lib/implementation/invitation/store";
import type {
  ImplementationDraft,
  ImplementationInvitation,
  ImplementationSubmission,
} from "@/lib/implementation/invitation/types";
import { InvitationError } from "@/lib/implementation/invitation/types";

type Snapshot = {
  invitations: ImplementationInvitation[];
  drafts: ImplementationDraft[];
  submissions: ImplementationSubmission[];
};

/**
 * File-backed store for local M1 CLI when no database is available.
 * Never stores raw invitation tokens — only token_hash on invitation records.
 */
export function createFileInvitationStore(filePath: string): InvitationStore {
  const invitations = new Map<string, ImplementationInvitation>();
  const drafts = new Map<string, ImplementationDraft>();
  const submissions = new Map<string, ImplementationSubmission>();

  if (existsSync(filePath)) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Snapshot;
    for (const invitation of parsed.invitations || []) {
      invitations.set(invitation.id, invitation);
    }
    for (const draft of parsed.drafts || []) {
      drafts.set(draft.invitationId, draft);
    }
    for (const submission of parsed.submissions || []) {
      submissions.set(submission.invitationId, submission);
    }
  }

  function flush() {
    mkdirSync(dirname(filePath), { recursive: true });
    const snapshot: Snapshot = {
      invitations: [...invitations.values()],
      drafts: [...drafts.values()],
      submissions: [...submissions.values()],
    };
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  }

  return {
    async insertInvitation(invitation) {
      if ([...invitations.values()].some((item) => item.tokenHash === invitation.tokenHash)) {
        throw new InvitationError("invalid_input", "token_hash must be unique.");
      }
      invitations.set(invitation.id, invitation);
      flush();
      return invitation;
    },

    async findInvitationByTokenHash(tokenHash) {
      return [...invitations.values()].find((item) => item.tokenHash === tokenHash) ?? null;
    },

    async findInvitationById(id) {
      return invitations.get(id) ?? null;
    },

    async updateInvitation(id, patch) {
      const current = invitations.get(id);
      if (!current) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      const next = {
        ...current,
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      };
      invitations.set(id, next);
      flush();
      return next;
    },

    async upsertDraft({ invitationId, payload }) {
      if (!invitations.has(invitationId)) {
        throw new InvitationError("not_found", "Invitation was not found.");
      }
      const existing = drafts.get(invitationId);
      const stamp = new Date().toISOString();
      const next: ImplementationDraft = existing
        ? { ...existing, payload, updatedAt: stamp }
        : {
            id: randomUUID(),
            invitationId,
            payload,
            createdAt: stamp,
            updatedAt: stamp,
          };
      drafts.set(invitationId, next);
      flush();
      return next;
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
        submittedAt: submittedAt ?? new Date().toISOString(),
      };
      submissions.set(invitationId, created);
      flush();
      return created;
    },

    async findSubmissionByInvitationId(invitationId) {
      return submissions.get(invitationId) ?? null;
    },
  };
}
