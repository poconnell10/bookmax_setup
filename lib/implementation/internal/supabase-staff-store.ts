import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InternalStaffStore, StaffWrite } from "@/lib/implementation/internal/staff-store";
import {
  InternalError,
  INTERNAL_ROLES,
  type InternalRole,
  type InternalStaff,
} from "@/lib/implementation/internal/types";

type StaffRow = {
  user_id: string;
  role: string;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  provisioned_by: string | null;
};

const STAFF_COLUMNS = "user_id, role, status, created_at, updated_at, provisioned_by";

function isRole(value: string): value is InternalRole {
  return (INTERNAL_ROLES as readonly string[]).includes(value);
}

function mapStaff(row: StaffRow): InternalStaff {
  if (!isRole(row.role)) {
    throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
  }
  return {
    userId: row.user_id,
    role: row.role,
    status: row.status === "disabled" ? "disabled" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    provisionedBy: row.provisioned_by,
  };
}

export function createSupabaseStaffStore(client: SupabaseClient): InternalStaffStore {
  return {
    async findByUserId(userId) {
      const { data, error } = await client
        .from("internal_staff")
        .select(STAFF_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return data ? mapStaff(data as StaffRow) : null;
    },

    async list() {
      const { data, error } = await client.from("internal_staff").select(STAFF_COLUMNS);
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return ((data ?? []) as StaffRow[]).map(mapStaff);
    },

    async upsert(input: StaffWrite) {
      const { data, error } = await client
        .from("internal_staff")
        .upsert(
          {
            user_id: input.userId,
            role: input.role,
            status: input.status,
            provisioned_by: input.provisionedBy,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select(STAFF_COLUMNS)
        .single();
      if (error || !data) {
        if (error?.message?.toLowerCase().includes("last active admin")) {
          throw new InternalError("forbidden", "The last active Admin cannot be changed.");
        }
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return mapStaff(data as StaffRow);
    },

    async remove(userId) {
      const { error } = await client.from("internal_staff").delete().eq("user_id", userId);
      if (error) {
        if (error.message?.toLowerCase().includes("last active admin")) {
          throw new InternalError("forbidden", "The last active Admin cannot be changed.");
        }
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
    },

    async countActiveAdmins(exceptUserId) {
      let query = client
        .from("internal_staff")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "active");
      if (exceptUserId) {
        query = query.neq("user_id", exceptUserId);
      }
      const { count, error } = await query;
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return count ?? 0;
    },
  };
}
