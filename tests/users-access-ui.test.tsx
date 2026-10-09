import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersAccessScreen } from "@/components/access/UsersAccessScreen";
import type { AccessUserView } from "@/lib/implementation/access/types";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const users: AccessUserView[] = [
  {
    userId: "admin-1",
    email: "admin@bookmax.ai",
    emailMasked: "ad•••@bookmax.ai",
    name: "Padraig O'Connell",
    accountType: "internal",
    role: "admin",
    status: "active",
    lastSignInAt: "2026-09-08T12:00:00.000Z",
    firstSignInAt: "2026-06-12T08:00:00.000Z",
    implementationId: null,
    implementationName: null,
    implementationSetup: null,
    provisionedBy: null,
  },
  {
    userId: "eng-1",
    email: "engineer@bookmax.ai",
    emailMasked: "en•••@bookmax.ai",
    name: "Marc Delaney",
    accountType: "internal",
    role: "engineer",
    status: "active",
    lastSignInAt: "2026-09-08T11:00:00.000Z",
    firstSignInAt: "2026-07-02T08:00:00.000Z",
    implementationId: null,
    implementationName: null,
    implementationSetup: null,
    provisionedBy: "admin-1",
  },
  {
    userId: "cust-1",
    email: "asena@in-gauge.io",
    emailMasked: "a••••@in-gauge.io",
    name: "Asena",
    accountType: "customer",
    role: "customer",
    status: "active",
    lastSignInAt: "2026-09-08T09:00:00.000Z",
    firstSignInAt: "2026-08-01T08:00:00.000Z",
    implementationId: "impl-1",
    implementationName: "Disney's Coronado Springs",
    implementationSetup: "draft",
    provisionedBy: "admin-1",
  },
  {
    userId: "cust-hotel",
    email: "priya@hotel.com",
    emailMasked: "p••••@hotel.com",
    name: "Priya Raman",
    accountType: "customer",
    role: "customer",
    status: "active",
    lastSignInAt: "2026-09-08T08:30:00.000Z",
    firstSignInAt: "2026-08-02T08:00:00.000Z",
    implementationId: "impl-1",
    implementationName: "Hotel Northgate",
    implementationSetup: "draft",
    provisionedBy: "admin-1",
  },
  {
    userId: "pending-1",
    email: "nshaw@frontlinepg.com",
    emailMasked: "n••••@frontlinepg.com",
    name: null,
    accountType: "unassigned",
    role: null,
    status: "pending",
    lastSignInAt: "2026-09-08T10:00:00.000Z",
    firstSignInAt: "2026-09-08T10:00:00.000Z",
    implementationId: null,
    implementationName: null,
    implementationSetup: null,
    provisionedBy: null,
  },
];

