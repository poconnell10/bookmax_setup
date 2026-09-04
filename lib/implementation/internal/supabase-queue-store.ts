import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSetupIntake, type SetupSubmissionRecord } from "@/lib/setup/intake";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/types/implementation";
import type { InternalQueueStore } from "@/lib/implementation/internal/queue-store";
import { InternalError, type CredentialReceipt, type InternalQueueRow } from "@/lib/implementation/internal/types";

type SubmissionRow = {
  id: string;
  implementation_id: string;
  record: unknown;
  submitted_at: string;
  workflow_status: string;
  workflow_updated_at: string;
  workflow_updated_by: string | null;
};

type ReceiptRow = {
  implementation_id: string;
  received_at: string;
};

function isStatus(value: string): value is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

function asRecord(value: unknown): SetupSubmissionRecord {
  const raw = value && typeof value === "object" ? (value as Partial<SetupSubmissionRecord>) : {};
  const property =
    raw.property && typeof raw.property === "object"
      ? raw.property
      : {
          name: "",
          city: null,
          country: null,
          hotelBrand: null,
          contactName: "",
          jobTitle: null,
        };
  return {
    implementationId: typeof raw.implementationId === "string" ? raw.implementationId : "",
    property: {
      name: typeof property.name === "string" ? property.name : "",
      city: typeof property.city === "string" ? property.city : null,
      country: typeof property.country === "string" ? property.country : null,
      hotelBrand: typeof property.hotelBrand === "string" ? property.hotelBrand : null,
      contactName: typeof property.contactName === "string" ? property.contactName : "",
      jobTitle: typeof property.jobTitle === "string" ? property.jobTitle : null,
    },
    contactEmail: typeof raw.contactEmail === "string" ? raw.contactEmail : "",
    intake: normalizeSetupIntake(raw.intake),
    submittedAt: typeof raw.submittedAt === "string" ? raw.submittedAt : "",
  };
}

function mapRow(row: SubmissionRow): InternalQueueRow {
  if (!isStatus(row.workflow_status)) {
    throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
  }
  return {
    id: row.id,
    implementationId: row.implementation_id,
    record: asRecord(row.record),
    submittedAt: row.submitted_at,
    workflowStatus: row.workflow_status,
    workflowUpdatedAt: row.workflow_updated_at,
    workflowUpdatedBy: row.workflow_updated_by,
  };
}

const QUEUE_COLUMNS =
  "id, implementation_id, record, submitted_at, workflow_status, workflow_updated_at, workflow_updated_by";

export function createSupabaseQueueStore(client: SupabaseClient): InternalQueueStore {
  return {
    async list() {
      const { data, error } = await client
        .from("implementation_submissions")
        .select(QUEUE_COLUMNS)
        .order("submitted_at", { ascending: false });
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return ((data ?? []) as SubmissionRow[]).map(mapRow);
    },

    async getById(id) {
      const { data, error } = await client
        .from("implementation_submissions")
        .select(QUEUE_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return data ? mapRow(data as SubmissionRow) : null;
    },

    async updateWorkflow(id, status, actorUserId) {
      if (!isStatus(status)) {
        throw new InternalError("invalid_input", "Invalid status.");
      }
      const { data, error } = await client
        .from("implementation_submissions")
        .update({
          workflow_status: status,
          workflow_updated_at: new Date().toISOString(),
          workflow_updated_by: actorUserId,
        })
        .eq("id", id)
        .select(QUEUE_COLUMNS)
        .maybeSingle();
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      if (!data) {
        throw new InternalError("not_found", "Submission was not found.");
      }
      return mapRow(data as SubmissionRow);
    },

    async listCredentialReceipts(implementationIds) {
      if (implementationIds.length === 0) {
        return [];
      }
      const { data, error } = await client
        .from("implementation_credentials")
        .select("implementation_id, received_at")
        .in("implementation_id", implementationIds);
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return ((data ?? []) as ReceiptRow[]).map(
        (row): CredentialReceipt => ({
          implementationId: row.implementation_id,
          receivedAt: row.received_at,
        }),
      );
    },
  };
}
