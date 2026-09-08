import type { InternalRole } from "@/lib/implementation/internal/types";

export function canMutateSubmissions(role: InternalRole): boolean {
  return role === "engineer" || role === "admin";
}

export function canAdministerUsers(role: InternalRole): boolean {
  return role === "admin";
}
