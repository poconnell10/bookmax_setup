import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSetupIntake, type SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import { CustomerError } from "@/lib/implementation/customer/types";
import type {
  CustomerImplementation,
  CustomerIntake,
  CustomerProperty,
  CustomerSubmission,
  ImplementationMembership,
  ImplementationStatus,
  PropertyInput,
} from "@/lib/implementation/customer/types";
import { IMPLEMENTATION_STATUSES } from "@/lib/implementation/customer/types";

type ImplementationRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  id: string;
  implementation_id: string;
  user_id: string;
  role: string;
  status: string | null;
  created_at: string;
};

type PropertyRow = {
  id: string;
  implementation_id: string;
  name: string;
  city: string | null;
  country: string | null;
  hotel_brand: string | null;
  contact_name: string;
  job_title: string | null;
  created_at: string;
  updated_at: string;
};

type IntakeRow = {
  id: string;
  implementation_id: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

type SubmissionRow = {
  id: string;
  implementation_id: string;
  record: unknown;
  submitted_at: string;
};

const PROPERTY_COLUMNS =
  "id, implementation_id, name, city, country, hotel_brand, contact_name, job_title, created_at, updated_at";

function isStatus(value: string): value is ImplementationStatus {
  return (IMPLEMENTATION_STATUSES as readonly string[]).includes(value);
}

function mapImplementation(row: ImplementationRow): CustomerImplementation {
  if (!isStatus(row.status)) {
    throw new CustomerError("unavailable", "The service is temporarily unavailable. Please try again.");
  }
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMembership(row: MembershipRow): ImplementationMembership {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    userId: row.user_id,
    role: "customer",
    status: row.status === "disabled" ? "disabled" : "active",
    createdAt: row.created_at,
  };
}

function mapProperty(row: PropertyRow): CustomerProperty {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    name: row.name,
    city: row.city,
    country: row.country,
    hotelBrand: row.hotel_brand,
    contactName: row.contact_name,
    jobTitle: row.job_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIntake(row: IntakeRow): CustomerIntake {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    payload: normalizeSetupIntake(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubmission(row: SubmissionRow): CustomerSubmission {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    record: row.record as CustomerSubmission["record"],
    submittedAt: row.submitted_at,
  };
}

function throwStoreError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "23505") {
    throw new CustomerError("invalid_input", "Record already exists.");
  }
  throw new CustomerError("unavailable", "The service is temporarily unavailable. Please try again.");
}

export function createSupabaseCustomerStore(client: SupabaseClient): CustomerStore {
  return {
    async findMembershipByUserId(userId) {
      const { data, error } = await client
        .from("implementation_users")
        .select("id, implementation_id, user_id, role, status, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throwStoreError(error);
      }
      return data ? mapMembership(data as MembershipRow) : null;
    },

    async listMemberships() {
      const { data, error } = await client
        .from("implementation_users")
        .select("id, implementation_id, user_id, role, status, created_at");
      if (error) {
        throwStoreError(error);
      }
      return ((data ?? []) as MembershipRow[]).map(mapMembership);
    },

    async listImplementations() {
      const { data, error } = await client.from("implementations").select("id, status, created_at, updated_at");
      if (error) {
        throwStoreError(error);
      }
      return ((data ?? []) as ImplementationRow[]).map(mapImplementation);
    },

    async updateMembership(userId, input) {
      const patch: Record<string, string> = {};
      if (input.implementationId) {
        patch.implementation_id = input.implementationId;
      }
      if (input.status) {
        patch.status = input.status;
      }
      const { data, error } = await client
        .from("implementation_users")
        .update(patch)
        .eq("user_id", userId)
        .select("id, implementation_id, user_id, role, status, created_at")
        .single();
      if (error || !data) {
        throwStoreError(error);
      }
      return mapMembership(data as MembershipRow);
    },

    async findImplementationById(id) {
      const { data, error } = await client
        .from("implementations")
        .select("id, status, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throwStoreError(error);
      }
      return data ? mapImplementation(data as ImplementationRow) : null;
    },

    async findPropertyByImplementationId(implementationId) {
      const { data, error } = await client
        .from("properties")
        .select(
          PROPERTY_COLUMNS,
        )
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) {
        throwStoreError(error);
      }
      return data ? mapProperty(data as PropertyRow) : null;
    },

    async findPropertyById(id) {
      const { data, error } = await client
        .from("properties")
        .select(
          PROPERTY_COLUMNS,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throwStoreError(error);
      }
      return data ? mapProperty(data as PropertyRow) : null;
    },

    async insertImplementation() {
      const { data, error } = await client
        .from("implementations")
        .insert({ status: "started" })
        .select("id, status, created_at, updated_at")
        .single();
      if (error || !data) {
        throwStoreError(error);
      }
      return mapImplementation(data as ImplementationRow);
    },

    async insertMembership({ implementationId, userId }) {
      const { data, error } = await client
        .from("implementation_users")
        .insert({
          implementation_id: implementationId,
          user_id: userId,
          role: "customer",
        })
        .select("id, implementation_id, user_id, role, status, created_at")
        .single();
      if (error || !data) {
        throwStoreError(error);
      }
      return mapMembership(data as MembershipRow);
    },

    async updateImplementationStatus(id, status) {
      const { data, error } = await client
        .from("implementations")
        .update({ status })
        .eq("id", id)
        .select("id, status, created_at, updated_at")
        .single();
      if (error || !data) {
        throwStoreError(error);
      }
      return mapImplementation(data as ImplementationRow);
    },

    async upsertProperty(implementationId, input: PropertyInput) {
      const jobTitle = input.jobTitle?.trim() ? input.jobTitle.trim() : null;
      const hotelBrand = input.hotelBrand?.trim() ? input.hotelBrand.trim() : null;
      const city = input.city?.trim() ? input.city.trim() : null;
      const country = input.country?.trim() ? input.country.trim() : null;
      const fields = {
        name: input.name,
        city,
        country,
        hotel_brand: hotelBrand,
        contact_name: input.contactName,
        job_title: jobTitle,
      };
      const { data: existing, error: findError } = await client
        .from("properties")
        .select(PROPERTY_COLUMNS)
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (findError) {
        throwStoreError(findError);
      }

      if (existing) {
        const { data, error } = await client
          .from("properties")
          .update(fields)
          .eq("id", (existing as PropertyRow).id)
          .select(PROPERTY_COLUMNS)
          .single();
        if (error || !data) {
          throwStoreError(error);
        }
        return mapProperty(data as PropertyRow);
      }

      const { data, error } = await client
        .from("properties")
        .insert({
          implementation_id: implementationId,
          ...fields,
        })
        .select(PROPERTY_COLUMNS)
        .single();
      if (error?.code === "23505") {
        const { data: raced, error: racedError } = await client
          .from("properties")
          .update(fields)
          .eq("implementation_id", implementationId)
          .select(PROPERTY_COLUMNS)
          .single();
        if (racedError || !raced) {
          throwStoreError(racedError);
        }
        return mapProperty(raced as PropertyRow);
      }
      if (error || !data) {
        throwStoreError(error);
      }
      return mapProperty(data as PropertyRow);
    },

    async findIntakeByImplementationId(implementationId) {
      const { data, error } = await client
        .from("implementation_intake")
        .select("id, implementation_id, payload, created_at, updated_at")
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) {
        throwStoreError(error);
      }
      return data ? mapIntake(data as IntakeRow) : null;
    },

    async upsertIntake(implementationId, payload: SetupIntakePayload) {
      const normalized = normalizeSetupIntake(payload);
      const { data: existing, error: findError } = await client
        .from("implementation_intake")
        .select("id, implementation_id, payload, created_at, updated_at")
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (findError) {
        throwStoreError(findError);
      }

      if (existing) {
        const { data, error } = await client
          .from("implementation_intake")
          .update({ payload: normalized })
          .eq("id", (existing as IntakeRow).id)
          .select("id, implementation_id, payload, created_at, updated_at")
          .single();
        if (error || !data) {
          throwStoreError(error);
        }
        return mapIntake(data as IntakeRow);
      }

      const { data, error } = await client
        .from("implementation_intake")
        .insert({
          implementation_id: implementationId,
          payload: normalized,
        })
        .select("id, implementation_id, payload, created_at, updated_at")
        .single();
      if (error?.code === "23505") {
        const { data: raced, error: racedError } = await client
          .from("implementation_intake")
          .update({ payload: normalized })
          .eq("implementation_id", implementationId)
          .select("id, implementation_id, payload, created_at, updated_at")
          .single();
        if (racedError || !raced) {
          throwStoreError(racedError);
        }
        return mapIntake(raced as IntakeRow);
      }
      if (error || !data) {
        throwStoreError(error);
      }
      return mapIntake(data as IntakeRow);
    },

    async findSubmissionByImplementationId(implementationId) {
      const { data, error } = await client
        .from("implementation_submissions")
        .select("id, implementation_id, record, submitted_at")
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) {
        throwStoreError(error);
      }
      return data ? mapSubmission(data as SubmissionRow) : null;
    },

    async insertSubmission({ implementationId, record }) {
      const { data, error } = await client
        .from("implementation_submissions")
        .insert({
          implementation_id: implementationId,
          record,
        })
        .select("id, implementation_id, record, submitted_at")
        .single();
      if (error || !data) {
        throwStoreError(error);
      }
      return mapSubmission(data as SubmissionRow);
    },
  };
}
