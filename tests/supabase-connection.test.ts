/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { checkSupabaseConnection } from "@/lib/supabase/check-connection";
import { createClient } from "@/lib/supabase/client";

describe("Supabase connectivity", () => {
  it("initializes the browser client from public environment values", () => {
    const client = createClient();

    expect(client).toBeTruthy();
    expect(typeof client.auth.getSession).toBe("function");
  });

  it(
    "reaches the configured project without querying application tables",
    async () => {
      const status = await checkSupabaseConnection();

      expect(status.clientInitialized).toBe(true);
      expect(status.projectReachable).toBe(true);
      expect(status.ok).toBe(true);
    },
    15_000,
  );
});
