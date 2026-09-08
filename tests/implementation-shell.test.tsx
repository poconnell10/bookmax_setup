import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { PropertyScreen } from "@/components/setup/PropertyScreen";
import { IntakeProvider } from "@/components/intake/IntakeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";

function renderIntake(ui: ReactElement) {
  return render(<IntakeProvider>{ui}</IntakeProvider>);
}

describe("implementation shell", () => {
  it("renders the BookMax Implementation Setup header without Traqra navigation", () => {
    renderIntake(<AppHeader />);

    expect(screen.getByText("BookMax")).toBeInTheDocument();
    expect(screen.getByText("Implementation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & exit/i })).toBeInTheDocument();
    expect(screen.queryByText(/traqra/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
  });

  it("renders the property screen, not a placeholder", () => {
    renderIntake(<PropertyScreen />);

    expect(screen.getByRole("heading", { name: "Set up your property for BookMax" })).toBeInTheDocument();
    expect(screen.getByText("Hotel ABC Barcelona")).toBeInTheDocument();
    expect(screen.queryByText("Property setup will be designed next.")).not.toBeInTheDocument();
  });

  it("keeps internal submissions inside the application shell", () => {
    render(
      <IntakeProvider>
        <AppShell viewerKind="engineer">
          <p>Shell content</p>
        </AppShell>
      </IntakeProvider>,
    );

    expect(screen.getByRole("navigation", { name: "BookMax" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Setup" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submissions" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Shell content");
    expect(screen.queryByText(/traqra/i)).not.toBeInTheDocument();
  });

  it("does not send internal users to the customer property breadcrumb", () => {
    render(
      <IntakeProvider>
        <AppShell viewerKind="admin" identity={{ email: "admin@bookmax.ai", name: "Padraig O'Connell" }}>
          <p>Users</p>
        </AppShell>
      </IntakeProvider>,
    );

    expect(screen.getByText("Padraig O'Connell")).toBeInTheDocument();
    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "BookMax" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Setup" })).not.toBeInTheDocument();
  });
});
