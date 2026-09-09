import { maskEmail } from "@/lib/access/email";
import { isInternalEligibleEmail } from "@/lib/access/internal-eligibility";
import { canAdministerUsers } from "@/lib/access/capabilities";
import type { AccessAuditStore } from "@/lib/implementation/access/audit-store";
import type { IdentityStore } from "@/lib/implementation/access/identity-store";
import type {
  AccessAccountType,
  AccessUserStatus,
  AccessUserView,
  ImplementationOption,
} from "@/lib/implementation/access/types";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";
import { InternalError, type InternalRole, type InternalStaff } from "@/lib/implementation/internal/types";

type Actor = InternalStaff & { email?: string };

export type ProvisionInput =
  | { userId: string; accountType: "internal"; role: InternalRole }
  | { userId: string; accountType: "customer"; implementationId: string };

export type ManageInput =
  | { action: "role"; role: InternalRole }
  | { action: "disable" }
  | { action: "reactivate" }
  | { action: "assign"; implementationId: string }
  | { action: "accountType"; accountType: "internal"; role: InternalRole }
  | { action: "accountType"; accountType: "customer"; implementationId: string };

function assertAdmin(actor: Actor) {
  if (!canAdministerUsers(actor.role) || actor.status !== "active") {
    throw new InternalError("forbidden", "You cannot manage Users & Access.");
  }
}

function assertInternalEligible(email: string) {
  if (!isInternalEligibleEmail(email)) {
    throw new InternalError(
      "invalid_input",
      "Internal access can only be granted to frontlinepg.com or in-gauge.io identities.",
    );
  }
}

