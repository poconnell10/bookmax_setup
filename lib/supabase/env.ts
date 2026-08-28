export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export type SupabaseServerEnv = {
  secretKey: string;
};

export function getSupabasePublicEnv(
  source: Record<string, string | undefined> = process.env,
): SupabasePublicEnv {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public environment is not configured.");
  }

  return { url, publishableKey };
}

export function getSupabaseServerEnv(
  source: Record<string, string | undefined> = process.env,
): SupabaseServerEnv {
  if (source.NEXT_PUBLIC_SUPABASE_SECRET_KEY || source.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server credentials must not use the NEXT_PUBLIC prefix.");
  }

  const secretKey = source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error("Supabase server environment is not configured.");
  }

  return { secretKey };
}
