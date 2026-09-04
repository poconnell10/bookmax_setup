import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";
import { InternalError, type InternalRole, type InternalStaff } from "@/lib/implementation/internal/types";

type StaffRow = {
  user_id: string;
  role: string;
  created_at: string;
};

function mapStaff(row: StaffRow): InternalStaff {
  if (row.role !== "viewer" && row.role !== "engineer") {
    throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
  }
  return {
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function createSupabaseStaffStore(client: SupabaseClient): InternalStaffStore {
  return {
    async findByUserId(userId) {
      const { data, error } = await client
        .from("internal_staff")
        .select("user_id, role, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return data ? mapStaff(data as StaffRow) : null;
    },

    async upsert(userId, role: InternalRole) {
      const { data, error } = await client
        .from("internal_staff")
        .upsert({ user_id: userId, role }, { onConflict: "user_id" })
        .select("user_id, role, created_at")
        .single();
      if (error || !data) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return mapStaff(data as StaffRow);
    },
  };
}
