import type { InternalRole, InternalStaff } from "@/lib/implementation/internal/types";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";

export function createMemoryStaffStore(seed: InternalStaff[] = []): InternalStaffStore {
  const rows = new Map<string, InternalStaff>(seed.map((row) => [row.userId, row]));

  return {
    async findByUserId(userId) {
      return rows.get(userId) ?? null;
    },

    async upsert(userId, role: InternalRole) {
      const created: InternalStaff = {
        userId,
        role,
        createdAt: rows.get(userId)?.createdAt ?? new Date().toISOString(),
      };
      rows.set(userId, created);
      return created;
    },
  };
}
