import { InternalError, type InternalStaff } from "@/lib/implementation/internal/types";
import type { InternalStaffStore, StaffWrite } from "@/lib/implementation/internal/staff-store";

export function createMemoryStaffStore(seed: InternalStaff[] = []): InternalStaffStore {
  const rows = new Map<string, InternalStaff>(seed.map((row) => [row.userId, normalize(row)]));

  return {
    async findByUserId(userId) {
      return rows.get(userId) ?? null;
    },

    async list() {
      return [...rows.values()];
    },

    async upsert(input: StaffWrite) {
      const current = rows.get(input.userId);
      const stamp = new Date().toISOString();
      const next: InternalStaff = {
        userId: input.userId,
        role: input.role,
        status: input.status,
        createdAt: current?.createdAt ?? stamp,
        updatedAt: stamp,
        provisionedBy: input.provisionedBy,
      };
      rows.set(input.userId, next);
      return next;
    },

    async remove(userId) {
      const current = rows.get(userId);
      if (!current) {
        return;
      }
      if (current.role === "admin" && current.status === "active") {
        const remaining = [...rows.values()].filter(
          (row) => row.role === "admin" && row.status === "active" && row.userId !== userId,
        ).length;
        if (remaining === 0) {
          throw new InternalError("forbidden", "The last active Admin cannot be changed.");
        }
      }
      rows.delete(userId);
    },

    async countActiveAdmins(exceptUserId) {
      return [...rows.values()].filter(
        (row) =>
          row.role === "admin" &&
          row.status === "active" &&
          row.userId !== exceptUserId,
      ).length;
    },
  };
}

function normalize(row: InternalStaff): InternalStaff {
  return {
    userId: row.userId,
    role: row.role,
    status: row.status ?? "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
    provisionedBy: row.provisionedBy ?? null,
  };
}
