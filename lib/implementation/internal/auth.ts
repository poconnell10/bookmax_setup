import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/access/authorization";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { InternalError, type InternalStaff } from "@/lib/implementation/internal/types";
import { createSupabaseRouteClient, createSupabaseServerClient } from "@/lib/supabase/auth-clients";
import type { ViewerKind } from "@/lib/access/viewer";

/**
 * OTP authenticates identity. This module authorizes BookMax access from
 * internal_staff.user_id, never email domain, query string, or client role.
 */

export type InternalSession = InternalStaff & {
  email: string;
  attachAuthCookies: (response: import("next/server").NextResponse) => import("next/server").NextResponse;
};

async function sessionUser(request: NextRequest) {
  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user: error ? null : user, attachAuthCookies };
}

export async function requireInternalStaff(request: NextRequest): Promise<InternalSession> {
  const { user, attachAuthCookies } = await sessionUser(request);
  if (!user?.id) {
    throw new InternalError("unauthenticated", "Sign in to continue.");
  }
  const decision = await resolveAuthorization({ userId: user.id, email: user.email });
  if (decision.kind !== "internal") {
    throw new InternalError("forbidden", "You cannot access internal submissions.");
  }
  return {
    ...decision.staff,
    email: user.email ?? "",
    attachAuthCookies,
  };
}

export async function requireEngineer(request: NextRequest): Promise<InternalSession> {
  const staff = await requireInternalStaff(request);
  if (staff.role !== "engineer" && staff.role !== "admin") {
    throw new InternalError("forbidden", "You cannot open that internal workflow.");
  }
  return staff;
}

export async function requireAdmin(request: NextRequest): Promise<InternalSession> {
  const staff = await requireInternalStaff(request);
  if (staff.role !== "admin") {
    throw new InternalError("forbidden", "You cannot manage Users & Access.");
  }
  return staff;
}

export type InternalViewer = {
  kind: ViewerKind;
  email: string;
  name: string | null;
};

export async function getInternalViewer(): Promise<InternalViewer> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const decision = await resolveAuthorization({ userId: user?.id, email: user?.email });
    const email = user?.email ?? "";
    if (decision.kind === "internal") {
      return { kind: decision.role, email, name: null };
    }
    if (decision.kind === "customer") {
      return { kind: "customer", email, name: null };
    }
    if (decision.kind === "disabled") {
      return { kind: "disabled", email, name: null };
    }
    return { kind: "pending", email, name: null };
  } catch {
    return { kind: "pending", email: "", name: null };
  }
}

export async function getInternalViewerKind(): Promise<ViewerKind> {
  return (await getInternalViewer()).kind;
}

async function currentDecision() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return resolveAuthorization({ userId: user?.id, email: user?.email });
}

export async function requireInternalStaffPage(): Promise<InternalStaff> {
  const decision = await currentDecision();
  if (decision.kind === "unauthenticated") {
    redirect("/access");
  }
  if (decision.kind === "pending") {
    redirect("/access/pending");
  }
  if (decision.kind === "disabled") {
    redirect("/access/denied");
  }
  if (decision.kind === "customer") {
    const service = getCustomerService();
    const context = await service.getForUser(decision.userId);
    redirect(service.resumePath(context));
  }
  return decision.staff;
}

export async function requireAdminPage(): Promise<InternalStaff> {
  const staff = await requireInternalStaffPage();
  if (staff.role !== "admin") {
    redirect("/implementation/submissions");
  }
  return staff;
}

export async function requireEngineerPage(): Promise<InternalStaff> {
  const staff = await requireInternalStaffPage();
  if (staff.role !== "engineer" && staff.role !== "admin") {
    redirect("/implementation/submissions");
  }
  return staff;
}
