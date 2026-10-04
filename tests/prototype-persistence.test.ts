// @vitest-environment node
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmissionRecord } from "@/types/implementation";
import { validatePersistenceConfiguration } from "@/lib/implementation/persistence-config";
import { register } from "@/instrumentation";
import { createInitialIntakeState } from "@/lib/implementation/selectors";

const faults = vi.hoisted(() => ({ failRename: false }));
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (faults.failRename) {
        faults.failRename = false;
        throw new Error("Simulated rename failure");
      }
      return actual.rename(...args);
    },
  };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    throw new Error("Database configuration unavailable");
  },
}));

function record(id: string): SubmissionRecord {
  return {
    submission_id: id,
    organisation: id,
    properties: [id],
    country: "Spain",
    primary_contact: "Contact",
    primary_contact_email: "contact@example.com",
    pms: "OPERA Cloud",
    pms_version: "Cloud",
    pms_type: "Cloud",
    technical_contact: "Contact",
    technical_contact_email: "contact@example.com",
    technical_contact_mobile: "",
    connection_method: "OHIP",
    connection_details: { "Hotel ID": id, client_secret: "never-write-this" },
    connection_details_status: "complete",
    credentials_status: "not_received",
    submitted_at: "27 Aug 2026, 3:14 pm",
    submitted_by: "Contact",
    status: "Submitted",
    created_at: "",
    updated_at: "",
  };
}

let directory: string;
beforeEach(async () => {
  vi.resetModules();
  faults.failRename = false;
  directory = await mkdtemp(join(tmpdir(), "e28-247-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BOOKMAX_PERSISTENCE", "prototype");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("persistence deployment guard", () => {
  it.each(["prototype", "file", "unexpected"])(
    "rejects %s during production startup even under Vitest",
    (backend) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("BOOKMAX_PERSISTENCE", backend);
      vi.stubEnv("VITEST", "true");
      expect(() => register()).toThrow();
    },
  );

  it.each(["production", "preview"])(
    "rejects prototype on Vercel %s even with development NODE_ENV",
    (environment) => {
      vi.stubEnv("VERCEL_ENV", environment);
      expect(() => register()).toThrow(/local development/);
    },
  );

  it("requires explicit opt-in and a known development environment", async () => {
    const { prototypePersistence } =
      await import("@/lib/implementation/persistence");
    vi.stubEnv("BOOKMAX_PERSISTENCE", undefined);
    await expect(prototypePersistence.loadDraft("draft")).rejects.toThrow(
      /explicitly/,
    );
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("BOOKMAX_PERSISTENCE", "prototype");
    expect(() => register()).toThrow(/local development/);
  });

  it("does not let direct prototype entry points bypass production protection", async () => {
    const persistence = await import("@/lib/implementation/persistence");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKMAX_PERSISTENCE", "database");
    await expect(
      persistence.prototypePersistence.loadDraft("draft"),
    ).rejects.toThrow();
    await expect(
      persistence.prototypePersistence.saveDraft(createInitialIntakeState()),
    ).rejects.toThrow();
    await expect(
      persistence.prototypePersistence.submitCredentials("blocked", {
        clientId: "id",
        clientSecret: "test-secret",
        applicationKey: "key",
      }),
    ).rejects.toThrow();
    await expect(
      persistence.prototypePersistence.submitImplementation(record("blocked")),
    ).rejects.toThrow();
    await expect(persistence.listPrototypeSubmissions()).rejects.toThrow();
    await expect(
      persistence.getPrototypeSubmission("blocked"),
    ).rejects.toThrow();
    await expect(
      persistence.updatePrototypeSubmissionStatus("blocked", "Ready"),
    ).rejects.toThrow();
    expect(() => persistence.credentialsWereReceived("blocked")).toThrow();
    const { writePrototypeSnapshot } =
      await import("@/lib/implementation/prototype-file-store");
    await expect(
      writePrototypeSnapshot(join(directory, "blocked.json"), "{}"),
    ).rejects.toThrow();
    expect(await readdir(directory)).toEqual([]);
  });

  it("requires database configuration at production startup", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKMAX_PERSISTENCE", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
    expect(() => register()).toThrow(/Supabase public environment/);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    expect(() => register()).toThrow(/Supabase server environment/);
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-key");
    expect(() => register()).not.toThrow();
  });

  it("defaults to database and propagates database failure without creating a file", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKMAX_PERSISTENCE", undefined);
    expect(() => validatePersistenceConfiguration()).not.toThrow();
    const { getCustomerStore } =
      await import("@/lib/implementation/customer/runtime");
    expect(() => getCustomerStore()).toThrow(
      "Database configuration unavailable",
    );
    expect(await readdir(directory)).toEqual([]);
  });

  it("keeps isolated tests in memory", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BOOKMAX_PERSISTENCE", undefined);
    const { prototypePersistence } =
      await import("@/lib/implementation/persistence");
    await prototypePersistence.submitImplementation(record("test-only"));
    expect(await readdir(directory)).toEqual([]);
  });
});

