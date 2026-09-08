import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";
import { setCustomerSingletonsForTests } from "@/lib/implementation/customer/runtime";
import { createMemoryStaffStore } from "@/lib/implementation/internal/memory-staff-store";
import { setInternalSingletonsForTests } from "@/lib/implementation/internal/runtime";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-clients", () => ({
  createSupabaseRouteClient: () => ({
    supabase: {
      auth: {
        getUser: authMocks.getUser,
      },
    },
    attachAuthCookies: (response: NextResponse) => response,
  }),
}));

describe("M2 setup API", () => {
  beforeEach(() => {
    const store = createMemoryCustomerStore();
    setCustomerSingletonsForTests({
      store,
      service: createCustomerService(store),
    });
    setInternalSingletonsForTests({ staff: createMemoryStaffStore() });
    authMocks.getUser.mockReset();
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "jane@hotel.com" } },
      error: null,
    });
  });

  afterEach(() => {
    setCustomerSingletonsForTests({ store: null, service: null });
    setInternalSingletonsForTests({ staff: null, service: null });
  });

  it("INTAKE-001 — saves PMS selection after property exists", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    setCustomerSingletonsForTests({ store, service });
    await service.ensureForUser("user-1");
    await service.saveProperty("user-1", {
      name: "Hotel",
      city: "London",
      country: "uk",
      contactName: "Jane",
    });

    const { POST } = await import("@/app/api/setup/intake/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/setup/intake", {
        method: "POST",
        body: JSON.stringify({ step: "pms", pmsId: "mews" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.intake.pmsId).toBe("mews");
    expect(body.resumePath).toBe("/setup/review");
  });

  it("SUBMIT-002 — rejects duplicate submission", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    setCustomerSingletonsForTests({ store, service });
    setInternalSingletonsForTests({ staff: createMemoryStaffStore() });
    await service.ensureForUser("user-1");
    await service.saveProperty("user-1", {
      name: "Hotel",
      city: "London",
      country: "uk",
      contactName: "Jane",
    });
    await service.savePmsSelection("user-1", { pmsId: "mews", otherPmsName: "" });
    await service.saveConnectDetails("user-1", { pmsAccessMethod: "api" });
    await service.submitSetup("user-1", "jane@hotel.com");

    const { POST } = await import("@/app/api/setup/submit/route");
    const response = await POST(new NextRequest("http://localhost:3000/api/setup/submit", { method: "POST" }));
    expect(response.status).toBe(400);
  });
});
