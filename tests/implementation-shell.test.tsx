import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { PropertyStep } from "@/components/intake/PropertyStep";
import { IntakeProvider } from "@/components/intake/IntakeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";

function renderIntake(ui: ReactElement) {
  return render(<IntakeProvider>{ui}</IntakeProvider>);
}

describe("implementation shell", () => {
  it("renders the BookMax Implementation Setup header without internal navigation", () => {
    renderIntake(<AppHeader />);

    expect(screen.getByText("BookMax")).toBeInTheDocument();
    expect(screen.getByText("Implementation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & exit/i })).toBeInTheDocument();
    expect(screen.queryByText(/traqra/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/golive gates/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/data airlock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reporting/i)).not.toBeInTheDocument();
  });

  it("renders the property intake, not a placeholder", () => {
    renderIntake(<PropertyStep />);

    expect(screen.getByText("About your property")).toBeInTheDocument();
    expect(screen.getByText("Hotel ABC Group")).toBeInTheDocument();
    expect(screen.queryByText("Property setup will be designed next.")).not.toBeInTheDocument();
  });

  it("renders stage navigation inside the application shell", () => {
    render(
      <AppShell>
        <p>Shell content</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Implementation stages" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Shell content");
  });
});
