import type { AccessAuditStore } from "@/lib/implementation/access/audit-store";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";
import { InternalError, type InternalRole } from "@/lib/implementation/internal/types";

export type AccountTypeTransition = {
  actorUserId: string;
  targetUserId: string;
} & (
  | { accountType: "internal"; role: InternalRole }
  | { accountType: "customer"; implementationId: string }
);

export type AccessStatusTransition = {
  actorUserId: string;
  targetUserId: string;
};

/**
 * An access change is a single authorization transition, not a sequence of
 * writes. The state change and its audit event must commit together or not at
 * all, so each is expressed as one operation and executed inside one database
 * transaction.
 */
export type AccessTransitionStore = {
  changeAccountType(input: AccountTypeTransition): Promise<void>;
  disable(input: AccessStatusTransition): Promise<void>;
  reactivate(input: AccessStatusTransition): Promise<void>;
};

/** Stage names the in-memory double can be told to fail at. */
export type TransitionStage = "staff" | "membership" | "status" | "audit";

/**
 * In-memory double. Postgres owns the real guarantee; this models it so the
 * service contract can be tested. Every injected failure is raised before any
 * mutation is applied, which is what makes a partial state unrepresentable
 * here, just as a rolled-back transaction makes it unrepresentable in the
 * database.
 */
export function createMemoryTransitionStore(deps: {
  staff: InternalStaffStore;
  customers: CustomerStore;
  audit: AccessAuditStore;
  failAt?: () => TransitionStage | null;
}): AccessTransitionStore {
  return {
    async changeAccountType(input) {
      const staffBefore = await deps.staff.findByUserId(input.targetUserId);
      const membershipBefore = await deps.customers.findMembershipByUserId(input.targetUserId);

      const previousState = {
        accountType: staffBefore ? "internal" : membershipBefore ? "customer" : "unassigned",
        role: staffBefore?.role ?? (membershipBefore ? "customer" : null),
        status: staffBefore?.status ?? membershipBefore?.status ?? "pending",
        implementationId: membershipBefore?.implementationId ?? null,
      };

      if (input.accountType === "customer") {
        const implementation = await deps.customers.findImplementationById(input.implementationId);
        if (!implementation) {
          throw new InternalError("not_found", "Implementation was not found.");
        }
      }

      const failure = deps.failAt?.();
      if (failure) {
        throw new InternalError("unavailable", `Injected failure at the ${failure} stage.`);
      }

      if (input.accountType === "internal") {
        await deps.staff.upsert({
          userId: input.targetUserId,
          role: input.role,
          status: "active",
          provisionedBy: input.actorUserId,
        });
        if (membershipBefore) {
          await deps.customers.updateMembership(input.targetUserId, { status: "disabled" });
        }
        await deps.audit.insert({
          eventType: "ACCOUNT_TYPE_CHANGED",
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          previousState,
          newState: { accountType: "internal", role: input.role, status: "active" },
        });
        return;
      }

      if (staffBefore) {
        await deps.staff.remove(input.targetUserId);
      }
      if (membershipBefore) {
        await deps.customers.updateMembership(input.targetUserId, {
          implementationId: input.implementationId,
          status: "active",
        });
      } else {
        await deps.customers.insertMembership({
          implementationId: input.implementationId,
          userId: input.targetUserId,
        });
      }
      await deps.audit.insert({
        eventType: "ACCOUNT_TYPE_CHANGED",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        previousState,
        newState: {
          accountType: "customer",
          role: "customer",
          status: "active",
          implementationId: input.implementationId,
        },
      });
    },

    async disable(input) {
      const staff = await deps.staff.findByUserId(input.targetUserId);
      const membership = await deps.customers.findMembershipByUserId(input.targetUserId);
      if (!staff && !membership) {
        throw new InternalError("invalid_input", "This user has no access to disable.");
      }

      const failure = deps.failAt?.();
      if (failure) {
        throw new InternalError("unavailable", `Injected failure at the ${failure} stage.`);
      }

      // Internal staff takes precedence, matching resolveAuthorization.
      if (staff) {
        await deps.staff.upsert({
          userId: input.targetUserId,
          role: staff.role,
          status: "disabled",
          provisionedBy: input.actorUserId,
        });
      } else {
        await deps.customers.updateMembership(input.targetUserId, { status: "disabled" });
      }

      await deps.audit.insert({
        eventType: "ACCESS_DISABLED",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        previousState: { status: "active", role: staff?.role ?? "customer" },
        newState: { status: "disabled" },
      });
    },

    async reactivate(input) {
      const staff = await deps.staff.findByUserId(input.targetUserId);
      const membership = await deps.customers.findMembershipByUserId(input.targetUserId);
      if (!staff && !membership) {
        throw new InternalError("invalid_input", "This user has no access to reactivate.");
      }

      const failure = deps.failAt?.();
      if (failure) {
        throw new InternalError("unavailable", `Injected failure at the ${failure} stage.`);
      }

      if (staff) {
        await deps.staff.upsert({
          userId: input.targetUserId,
          role: staff.role,
          status: "active",
          provisionedBy: input.actorUserId,
        });
        // Only one authorization path may be active.
        if (membership && membership.status === "active") {
          await deps.customers.updateMembership(input.targetUserId, { status: "disabled" });
        }
      } else {
        await deps.customers.updateMembership(input.targetUserId, { status: "active" });
      }

      await deps.audit.insert({
        eventType: "ACCESS_REACTIVATED",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        previousState: { status: "disabled" },
        newState: { status: "active", role: staff?.role ?? "customer" },
      });
    },
  };
}
