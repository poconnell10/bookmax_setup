import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertySetupScreen } from "@/components/setup/PropertySetupScreen";

describe("M1 property screen", () => {
  const push = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
      prefetch: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PROPERTY-001 — renders v3 property fields and does not ask to retype email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          email: "jane@hotel.com",
          implementation: { id: "impl-1", status: "started" },
          property: null,
          intake: { sameAsPrimaryContact: false },
        }),
      ),
    );
    render(<PropertySetupScreen />);
    await screen.findByRole("heading", { name: "Set up your property for BookMax" });
    expect(
      screen.getByText(/BookMax is your pre-arrival upsell solution/),
    ).toBeInTheDocument();
    expect(screen.getByText("Takes about 2 minutes")).toBeInTheDocument();
    expect(screen.getByText("Your property")).toBeInTheDocument();
    expect(screen.getByText("Your contact details")).toBeInTheDocument();
    expect(screen.getByText("Who should we contact about PMS access?")).toBeInTheDocument();
    expect(screen.getByLabelText(/property name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hotel brand/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+1 (555) 000-0000")).toBeInTheDocument();
    const email = document.getElementById("yemail") as HTMLInputElement;
    expect(email.value).toBe("jane@hotel.com");
    expect(email.readOnly).toBe(true);
    expect(screen.queryByLabelText(/city/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/country/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/job title/i)).not.toBeInTheDocument();
    expect(screen.getByText("That's me — I look after PMS access too")).toBeInTheDocument();
  });

  it("PROPERTY-002 — required fields block save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          email: "jane@hotel.com",
          implementation: { id: "impl-1", status: "started" },
          property: null,
          intake: { sameAsPrimaryContact: false },
        }),
      ),
    );
    render(<PropertySetupScreen />);
    await screen.findByRole("heading", { name: "Set up your property for BookMax" });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getAllByText("This field is required.").length).toBeGreaterThanOrEqual(2);
    expect(push).not.toHaveBeenCalled();
  });

  it("PROPERTY-003 — valid details persist and continue to PMS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/setup/property") && init?.method === "POST") {
          return Response.json({
            ok: true,
            property: { id: "prop-1", name: "The Langham London" },
          });
        }
        return Response.json({
          ok: true,
          email: "jane@hotel.com",
          implementation: { id: "impl-1", status: "started" },
          property: null,
          intake: { sameAsPrimaryContact: false },
        });
      }),
    );
    render(<PropertySetupScreen />);
    await screen.findByRole("heading", { name: "Set up your property for BookMax" });
    fireEvent.change(screen.getByLabelText(/property name/i), { target: { value: "The Langham London" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "John Smith" } });
    fireEvent.click(screen.getByRole("button", { name: /That's me/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/setup/pms");
    });
  });

  it("PROPERTY-005 — returning customer sees existing property details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          email: "jane@hotel.com",
          implementation: { id: "impl-1", status: "property_complete" },
          property: {
            id: "prop-1",
            implementationId: "impl-1",
            name: "The Langham London",
            hotelBrand: "Langham",
            contactName: "John Smith",
          },
          intake: {
            sameAsPrimaryContact: true,
            technicalContactName: "John Smith",
          },
        }),
      ),
    );
    render(<PropertySetupScreen />);
    await screen.findByDisplayValue("The Langham London");
    expect(screen.getByDisplayValue("Langham")).toBeInTheDocument();
    expect(screen.getByDisplayValue("John Smith")).toBeInTheDocument();
    expect((document.getElementById("yemail") as HTMLInputElement).value).toBe("jane@hotel.com");
  });
});
