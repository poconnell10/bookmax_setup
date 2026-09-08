import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  await supabase.auth.signOut();
  return attachAuthCookies(NextResponse.json({ ok: true }));
}
