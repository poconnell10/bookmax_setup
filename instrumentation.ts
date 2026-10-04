import { validatePersistenceConfiguration } from "@/lib/implementation/persistence-config";
import { getSupabasePublicEnv, getSupabaseServerEnv } from "@/lib/supabase/env";

export function register() {
  validatePersistenceConfiguration();
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production"
  ) {
    getSupabasePublicEnv();
    getSupabaseServerEnv();
  }
}
