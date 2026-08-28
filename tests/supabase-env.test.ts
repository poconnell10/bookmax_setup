import { describe, expect, it } from "vitest";
import { getSupabasePublicEnv, getSupabaseServerEnv } from "@/lib/supabase/env";

describe("getSupabasePublicEnv", () => {
  it("throws a generic error when configuration is missing", () => {
    expect(() => getSupabasePublicEnv({})).toThrow(
      "Supabase public environment is not configured.",
    );
  });

  it("reads configured public environment values", () => {
    const env = getSupabasePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    });

    expect(env.url.length).toBeGreaterThan(0);
    expect(env.publishableKey.length).toBeGreaterThan(0);
  });
});

describe("getSupabaseServerEnv", () => {
  it("throws a generic error when the server secret is missing", () => {
    expect(() => getSupabaseServerEnv({})).toThrow(
      "Supabase server environment is not configured.",
    );
  });

  it("rejects server secrets exposed with the NEXT_PUBLIC prefix", () => {
    expect(() =>
      getSupabaseServerEnv({
        SUPABASE_SECRET_KEY: "server-secret",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "leaked-secret",
      }),
    ).toThrow("Supabase server credentials must not use the NEXT_PUBLIC prefix.");
  });

  it("does not read a NEXT_PUBLIC-prefixed secret as the server credential", () => {
    expect(() =>
      getSupabaseServerEnv({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leaked-secret",
      }),
    ).toThrow("Supabase server credentials must not use the NEXT_PUBLIC prefix.");
  });

  it("reads SUPABASE_SECRET_KEY", () => {
    const env = getSupabaseServerEnv({
      SUPABASE_SECRET_KEY: "server-secret",
    });

    expect(env.secretKey).toBe("server-secret");
  });

  it("falls back to SUPABASE_SERVICE_ROLE_KEY", () => {
    const env = getSupabaseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    });

    expect(env.secretKey).toBe("legacy-service-role");
  });
});
