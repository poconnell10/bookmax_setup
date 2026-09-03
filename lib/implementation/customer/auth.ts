import "server-only";

import { NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";
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

  return {
    userId: user.id,
    email: user.email,
    attachAuthCookies,
  };
}
