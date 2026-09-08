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
    userId: "pending-1",
    email: "new@hotel.com",
    emailMasked: "ne•••@hotel.com",
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
});
