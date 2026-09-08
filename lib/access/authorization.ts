import "server-only";

import { getCustomerStore } from "@/lib/implementation/customer/runtime";
import { getStaffStore } from "@/lib/implementation/internal/runtime";
import type { InternalRole, InternalStaff } from "@/lib/implementation/internal/types";

export const ACCESS_KINDS = [
  "unauthenticated",
  "pending",
  "disabled",
  "internal",
  "customer",
] as const;

export type AccessKind = (typeof ACCESS_KINDS)[number];

export type AccessDecision =
  | { kind: "unauthenticated" }
  | { kind: "pending"; userId: string; email: string }
  | { kind: "disabled"; userId: string; email: string; accountType: "internal" | "customer" }
  | {
      kind: "internal";
      userId: string;
      email: string;
      role: InternalRole;
      staff: InternalStaff;
    }
  | {
      kind: "customer";
      userId: string;
      email: string;
      implementationId: string;
    };

export function landingPath(decision: AccessDecision): string {
  switch (decision.kind) {
    case "internal":
      return decision.role === "admin" ? "/implementation/users" : "/implementation/submissions";
    case "disabled":
      return "/access/denied";
    case "pending":
      return "/access/pending";
    case "unauthenticated":
      return "/access";
    case "customer":
      return "/setup/property";
  }
}

/**
 * Server-side authorization. OTP only proves identity.
 * Internal staff membership wins over customer membership.
 * Email domain, query strings, and client role claims are ignored.
 */
export async function resolveAuthorization(input: {
  userId?: string | null;
  email?: string | null;
}): Promise<AccessDecision> {
  if (!input.userId) {
    return { kind: "unauthenticated" };
  }

  const email = input.email ?? "";
  const staff = await getStaffStore().findByUserId(input.userId);
  if (staff) {
    if (staff.status === "active") {
      return {
        kind: "internal",
        userId: input.userId,
        email,
        role: staff.role,
        staff,
      };
    }
    return {
      kind: "disabled",
      userId: input.userId,
      email,
      accountType: "internal",
    };
  }

  const membership = await getCustomerStore().findMembershipByUserId(input.userId);
  if (membership) {
    if (membership.status === "disabled") {
      return {
        kind: "disabled",
        userId: input.userId,
        email,
        accountType: "customer",
      };
    }
    return {
      kind: "customer",
      userId: input.userId,
      email,
      implementationId: membership.implementationId,
    };
  }

  return { kind: "pending", userId: input.userId, email };
}

