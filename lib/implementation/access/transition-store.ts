import type { AccessAuditStore } from "@/lib/implementation/access/audit-store";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";
import { InternalError, type InternalRole } from "@/lib/implementation/internal/types";

export type AccountTypeTransition = {
  actorUserId: string;
  targetUserId: string;
} & (
  | { accountType: "internal"; role: InternalRole }
  /**
   * An identity with no membership yet has no implementation to be pointed at,
   * so the target is optional and one is created. Moving an existing Customer
   * between implementations still requires an explicit target.
   */
  | { accountType: "customer"; implementationId?: string | null }
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
  provisionCustomer(input: AccessStatusTransition): Promise<void>;
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
    async provisionCustomer(input) {
      const membershipBefore = await deps.customers.findMembershipByUserId(input.targetUserId);

      const failure = deps.failAt?.();
      if (failure) {
        throw new InternalError("unavailable", `Injected failure at the ${failure} stage.`);
      }

      let implementationId = membershipBefore?.implementationId ?? null;
      if (membershipBefore) {
        // A membership that was disabled keeps the implementation it already
        // had. Re-granting access must not strand its existing setup.
        await deps.customers.updateMembership(input.targetUserId, { status: "active" });
      } else {
        // Onboarding access gets its own empty implementation. A new identity is
        // never attached to another customer's implementation.
        const implementation = await deps.customers.insertImplementation();
        implementationId = implementation.id;
        await deps.customers.insertMembership({
          implementationId: implementation.id,
          userId: input.targetUserId,
        });
      }

      await deps.audit.insert({
        eventType: "USER_PROVISIONED",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        previousState: {
          accountType: membershipBefore ? "customer" : "unassigned",
          role: membershipBefore ? "customer" : null,
          status: membershipBefore?.status ?? "pending",
        },
        newState: {
          accountType: "customer",
          role: "customer",
          status: "active",
          implementationId,
        },
      });
    },

    async changeAccountType(input) {
      const staffBefore = await deps.staff.findByUserId(input.targetUserId);
      const membershipBefore = await deps.customers.findMembershipByUserId(input.targetUserId);

      const previousState = {
        accountType: staffBefore ? "internal" : membershipBefore ? "customer" : "unassigned",
        role: staffBefore?.role ?? (membershipBefore ? "customer" : null),
        status: staffBefore?.status ?? membershipBefore?.status ?? "pending",
        implementationId: membershipBefore?.implementationId ?? null,
      };

      if (input.accountType === "customer" && input.implementationId) {
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
      let implementationId = input.implementationId ?? null;
      if (membershipBefore) {
        // Reassignment stays explicit: without a target the identity keeps the
        // implementation it already belongs to.
        const updated = await deps.customers.updateMembership(input.targetUserId, {
          implementationId: implementationId ?? undefined,
          status: "active",
        });
        implementationId = updated.implementationId;
      } else {
        if (!implementationId) {
          const implementation = await deps.customers.insertImplementation();
          implementationId = implementation.id;
        }
        await deps.customers.insertMembership({
          implementationId,
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
          implementationId,
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
