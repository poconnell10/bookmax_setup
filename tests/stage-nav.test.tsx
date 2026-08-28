import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { StageNav } from "@/components/implementation/StageNav";
import { IntakeProvider } from "@/components/intake/IntakeProvider";
import { IMPLEMENTATION_STAGES } from "@/lib/stages";

describe("StageNav", () => {
  it("renders navigable links for the three customer stages only", () => {
    render(
      <IntakeProvider>
        <StageNav />
      </IntakeProvider>,
    );

    expect(
      screen.getByRole("navigation", { name: "Implementation stages" }),
    ).toBeInTheDocument();
    expect(IMPLEMENTATION_STAGES).toHaveLength(3);

    expect(screen.getByRole("link", { name: /property & pms/i })).toHaveAttribute(
      "href",
      "/implementation/property",
    );
    expect(screen.queryByText(/discovery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/validation/i)).not.toBeInTheDocument();
  });

  it("marks the current stage as the active page", () => {
    vi.mocked(usePathname).mockReturnValue("/implementation/property");

    render(
      <IntakeProvider>
        <StageNav />
      </IntakeProvider>,
    );

    expect(screen.getByRole("link", { name: /property & pms/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
