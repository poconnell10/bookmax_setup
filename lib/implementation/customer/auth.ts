import "server-only";

import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { landingPath, resolveAuthorization, type AccessDecision } from "@/lib/access/authorization";
import { getIdentityStore } from "@/lib/implementation/access/runtime";
import { createSupabaseRouteClient, createSupabaseServerClient } from "@/lib/supabase/auth-clients";
import { CustomerError } from "@/lib/implementation/customer/types";
import type { InternalStaff } from "@/lib/implementation/internal/types";

export type CustomerSession = {
  userId: string;
  email: string;
  attachAuthCookies: (response: import("next/server").NextResponse) => import("next/server").NextResponse;
};

export async function requireCustomerSession(request: NextRequest): Promise<CustomerSession> {
  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    throw new CustomerError("forbidden", "Sign in to continue.");
  }

  const decision = await resolveAuthorization({ userId: user.id, email: user.email });
  if (decision.kind !== "customer") {
    throw new CustomerError("forbidden", "You cannot access that implementation.");
  }

  return {
    userId: user.id,
    email: user.email,
    attachAuthCookies,
  };
}

export async function requireCustomerSetupPage(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const decision = await resolveAuthorization({ userId: user?.id, email: user?.email });
  if (decision.kind === "customer") {
    return;
  }
  redirect(landingPath(decision));
}

/**
 * An Admin acting on one Customer's property step names both the Customer and
 * the implementation. Both must still match: a stale link for a Customer who
 * has since moved implementation is refused rather than followed.
 */
export type AdminSetupScope = {
  customer: string | null;
  implementation: string | null;
};

export type PropertySetupSession = CustomerSession & {
  /** The Customer whose setup is read and written. */
  subjectUserId: string;
  subjectEmail: string;
  /** Set only when an Admin is acting on the Customer's behalf. */
  actingAdmin: InternalStaff | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adminSetupScopeFrom(params: {
  get(name: string): string | null;
}): AdminSetupScope {
  return { customer: params.get("customer"), implementation: params.get("implementation") };
}

function scopeRequested(scope: AdminSetupScope): boolean {
  return Boolean(scope.customer || scope.implementation);
}

async function authorizeAdminScope(
  decision: AccessDecision,
  scope: AdminSetupScope,
): Promise<{ staff: InternalStaff; email: string } | null> {
  if (decision.kind !== "internal" || decision.role !== "admin") {
    return null;
  }
  if (!scope.customer || !scope.implementation || !UUID.test(scope.customer) || !UUID.test(scope.implementation)) {
    return null;
  }
  const target = await resolveAuthorization({ userId: scope.customer, email: "" });
  if (target.kind !== "customer" || target.implementationId !== scope.implementation) {
    return null;
  }
  const identity = await getIdentityStore().getById(scope.customer);
  if (!identity) {
    return null;
  }
  return { staff: decision.staff, email: identity.email };
}

/**
 * The property step is the only setup surface an Admin may act on. Without a
 * scope this is exactly requireCustomerSession.
 */
export async function requirePropertySetupSession(request: NextRequest): Promise<PropertySetupSession> {
  const scope = adminSetupScopeFrom(request.nextUrl.searchParams);
  if (!scopeRequested(scope)) {
    const session = await requireCustomerSession(request);
    return { ...session, subjectUserId: session.userId, subjectEmail: session.email, actingAdmin: null };
  }

  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id || !user.email) {
    throw new CustomerError("forbidden", "Sign in to continue.");
  }
  const decision = await resolveAuthorization({ userId: user.id, email: user.email });
  const admin = await authorizeAdminScope(decision, scope);
  if (!admin) {
    throw new CustomerError("forbidden", "You cannot access that implementation.");
  }
  return {
    userId: user.id,
    email: user.email,
    attachAuthCookies,
    subjectUserId: scope.customer!,
    subjectEmail: admin.email,
    actingAdmin: admin.staff,
  };
}

export async function requirePropertySetupPage(scope: AdminSetupScope): Promise<void> {
  if (!scopeRequested(scope)) {
    await requireCustomerSetupPage();
    return;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const decision = await resolveAuthorization({ userId: user?.id, email: user?.email });
  if (await authorizeAdminScope(decision, scope)) {
    return;
  }
  redirect(decision.kind === "internal" && decision.role === "admin" ? "/implementation/users" : landingPath(decision));
}

export async function redirectInternalAwayFromCustomerShell(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const decision = await resolveAuthorization({ userId: user?.id, email: user?.email });
  if (decision.kind === "internal" || decision.kind === "disabled") {
    redirect(landingPath(decision));
  }
}
