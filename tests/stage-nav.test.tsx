import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { CustomerShell } from "@/components/implementation/CustomerShell";
import { IMPLEMENTATION_STAGES } from "@/lib/stages";

describe("customer setup stages", () => {
  it("renders the four customer stages only", () => {
    vi.mocked(usePathname).mockReturnValue("/implementation/property");

    render(
      <CustomerShell>
        <p>Setup</p>
      </CustomerShell>,
    );

    expect(IMPLEMENTATION_STAGES).toHaveLength(4);
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("PMS")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.queryByText(/discovery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/validation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connect pms/i)).not.toBeInTheDocument();
  });

  it("marks the current stage as active", () => {
    vi.mocked(usePathname).mockReturnValue("/implementation/contacts");

    render(
      <CustomerShell>
        <p>Setup</p>
      </CustomerShell>,
    );

    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
  });
});
