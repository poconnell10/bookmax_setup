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

    expect(screen.getByRole("heading", { name: "Your property" })).toBeInTheDocument();
    expect(screen.getByText("Hotel ABC Barcelona")).toBeInTheDocument();
    expect(screen.queryByText("Property setup will be designed next.")).not.toBeInTheDocument();
  });

  it("keeps internal submissions inside the application shell", () => {
    render(
      <IntakeProvider>
        <AppShell>
          <p>Shell content</p>
        </AppShell>
      </IntakeProvider>,
    );

    expect(screen.getByRole("navigation", { name: "BookMax" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Setup" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submissions" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Shell content");
    expect(screen.queryByText(/traqra/i)).not.toBeInTheDocument();
  });
});
