import { maskEmail } from "@/lib/access/email";
import { isInternalEligibleEmail } from "@/lib/access/internal-eligibility";
import { canAdministerUsers } from "@/lib/access/capabilities";
import type { AccessAuditStore } from "@/lib/implementation/access/audit-store";
import type { IdentityStore } from "@/lib/implementation/access/identity-store";
import type {
  AccessAccountType,
  AccessUserStatus,
  AccessUserView,
  AttachableImplementations,
  ImplementationOption,
} from "@/lib/implementation/access/types";
import type { AccessTransitionStore, ProvisionProperty } from "@/lib/implementation/access/transition-store";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import type { InternalStaffStore } from "@/lib/implementation/internal/staff-store";
import { InternalError, type InternalRole, type InternalStaff } from "@/lib/implementation/internal/types";

type Actor = InternalStaff & { email?: string };

/**
 * Customer provisioning takes no implementation. The implementation a customer
 * owns is created by the grant itself, so a newly verified identity can never
 * be pointed at another customer's implementation.
 */
export type ProvisionInput =
  | { userId: string; accountType: "internal"; role: InternalRole }
  | { userId: string; accountType: "customer"; property?: ProvisionProperty | null };

export type ManageInput =
  | { action: "role"; role: InternalRole }
  | { action: "disable" }
  | { action: "reactivate" }
  | { action: "assign"; implementationId: string }
  | { action: "newImplementation" }
  | { action: "accountType"; accountType: "internal"; role: InternalRole }
  | { action: "accountType"; accountType: "customer"; implementationId?: string | null };

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
  transitions: AccessTransitionStore;
}) {
  async function implementationName(id: string | null): Promise<string | null> {
    if (!id) {
      return null;
    }
    const property = await deps.customers.findPropertyByImplementationId(id);
    return property?.name ?? null;
  }

  async function implementationSetup(id: string): Promise<AccessUserView["implementationSetup"]> {
    const [property, submission] = await Promise.all([
      deps.customers.findPropertyByImplementationId(id),
      deps.customers.findSubmissionByImplementationId(id),
    ]);
    if (submission) {
      return "submitted";
    }
    return property ? "draft" : "empty";
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
      implementationSetup: implementationId ? await implementationSetup(implementationId) : null,
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

  async function listAttachableImplementations(actor: Actor): Promise<AttachableImplementations> {
    assertAdmin(actor);
    const [implementations, memberships] = await Promise.all([
      deps.customers.listImplementations(),
      deps.customers.listMemberships(),
    ]);
    const attached = new Set(memberships.map((row) => row.implementationId));
    const rows = await Promise.all(
      implementations.map(async (row) => ({
        id: row.id,
        createdAt: row.createdAt,
        attached: attached.has(row.id),
        propertyName: await implementationName(row.id),
      })),
    );
    const options = rows
      .filter((row) => !row.attached)
      .map(({ id, propertyName, createdAt }) => ({ id, propertyName, createdAt }))
      .sort((a, b) => {
        if (a.propertyName && b.propertyName) return a.propertyName.localeCompare(b.propertyName);
        if (a.propertyName) return -1;
        if (b.propertyName) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    const hiddenCount = rows.filter((row) => row.attached && row.propertyName).length;
    return { options, hiddenCount };
  }

  /** Audit for an Admin saving a Customer's property from /setup/property. */
  async function recordCustomerPropertySaved(
    actor: Actor,
    targetUserId: string,
    input: { implementationId: string; propertyCreated: boolean },
  ) {
    assertAdmin(actor);
    await deps.audit.insert({
      eventType: "CUSTOMER_PROPERTY_SAVED",
      actorUserId: actor.userId,
      targetUserId,
      previousState: { implementationId: input.implementationId },
      newState: { implementationId: input.implementationId, propertyCreated: input.propertyCreated },
    });
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

    // Any staff row, active or disabled, outranks a membership in
    // resolveAuthorization, so a Customer grant here would be unreachable.
    if (existingStaff) {
      throw new InternalError("invalid_input", "This user has an internal account.");
    }

    let property: ProvisionProperty | null = null;
    if (input.property) {
      const name = input.property.name.trim();
      const contactName = input.property.contactName.trim();
      if (!name || !contactName) {
        throw new InternalError("invalid_input", "Enter both the property name and the contact name.");
      }
      property = { name, contactName };
    }

    // The new implementation, the membership, the optional property and the
    // audit event are one transition, so a failed grant leaves nothing behind.
    await deps.transitions.provisionCustomer({
      actorUserId: actor.userId,
      targetUserId: input.userId,
      property,
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
      if (!staff && !membership) {
        throw new InternalError("invalid_input", "This user has no access to disable.");
      }
      await deps.transitions.disable({ actorUserId: actor.userId, targetUserId: userId });
      return toView(identity);
    }

    if (input.action === "reactivate") {
      if (!staff && !membership) {
        throw new InternalError("invalid_input", "This user has no access to reactivate.");
      }
      await deps.transitions.reactivate({ actorUserId: actor.userId, targetUserId: userId });
      return toView(identity);
    }

    if (input.action === "accountType") {
      // The previous/new state snapshot is captured inside the transition so it
      // is written by the same statement as the membership change.
      if (input.accountType === "internal") {
        assertInternalEligible(identity.email);
        if (staff?.role === "admin" && staff.status === "active" && input.role !== "admin") {
          const remaining = await deps.staff.countActiveAdmins(userId);
          if (remaining === 0) {
            throw new InternalError("forbidden", "The last active Admin cannot be changed.");
          }
        }
        await deps.transitions.changeAccountType({
          actorUserId: actor.userId,
          targetUserId: userId,
          accountType: "internal",
          role: input.role,
        });
        return toView(identity);
      }

      if (staff?.role === "admin" && staff.status === "active") {
        const remaining = await deps.staff.countActiveAdmins(userId);
        if (remaining === 0) {
          throw new InternalError("forbidden", "The last active Admin cannot be changed.");
        }
      }
      await deps.transitions.changeAccountType({
        actorUserId: actor.userId,
        targetUserId: userId,
        accountType: "customer",
        implementationId: input.implementationId ?? null,
      });
      return toView(identity);
    }

    if (!membership || staff) {
      throw new InternalError("invalid_input", "Only customers can be moved between implementations.");
    }
    if (input.action === "assign" && !input.implementationId) {
      throw new InternalError("invalid_input", "Choose a property to attach.");
    }
    // An attach only ever targets an implementation no customer belongs to, and
    // the move, the cleanup of an implementation left empty, and the audit event
    // are one transition.
    await deps.transitions.setCustomerImplementation({
      actorUserId: actor.userId,
      targetUserId: userId,
      implementationId: input.action === "assign" ? input.implementationId : null,
    });
    return toView(identity);
  }

  return {
    list,
    listImplementationOptions,
    listAttachableImplementations,
    recordCustomerPropertySaved,
    get,
    provision,
    manage,
  };
}

export type AccessDirectoryService = ReturnType<typeof createAccessDirectoryService>;
