import type { InternalRole, InternalStaff, StaffStatus } from "@/lib/implementation/internal/types";

export type StaffWrite = {
  userId: string;
  role: InternalRole;
  status: StaffStatus;
  provisionedBy: string | null;
};

export type InternalStaffStore = {
  findByUserId(userId: string): Promise<InternalStaff | null>;
  list(): Promise<InternalStaff[]>;
  upsert(input: StaffWrite): Promise<InternalStaff>;
  remove(userId: string): Promise<void>;
  countActiveAdmins(exceptUserId?: string): Promise<number>;
};
