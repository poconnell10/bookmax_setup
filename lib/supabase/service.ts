import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServerEnv } from "@/lib/supabase/env";

export function createServiceClient() {
  const { url } = getSupabasePublicEnv();
  const { secretKey } = getSupabaseServerEnv();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
