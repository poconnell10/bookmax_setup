import { createClient } from "@/lib/supabase/client";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type SupabaseConnectionStatus = {
  ok: boolean;
  clientInitialized: boolean;
  projectReachable: boolean;
};

const REQUEST_TIMEOUT_MS = 10_000;
const ABSENT_RELATION = "_bookmax_connectivity_check";

function isReachableWithoutSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return true;
  }

  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "PGRST205" || code === "PGRST106" || code === "42P01") {
    return true;
  }

  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

async function isHttpOk(path: string, url: string, publishableKey?: string) {
  const headers = new Headers();

  if (publishableKey) {
    headers.set("apikey", publishableKey);
  }

  const response = await fetch(new URL(path, url), {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return response.ok;
}

export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  let client;

  try {
    getSupabasePublicEnv();
    client = createClient();
  } catch {
    return {
      ok: false,
      clientInitialized: false,
      projectReachable: false,
    };
  }

  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const authHealthy = await isHttpOk("/auth/v1/health", url, publishableKey);
    const jwksReachable = authHealthy
      ? true
      : await isHttpOk("/auth/v1/.well-known/jwks.json", url);

    const { error } = await client.from(ABSENT_RELATION).select("id").limit(0);
    const dataApiReachable = isReachableWithoutSchema(error);

    const projectReachable = authHealthy || jwksReachable || dataApiReachable;

    return {
      ok: projectReachable,
      clientInitialized: true,
      projectReachable,
    };
  } catch {
    return {
      ok: false,
      clientInitialized: true,
      projectReachable: false,
    };
  }
}
