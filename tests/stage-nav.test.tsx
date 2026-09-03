import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { CustomerShell } from "@/components/implementation/CustomerShell";
import { IntakeProvider } from "@/components/intake/IntakeProvider";
import { IMPLEMENTATION_STAGES } from "@/lib/stages";

describe("customer setup stages", () => {
  it("renders the four customer stages only", () => {
    vi.mocked(usePathname).mockReturnValue("/implementation/property");

    render(
      <IntakeProvider>
        <CustomerShell>
          <p>Setup</p>
        </CustomerShell>
      </IntakeProvider>,
    );

    expect(IMPLEMENTATION_STAGES).toHaveLength(4);
    expect(IMPLEMENTATION_STAGES.map((stage) => stage.label)).toEqual([
      "Property",
      "Contacts",
      "PMS",
      "Review",
    ]);
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("PMS")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.queryByText("Access")).not.toBeInTheDocument();
    expect(screen.queryByText(/prototype states/i)).not.toBeInTheDocument();
  });

  it("marks the current stage as active", () => {
    vi.mocked(usePathname).mockReturnValue("/implementation/pms");

    render(
      <IntakeProvider>
        <CustomerShell>
          <p>Setup</p>
        </CustomerShell>
      </IntakeProvider>,
    );

    expect(screen.getByText("PMS")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
  });
});
