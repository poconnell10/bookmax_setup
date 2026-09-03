import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvitationStore } from "@/lib/implementation/invitation/store";
import {
  INVITATION_STATUSES,
  InvitationError,
  type ImplementationDraft,
  type ImplementationInvitation,
  type ImplementationSubmission,
  type InvitationStatus,
} from "@/lib/implementation/invitation/types";

type InvitationRow = {
  id: string;
  token_hash: string;
  invited_email: string;
  contact_name: string;
  property_name: string;
  country: string;
  hotel_group_or_brand: string | null;
  status: string;
  expires_at: string;
  auth_user_id: string | null;
  verified_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type DraftRow = {
  id: string;
  invitation_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type SubmissionRow = {
  id: string;
  invitation_id: string;
  record: Record<string, unknown>;
  submitted_at: string;
};

export class PersistenceUnavailableError extends Error {
  readonly code = "unavailable" as const;

  constructor(message = "The service is temporarily unavailable. Please try again.") {
    super(message);
    this.name = "PersistenceUnavailableError";
  }
}

function isInvitationStatus(value: string): value is InvitationStatus {
  return (INVITATION_STATUSES as readonly string[]).includes(value);
}

function mapInvitation(row: InvitationRow): ImplementationInvitation {
  if (!isInvitationStatus(row.status)) {
    throw new PersistenceUnavailableError();
  }

  return {
    id: row.id,
    tokenHash: row.token_hash,
    invitedEmail: row.invited_email,
    contactName: row.contact_name,
    propertyName: row.property_name,
    country: row.country,
    hotelGroupOrBrand: row.hotel_group_or_brand,
    status: row.status,
    expiresAt: row.expires_at,
    authUserId: row.auth_user_id,
    verifiedAt: row.verified_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDraft(row: DraftRow): ImplementationDraft {
  return {
    id: row.id,
    invitationId: row.invitation_id,
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubmission(row: SubmissionRow): ImplementationSubmission {
  return {
    id: row.id,
    invitationId: row.invitation_id,
    record: row.record && typeof row.record === "object" ? row.record : {},
    submittedAt: row.submitted_at,
  };
}

function throwStoreError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "23505") {
    throw new InvitationError(
      "duplicate_submission",
      "A final submission already exists for this invitation.",
    );
  }
  if (error?.code === "23503") {
    throw new InvitationError("not_found", "Invitation was not found.");
  }
  throw new PersistenceUnavailableError();
}

export function createSupabaseInvitationStore(client: SupabaseClient): InvitationStore {
  return {
    async insertInvitation(invitation) {
      const { data, error } = await client
        .from("implementation_invitation")
        .insert({
          id: invitation.id,
          token_hash: invitation.tokenHash,
          invited_email: invitation.invitedEmail,
          contact_name: invitation.contactName,
          property_name: invitation.propertyName,
          country: invitation.country,
          hotel_group_or_brand: invitation.hotelGroupOrBrand,
          status: invitation.status,
          expires_at: invitation.expiresAt,
          auth_user_id: invitation.authUserId,
          verified_at: invitation.verifiedAt,
          submitted_at: invitation.submittedAt,
          created_at: invitation.createdAt,
          updated_at: invitation.updatedAt,
        })
        .select("*")
        .single();

      if (error || !data) {
        throwStoreError(error);
      }

      return mapInvitation(data as InvitationRow);
    },

    async findInvitationByTokenHash(tokenHash) {
      const { data, error } = await client
        .from("implementation_invitation")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error) {
        throwStoreError(error);
      }

      return data ? mapInvitation(data as InvitationRow) : null;
    },

    async findInvitationById(id) {
      const { data, error } = await client
        .from("implementation_invitation")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throwStoreError(error);
      }

      return data ? mapInvitation(data as InvitationRow) : null;
    },

    async updateInvitation(id, patch) {
      const payload: Record<string, unknown> = {};
      if (patch.status !== undefined) {
        payload.status = patch.status;
      }
      if (patch.authUserId !== undefined) {
        payload.auth_user_id = patch.authUserId;
      }
      if (patch.verifiedAt !== undefined) {
        payload.verified_at = patch.verifiedAt;
      }
      if (patch.submittedAt !== undefined) {
        payload.submitted_at = patch.submittedAt;
      }
      if (patch.expiresAt !== undefined) {
        payload.expires_at = patch.expiresAt;
      }
      if (patch.updatedAt !== undefined) {
        payload.updated_at = patch.updatedAt;
      }

      const { data, error } = await client
        .from("implementation_invitation")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) {
        if (error?.code === "PGRST116") {
          throw new InvitationError("not_found", "Invitation was not found.");
        }
        throwStoreError(error);
      }

      return mapInvitation(data as InvitationRow);
    },

    async upsertDraft({ invitationId, payload }) {
      const { data, error } = await client
        .from("implementation_draft")
        .upsert(
          {
            invitation_id: invitationId,
            payload,
          },
          { onConflict: "invitation_id" },
        )
        .select("*")
        .single();

      if (error || !data) {
        throwStoreError(error);
      }

      return mapDraft(data as DraftRow);
    },

    async findDraftByInvitationId(invitationId) {
      const { data, error } = await client
        .from("implementation_draft")
        .select("*")
        .eq("invitation_id", invitationId)
        .maybeSingle();

      if (error) {
        throwStoreError(error);
      }

      return data ? mapDraft(data as DraftRow) : null;
    },

    async insertSubmission({ invitationId, record, submittedAt }) {
      const { data, error } = await client
        .from("implementation_submission")
        .insert({
          invitation_id: invitationId,
          record,
          submitted_at: submittedAt ?? new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error || !data) {
        throwStoreError(error);
      }

      return mapSubmission(data as SubmissionRow);
    },

    async findSubmissionByInvitationId(invitationId) {
      const { data, error } = await client
        .from("implementation_submission")
        .select("*")
        .eq("invitation_id", invitationId)
        .maybeSingle();

      if (error) {
        throwStoreError(error);
      }

      return data ? mapSubmission(data as SubmissionRow) : null;
    },
  };
}
