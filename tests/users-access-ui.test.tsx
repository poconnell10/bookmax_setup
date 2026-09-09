import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersAccessScreen } from "@/components/access/UsersAccessScreen";
import type { AccessUserView } from "@/lib/implementation/access/types";

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
