import type { InternalRole, InternalStaff } from "@/lib/implementation/internal/types";

export type InternalStaffStore = {
  findByUserId(userId: string): Promise<InternalStaff | null>;
  upsert(userId: string, role: InternalRole): Promise<InternalStaff>;
};
