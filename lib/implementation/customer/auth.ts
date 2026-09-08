import "server-only";

import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { landingPath, resolveAuthorization } from "@/lib/access/authorization";
import { createSupabaseRouteClient, createSupabaseServerClient } from "@/lib/supabase/auth-clients";
import { CustomerError } from "@/lib/implementation/customer/types";

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
