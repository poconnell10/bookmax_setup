/** @vitest-environment node */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import {
  CONNECTION_TEST_TABLE,
  runPrivilegedConnectionTest,
  type ConnectionTestClient,
} from "@/lib/supabase/connection-test";

function createMockClient(options: {
  insert?: { id: string; created_at: string } | null;
  insertError?: { message: string } | null;
  read?: { id: string; test_value: string; created_at: string } | null;
  readError?: { message: string } | null;
}): ConnectionTestClient {
  return {
    from(table: string) {
      expect(table).toBe(CONNECTION_TEST_TABLE);

      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  return {
                    data: options.insert ?? null,
                    error: options.insertError ?? null,
                  };
                },
              };
            },
          };
        },
        select() {
          return {
            eq() {
              return {
                async single() {
                  return {
                    data: options.read ?? null,
                    error: options.readError ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("privileged connectivity test", () => {
  it("proves server-side insert then read against the temporary table", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const createdAt = "2026-08-27T00:00:00.000Z";
    let capturedValue = "";

    const client: ConnectionTestClient = {
      from(table) {
        expect(table).toBe("bookmax_connection_test");

        return {
          insert(row) {
            capturedValue = row.test_value;
            return {
              select() {
                return {
                  async single() {
                    return { data: { id, created_at: createdAt }, error: null };
                  },
                };
              },
            };
          },
          select() {
            return {
              eq(_column, value) {
                expect(value).toBe(id);
                return {
                  async single() {
                    return {
                      data: { id, test_value: capturedValue, created_at: createdAt },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const result = await runPrivilegedConnectionTest(client);

    expect(result).toEqual({ ok: true, write: true, read: true, id });
    expect(capturedValue.startsWith("m0-connectivity-")).toBe(true);
  });

  it("fails closed when insert is denied", async () => {
    const result = await runPrivilegedConnectionTest(
      createMockClient({
        insert: null,
        insertError: { message: "permission denied" },
      }),
    );

    expect(result).toEqual({ ok: false, write: false, read: false, id: null });
  });

  it("fails closed when the inserted row cannot be read back", async () => {
    const result = await runPrivilegedConnectionTest(
      createMockClient({
        insert: { id: "row-1", created_at: "2026-08-27T00:00:00.000Z" },
        read: null,
        readError: { message: "not found" },
      }),
    );

    expect(result).toEqual({ ok: false, write: true, read: false, id: null });
  });
});

describe("temporary connectivity table", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260827212600_bookmax_connection_test.sql"),
    "utf8",
  );

  it("creates only the temporary probe table with RLS and no anon policies", () => {
    expect(sql).toContain("bookmax_connection_test");
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.bookmax_connection_test from anon/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/\bcustomers\b|\bproperties\b|\bpms_connections\b/i);
    expect(sql).not.toMatch(/implementation_submissions|credentials|audit/i);
  });
});

describe("browser security boundary", () => {
  it(
    "does not allow the publishable browser client to write the probe table",
    async () => {
      const client = createClient();
      const { data, error } = await client
        .from(CONNECTION_TEST_TABLE)
        .insert({ test_value: "browser-must-not-write" })
        .select("id");

      expect(error).toBeTruthy();
      expect(data === null || data.length === 0).toBe(true);
    },
    15_000,
  );
});

describe("connection-test route", () => {
  it("is a fixed server-side probe, not a general database endpoint", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "app/api/supabase/connection-test/route.ts"),
      "utf8",
    );

    expect(routeSource).toContain("createServiceClient");
    expect(routeSource).toContain("runPrivilegedConnectionTest");
    expect(routeSource).not.toMatch(/searchParams|request\.json|req\.json/i);
    expect(routeSource).not.toMatch(/console\.(log|debug|info|error)/);
  });

  it("returns a closed failure without leaking configuration when the service client cannot be created", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/service", () => ({
      createServiceClient: () => {
        throw new Error("missing server env");
      },
    }));

    const { POST } = await import("@/app/api/supabase/connection-test/route");
    const response = await POST();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, write: false, read: false, id: null });
    expect(JSON.stringify(body)).not.toMatch(/missing server env|secret|apikey/i);
  });
});