describe("Users & Access HTML fidelity", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, audit: [], user: users[1] }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the approved page chrome and role states", () => {
    render(<UsersAccessScreen initialUsers={users} initialImplementations={[]} />);

    expect(screen.getByRole("heading", { name: "Users & Access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Provision user" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Engineer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Not provided yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Manage" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Provision" })).toBeInTheDocument();
  });

  it("opens the manage drawer with Access now capabilities", async () => {
    render(<UsersAccessScreen initialUsers={users} initialImplementations={[]} />);
    screen.getAllByRole("button", { name: "Manage" })[1].click();
    expect(await screen.findByRole("complementary", { name: "Manage access" })).toBeInTheDocument();
    expect(screen.getByText("Access now")).toBeInTheDocument();
    expect(screen.getByText("Change role")).toBeInTheDocument();
    expect(screen.getByText("Access history")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable access" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
    const identityLabel = screen.getByText("Identity");
    const identityValue = screen.getByText("Provisioned");
    expect(identityLabel.tagName).toBe("SPAN");
    expect(identityValue.tagName).toBe("SPAN");
    expect(identityLabel.nextElementSibling).toBe(identityValue);
    expect(identityLabel.parentElement?.className).toBe("kv");
    expect(identityLabel.parentElement?.parentElement?.className).toBe("idmeta");
  });

  it("lets an Admin change a Customer to Internal / Engineer or Admin", async () => {
    const customer = users.find((row) => row.userId === "cust-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, audit: [], user: customer }),
      })),
    );
    render(
      <UsersAccessScreen
        initialUsers={users}
        initialImplementations={[{ id: "impl-1", name: "Disney's Coronado Springs" }]}
      />,
    );
    screen.getAllByRole("button", { name: "Manage" })[2].click();
    expect(await screen.findByRole("complementary", { name: "Manage access" })).toBeInTheDocument();
    expect(screen.getByText("Change account type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Internal \/ Engineer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Internal \/ Admin/ })).toBeInTheDocument();
    expect(screen.getAllByText("Disney's Coronado Springs").length).toBeGreaterThan(0);
  });

  it("does not offer Internal conversion for an external-domain Customer", async () => {
    const hotel = users.find((row) => row.userId === "cust-hotel");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, audit: [], user: hotel }),
      })),
    );
    render(
      <UsersAccessScreen
        initialUsers={users}
        initialImplementations={[{ id: "impl-1", name: "Hotel Northgate" }]}
      />,
    );
    screen.getAllByRole("button", { name: "Manage" })[3].click();
    expect(await screen.findByRole("complementary", { name: "Manage access" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Internal \/ Engineer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Internal \/ Admin/ })).not.toBeInTheDocument();
  });

  it("opens the provision drawer from a pending row", async () => {
    render(<UsersAccessScreen initialUsers={users} initialImplementations={[]} />);
    screen.getByRole("button", { name: "Provision" }).click();
    const drawer = await screen.findByRole("complementary", { name: "Provision user" });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText("Can complete their own BookMax Setup and nothing else.")).toBeInTheDocument();
    expect(screen.getByText("A member of the implementation team.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant access" })).toBeDisabled();
  });

  it("grants first-time Customer access without an implementation selector", async () => {
    render(
      <UsersAccessScreen
        initialUsers={users}
        initialImplementations={[{ id: "impl-1", name: "Disney's Coronado Springs" }]}
      />,
    );
    screen.getByRole("button", { name: "Provision" }).click();
    expect(await screen.findByRole("complementary", { name: "Provision user" })).toBeInTheDocument();

    screen
      .getByText("Can complete their own BookMax Setup and nothing else.")
      .closest("button")!
      .click();

    expect(await screen.findByText(/A new BookMax implementation is created for this person/)).toBeInTheDocument();
    expect(screen.queryByText("Which implementation?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Implementation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant access" })).toBeEnabled();
  });

  it("attaches a Customer to an unassigned property from the Manage drawer", async () => {
    const customer = { ...users[3], implementationSetup: "empty" as const, implementationName: null };
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>>(
      async () => ({
        ok: true,
        json: async () => ({ ok: true, audit: [], user: customer, users: [customer] }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <UsersAccessScreen
        initialUsers={[customer]}
        initialImplementations={[]}
        initialAttachable={{
          options: [
            { id: "11111111-1111-4111-8111-111111111111", propertyName: "Brooklands Hotel", createdAt: "2026-10-01T00:00:00.000Z" },
            { id: "22222222-2222-4222-8222-222222222222", propertyName: null, createdAt: "2026-10-02T00:00:00.000Z" },
          ],
          hiddenCount: 16,
        }}
      />,
    );
    screen.getByRole("button", { name: "Manage" }).click();
    expect(await screen.findByRole("complementary", { name: "Manage access" })).toBeInTheDocument();
    expect(screen.getByText(/isn’t linked to a property yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Attach to an existing property/ }));
    expect(screen.getByText("2 properties with no customer attached")).toBeInTheDocument();
    expect(screen.getByText(/16 properties that already belong to a customer are hidden/)).toBeInTheDocument();
    expect(screen.getByText(/Untitled property · created/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search property name" }), { target: { value: "zzz" } });
    expect(screen.getByText(/No unassigned property matches/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search property name" }), { target: { value: "brook" } });
    fireEvent.click(screen.getByRole("option", { name: /Brooklands Hotel/ }));

    expect(screen.getByText(/becomes the customer for/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Attach property" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === "/api/implementation/users" &&
            init?.method === "PATCH" &&
            JSON.parse(String(init.body)).action === "assign" &&
            JSON.parse(String(init.body)).implementationId === "11111111-1111-4111-8111-111111111111",
        ),
      ).toBe(true),
    );
  });

  it("opens the real property setup page when an Admin creates a new implementation", async () => {
    const customer = {
      ...users[3],
      userId: "33333333-3333-4333-8333-333333333333",
      implementationId: "44444444-4444-4444-8444-444444444444",
      implementationSetup: "empty" as const,
      implementationName: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, audit: [], user: customer }) })),
    );
    routerPush.mockReset();
    render(<UsersAccessScreen initialUsers={[customer]} initialImplementations={[]} />);
    screen.getByRole("button", { name: "Manage" }).click();
    expect(await screen.findByRole("complementary", { name: "Manage access" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create a new implementation/ }));
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        "/setup/property?customer=33333333-3333-4333-8333-333333333333&implementation=44444444-4444-4444-8444-444444444444",
      ),
    );
  });

  it("shows a linked Customer's implementation with Change implementation", async () => {
    const customer = users.find((row) => row.userId === "cust-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, audit: [], user: customer }) })),
    );
    render(<UsersAccessScreen initialUsers={users} initialImplementations={[]} />);
    screen.getAllByRole("button", { name: "Manage" })[2].click();
    expect(await screen.findByRole("complementary", { name: "Manage access" })).toBeInTheDocument();
    expect(screen.getByText("Draft · started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue in setup/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change implementation" }));
    expect(screen.getByRole("button", { name: /Attach to an existing property/ })).toBeInTheDocument();
    expect(screen.getByText(/Their current setup is kept/)).toBeInTheDocument();
  });

  it("does not offer Internal when the pending identity is an external domain", async () => {
    const hotelPending: AccessUserView = {
      ...users[users.length - 1],
      userId: "pending-hotel",
      email: "new@hotel.com",
      emailMasked: "n••••@hotel.com",
    };
    render(<UsersAccessScreen initialUsers={[hotelPending]} initialImplementations={[]} />);
    screen.getByRole("button", { name: "Provision" }).click();
    expect(await screen.findByRole("complementary", { name: "Provision user" })).toBeInTheDocument();
    expect(screen.getByText("Can complete their own BookMax Setup and nothing else.")).toBeInTheDocument();
    expect(screen.queryByText("A member of the implementation team.")).not.toBeInTheDocument();
  });

  it("shows the HTML empty provision state when nobody is pending", async () => {
    render(
      <UsersAccessScreen
        initialUsers={users.filter((row) => row.status !== "pending")}
        initialImplementations={[]}
      />,
    );
    screen.getByRole("button", { name: "Provision user" }).click();
    expect(await screen.findByRole("complementary", { name: "Provision user" })).toBeInTheDocument();
    expect(screen.getByText(/Nobody is waiting to be provisioned/)).toBeInTheDocument();
    expect(screen.getByText("Pending: 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grant access" })).not.toBeInTheDocument();
  });
});
