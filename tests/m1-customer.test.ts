import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { logAccess } from "@/lib/access/log";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";
import { CustomerError } from "@/lib/implementation/customer/types";

describe("M1 customer implementation service", () => {
  it("AUTH-012 — creates exactly one implementation for a new user", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    const first = await service.ensureForUser("user-1");
    const second = await service.ensureForUser("user-1");
    const third = await service.ensureForUser("user-1");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(third.implementation.id).toBe(first.implementation.id);
    expect(second.implementation.id).toBe(first.implementation.id);
  });

  it("AUTH-013 / PROPERTY-005 — returning customer resumes the same implementation and property", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    await service.ensureForUser("user-1");
    const saved = await service.saveProperty("user-1", {
      name: "The Langham London",
      city: "London",
      country: "uk",
      contactName: "John Smith",
      jobTitle: "Director of IT",
    });
    const resumed = await service.ensureForUser("user-1");
    expect(resumed.created).toBe(false);
    expect(resumed.implementation.id).toBe(saved.implementation.id);
    expect(resumed.property?.id).toBe(saved.property?.id);
    expect(resumed.property?.name).toBe("The Langham London");
  });

  it("PROPERTY-004 — repeat property saves keep a single record", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    await service.ensureForUser("user-1");
    const first = await service.saveProperty("user-1", {
      name: "Hotel One",
      city: "Paris",
      country: "fr",
      contactName: "Marie",
    });
    const second = await service.saveProperty("user-1", {
      name: "Hotel One Updated",
      city: "Paris",
      country: "fr",
      contactName: "Marie",
    });
    expect(second.property?.id).toBe(first.property?.id);
    expect(second.property?.name).toBe("Hotel One Updated");
    expect(second.implementation.status).toBe("property_complete");
  });

  it("PROPERTY-002 — required property fields are validated", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    await service.ensureForUser("user-1");
    await expect(
      service.saveProperty("user-1", {
        name: "",
        city: "London",
        country: "uk",
        contactName: "John",
      }),
    ).rejects.toBeInstanceOf(CustomerError);
  });

  it("SECURITY-001 — another implementation id is forbidden", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    const a = await service.ensureForUser("user-a");
    await service.ensureForUser("user-b");
    await expect(service.assertOwnsImplementation("user-b", a.implementation.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("M1 security static checks", () => {
  it("SECURITY-003 — service-role credentials are not exposed to the browser client", () => {
    const root = process.cwd();
    const client = readFileSync(path.join(root, "lib/supabase/client.ts"), "utf8");
    const env = readFileSync(path.join(root, "lib/supabase/env.ts"), "utf8");
    expect(client).not.toMatch(/SERVICE_ROLE|SECRET_KEY/);
    expect(env).toMatch(/NEXT_PUBLIC_SUPABASE_SECRET_KEY|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
    expect(env).toContain("must not use the NEXT_PUBLIC prefix");
    expect(existsSync(path.join(root, "lib/supabase/service.ts"))).toBe(true);
    const service = readFileSync(path.join(root, "lib/supabase/service.ts"), "utf8");
    expect(service).toContain("server-only");
  });

  it("SECURITY-004 — OTP codes are not written to logs", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logAccess("otp_failed", { otp: "123456", token: "secret", reason: "invalid" });
    const printed = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(printed).not.toContain("123456");
    expect(printed).not.toContain("secret");
    expect(printed).toContain("otp_failed");
    spy.mockRestore();

    const files = [
      "app/api/access/otp/send/route.ts",
      "app/api/access/otp/verify/route.ts",
      "lib/access/log.ts",
    ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8"));
    for (const source of files) {
      expect(source).not.toMatch(/console\.(info|log|error|debug)\([^)]*token/);
      expect(source).not.toMatch(/logAccess\([^)]*otp:/);
    }
  });
});
