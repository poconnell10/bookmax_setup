import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseRouteClient, createSupabaseServerClient } from "@/lib/supabase/auth-clients";
import { getStaffStore } from "@/lib/implementation/internal/runtime";
import { InternalError, type InternalStaff } from "@/lib/implementation/internal/types";
import type { ViewerKind } from "@/lib/access/viewer";

export type InternalSession = InternalStaff & {
  email: string;
  attachAuthCookies: (response: import("next/server").NextResponse) => import("next/server").NextResponse;
};

export async function requireInternalStaff(request: NextRequest): Promise<InternalSession> {
  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new InternalError("forbidden", "Sign in to continue.");
  }

  const staff = await getStaffStore().findByUserId(user.id);
  if (!staff) {
    throw new InternalError("forbidden", "You cannot access internal submissions.");
  }

  return {
    ...staff,
    email: user.email ?? "",
    attachAuthCookies,
  };
}

export async function requireEngineer(request: NextRequest): Promise<InternalSession> {
  const staff = await requireInternalStaff(request);
  if (staff.role !== "engineer") {
    throw new InternalError("forbidden", "You cannot open that internal workflow.");
  }
  return staff;
}

export async function getInternalViewerKind(): Promise<ViewerKind> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return "customer";
    }
    const staff = await getStaffStore().findByUserId(user.id);
    return staff ? "internal" : "customer";
  } catch {
    return "customer";
  }
}

export async function requireInternalStaffPage(): Promise<InternalStaff> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect("/access");
  }
  const staff = await getStaffStore().findByUserId(user.id);
  if (!staff) {
    redirect("/setup/property");
  }
  return staff;
}

export async function requireEngineerPage(): Promise<InternalStaff> {
  const staff = await requireInternalStaffPage();
  if (staff.role !== "engineer") {
    redirect(`/implementation/submissions`);
  }
  return staff;
}