export function createAccessDirectoryService(deps: {
  identities: IdentityStore;
  staff: InternalStaffStore;
  customers: CustomerStore;
  audit: AccessAuditStore;
}) {
  async function implementationName(id: string | null): Promise<string | null> {
    if (!id) {
      return null;
    }
    const property = await deps.customers.findPropertyByImplementationId(id);
    return property?.name ?? null;
  }

  async function toView(identity: {
    userId: string;
    email: string;
    lastSignInAt: string | null;
    createdAt: string;
  }): Promise<AccessUserView> {
    const staff = await deps.staff.findByUserId(identity.userId);
    const membership = await deps.customers.findMembershipByUserId(identity.userId);
    let accountType: AccessAccountType = "unassigned";
    let role: AccessUserView["role"] = null;
    let status: AccessUserStatus = "pending";
    let implementationId: string | null = null;

    if (staff) {
      accountType = "internal";
      role = staff.role;
      status = staff.status;
    } else if (membership) {
      accountType = "customer";
      role = "customer";
      status = membership.status;
      implementationId = membership.implementationId;
    }

    return {
      userId: identity.userId,
      email: identity.email,
      emailMasked: maskEmail(identity.email),
      name: null,
      accountType,
      role,
      status,
      lastSignInAt: identity.lastSignInAt,
      firstSignInAt: identity.createdAt,
      implementationId,
      implementationName: await implementationName(implementationId),
      provisionedBy: staff?.provisionedBy ?? null,
    };
  }

  async function list(_actor: Actor): Promise<AccessUserView[]> {
    assertAdmin(_actor);
    const identities = await deps.identities.list();
    const views = await Promise.all(identities.map((row) => toView(row)));
    return views.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") {
        return -1;
      }
      if (b.status === "pending" && a.status !== "pending") {
        return 1;
      }
      return (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "");
    });
  }

  async function listImplementationOptions(_actor: Actor): Promise<ImplementationOption[]> {
    assertAdmin(_actor);
    const implementations = await deps.customers.listImplementations();
    const options = await Promise.all(
      implementations.map(async (row) => ({
        id: row.id,
        name: (await implementationName(row.id)) || row.id.slice(0, 8),
      })),
    );
    return options;
  }

  async function get(actor: Actor, userId: string) {
    assertAdmin(actor);
    const identity = await deps.identities.getById(userId);
    if (!identity) {
      throw new InternalError("not_found", "User was not found.");
    }
    const view = await toView(identity);
    const audit = await deps.audit.listByTarget(userId);
    return { user: view, audit };
  }

  async function provision(actor: Actor, input: ProvisionInput) {
    assertAdmin(actor);
    const identity = await deps.identities.getById(input.userId);
    if (!identity) {
      throw new InternalError("not_found", "User was not found.");
    }
    const existingStaff = await deps.staff.findByUserId(input.userId);
    const existingMembership = await deps.customers.findMembershipByUserId(input.userId);
    if (existingStaff?.status === "active" || existingMembership?.status === "active") {
      throw new InternalError("invalid_input", "This user already has BookMax access.");
    }

    if (input.accountType === "internal") {
      assertInternalEligible(identity.email);
      const staff = await deps.staff.upsert({
        userId: input.userId,
        role: input.role,
        status: "active",
        provisionedBy: actor.userId,
      });
      await deps.audit.insert({
        eventType: "USER_PROVISIONED",
        actorUserId: actor.userId,
        targetUserId: input.userId,
        previousState: { accountType: "unassigned", role: null, status: "pending" },
        newState: { accountType: "internal", role: staff.role, status: "active" },
      });
      return toView(identity);
    }

    const implementation = await deps.customers.findImplementationById(input.implementationId);
    if (!implementation) {
      throw new InternalError("not_found", "Implementation was not found.");
    }
    if (existingMembership) {
      await deps.customers.updateMembership(input.userId, {
        implementationId: input.implementationId,
        status: "active",
      });
    } else {
      await deps.customers.insertMembership({
        implementationId: input.implementationId,
        userId: input.userId,
      });
    }
    await deps.audit.insert({
      eventType: "USER_PROVISIONED",
      actorUserId: actor.userId,
      targetUserId: input.userId,
      previousState: { accountType: "unassigned", role: null, status: "pending" },
      newState: {
        accountType: "customer",
        role: "customer",
        status: "active",
        implementationId: input.implementationId,
      },
    });
    return toView(identity);
  }

  async function manage(actor: Actor, userId: string, input: ManageInput) {
    assertAdmin(actor);
    const identity = await deps.identities.getById(userId);
    if (!identity) {
      throw new InternalError("not_found", "User was not found.");
    }
    const staff = await deps.staff.findByUserId(userId);
    const membership = await deps.customers.findMembershipByUserId(userId);

    if (input.action === "role") {
      if (!staff) {
        throw new InternalError("invalid_input", "Only internal users have an internal role.");
      }
      if (staff.role === "admin" && input.role !== "admin") {
        const remaining = await deps.staff.countActiveAdmins(userId);
        if (staff.status === "active" && remaining === 0) {
          throw new InternalError("forbidden", "The last active Admin cannot be changed.");
        }
      }
      const previous = staff.role;
      await deps.staff.upsert({
        userId,
        role: input.role,
        status: staff.status,
        provisionedBy: actor.userId,
      });
      await deps.audit.insert({
        eventType: "ROLE_CHANGED",
        actorUserId: actor.userId,
        targetUserId: userId,
        previousState: { role: previous },
        newState: { role: input.role },
      });
      return toView(identity);
    }

    if (input.action === "disable") {
      if (staff?.role === "admin" && staff.status === "active") {
        const remaining = await deps.staff.countActiveAdmins(userId);
        if (remaining === 0) {
          throw new InternalError("forbidden", "The last active Admin cannot be disabled.");
        }
      }
      if (staff) {
        await deps.staff.upsert({
          userId,
          role: staff.role,
          status: "disabled",
          provisionedBy: actor.userId,
        });
      } else if (membership) {
        await deps.customers.updateMembership(userId, { status: "disabled" });
      } else {
        throw new InternalError("invalid_input", "This user has no access to disable.");
      }
      await deps.audit.insert({
        eventType: "ACCESS_DISABLED",
        actorUserId: actor.userId,
        targetUserId: userId,
        previousState: { status: "active", role: staff?.role ?? "customer" },
        newState: { status: "disabled" },
      });
      return toView(identity);
    }

    if (input.action === "reactivate") {
      if (staff) {
        await deps.staff.upsert({
          userId,
          role: staff.role,
          status: "active",
          provisionedBy: actor.userId,
        });
      } else if (membership) {
        await deps.customers.updateMembership(userId, { status: "active" });
      } else {
        throw new InternalError("invalid_input", "This user has no access to reactivate.");
      }
      await deps.audit.insert({
        eventType: "ACCESS_REACTIVATED",
        actorUserId: actor.userId,
        targetUserId: userId,
        previousState: { status: "disabled" },
        newState: { status: "active", role: staff?.role ?? "customer" },
      });
      return toView(identity);
    }

    if (input.action === "accountType") {
      const previous = {
        accountType: staff ? "internal" : membership ? "customer" : "unassigned",
        role: staff?.role ?? (membership ? "customer" : null),
        status: staff?.status ?? membership?.status ?? "pending",
        implementationId: membership?.implementationId ?? null,
      };

      if (input.accountType === "internal") {
        assertInternalEligible(identity.email);
        if (staff?.role === "admin" && staff.status === "active" && input.role !== "admin") {
          const remaining = await deps.staff.countActiveAdmins(userId);
          if (remaining === 0) {
            throw new InternalError("forbidden", "The last active Admin cannot be changed.");
          }
        }
        await deps.staff.upsert({
          userId,
          role: input.role,
          status: "active",
          provisionedBy: actor.userId,
        });
        if (membership) {
          await deps.customers.updateMembership(userId, { status: "disabled" });
        }
        await deps.audit.insert({
          eventType: "ACCOUNT_TYPE_CHANGED",
          actorUserId: actor.userId,
          targetUserId: userId,
          previousState: previous,
          newState: { accountType: "internal", role: input.role, status: "active" },
        });
        return toView(identity);
      }

      if (staff?.role === "admin" && staff.status === "active") {
        const remaining = await deps.staff.countActiveAdmins(userId);
        if (remaining === 0) {
          throw new InternalError("forbidden", "The last active Admin cannot be changed.");
        }
      }
      if (!input.implementationId) {
        throw new InternalError("invalid_input", "Customer access requires an implementation.");
      }
      const implementation = await deps.customers.findImplementationById(input.implementationId);
      if (!implementation) {
        throw new InternalError("not_found", "Implementation was not found.");
      }
      if (staff) {
        await deps.staff.remove(userId);
      }
      if (membership) {
        await deps.customers.updateMembership(userId, {
          implementationId: input.implementationId,
          status: "active",
        });
      } else {
        await deps.customers.insertMembership({
          implementationId: input.implementationId,
          userId,
        });
      }
      await deps.audit.insert({
        eventType: "ACCOUNT_TYPE_CHANGED",
        actorUserId: actor.userId,
        targetUserId: userId,
        previousState: previous,
        newState: {
          accountType: "customer",
          role: "customer",
          status: "active",
          implementationId: input.implementationId,
        },
      });
      return toView(identity);
    }

    if (!membership) {
      throw new InternalError("invalid_input", "Only customers can be moved between implementations.");
    }
    const previous = membership.implementationId;
    await deps.customers.updateMembership(userId, { implementationId: input.implementationId });
    await deps.audit.insert({
      eventType: "CUSTOMER_ASSIGNMENT_CHANGED",
      actorUserId: actor.userId,
      targetUserId: userId,
      previousState: { implementationId: previous },
      newState: { implementationId: input.implementationId },
    });
    return toView(identity);
  }

  return { list, listImplementationOptions, get, provision, manage };
}

export type AccessDirectoryService = ReturnType<typeof createAccessDirectoryService>;