describe("local prototype write integrity", () => {
  it("preserves concurrent submissions and status updates across reloads with no secret or temporary files", async () => {
    const persistence = await import("@/lib/implementation/persistence");
    const records = Array.from({ length: 40 }, (_, index) =>
      record(`local-${index}`),
    );
    let complete = false;
    let observations = 0;
    const writes = Promise.all(
      records.map((item) =>
        persistence.prototypePersistence.submitImplementation(item),
      ),
    ).finally(() => {
      complete = true;
    });
    while (!complete) {
      try {
        const snapshot = JSON.parse(
          await readFile(
            join(directory, "data", "poc-submissions.json"),
            "utf8",
          ),
        );
        expect(Array.isArray(snapshot.submissions)).toBe(true);
        observations += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await writes;
    expect(observations).toBeGreaterThan(0);
    await Promise.all(
      records.map((item) =>
        persistence.updatePrototypeSubmissionStatus(
          item.submission_id,
          "Ready",
        ),
      ),
    );
    const raw = await readFile(
      join(directory, "data", "poc-submissions.json"),
      "utf8",
    );
    const saved = JSON.parse(raw).submissions as SubmissionRecord[];
    expect(
      saved.filter((item) => item.submission_id.startsWith("local-")),
    ).toHaveLength(40);
    expect(
      saved
        .filter((item) => item.submission_id.startsWith("local-"))
        .every((item) => item.status === "Ready"),
    ).toBe(true);
    expect(raw).not.toContain("never-write-this");
    expect(await readdir(join(directory, "data"))).toEqual([
      "poc-submissions.json",
    ]);
    vi.resetModules();
    const reloaded = await import("@/lib/implementation/persistence");
    expect(await reloaded.getPrototypeSubmission("local-39")).toMatchObject({
      status: "Ready",
    });
  });

  it("deduplicates concurrent duplicate submissions after a successful write", async () => {
    const { prototypePersistence, listPrototypeSubmissions } =
      await import("@/lib/implementation/persistence");
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prototypePersistence.submitImplementation(record("same")),
      ),
    );
    expect(new Set(results.map((result) => result.submissionId)).size).toBe(1);
    expect(
      (await listPrototypeSubmissions()).filter(
        (item) => item.submission_id === "same",
      ),
    ).toHaveLength(1);
  });

  it("leaves the previous snapshot intact on rename failure, cleans up, and allows retry", async () => {
    const persistence = await import("@/lib/implementation/persistence");
    await persistence.prototypePersistence.submitImplementation(
      record("first"),
    );
    const file = join(directory, "data", "poc-submissions.json");
    const previous = await readFile(file, "utf8");
    faults.failRename = true;
    await expect(
      persistence.prototypePersistence.submitImplementation(record("retry")),
    ).rejects.toThrow(/rename failure/);
    expect(await readFile(file, "utf8")).toBe(previous);
    expect(await persistence.getPrototypeSubmission("retry")).toBeUndefined();
    expect(await readdir(join(directory, "data"))).toEqual([
      "poc-submissions.json",
    ]);
    await persistence.prototypePersistence.submitImplementation(
      record("retry"),
    );
    expect(JSON.parse(await readFile(file, "utf8")).submissions).toHaveLength(
      3,
    );
  });

  it.each(['{"submissions":', '{"submissions":{}}', '{"submissions":[null]}'])(
    "surfaces corrupted data without overwriting it: %s",
    async (contents) => {
      await mkdir(join(directory, "data"));
      const file = join(directory, "data", "poc-submissions.json");
      await writeFile(file, contents);
      const { listPrototypeSubmissions } =
        await import("@/lib/implementation/persistence");
      await expect(listPrototypeSubmissions()).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(contents);
    },
  );
});
