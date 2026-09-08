import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { SubmissionsList } from "@/components/submissions/SubmissionsList";
import { SubmissionReview } from "@/components/submissions/SubmissionReview";
import { AppShell } from "@/components/layout/AppShell";
import { IntakeProvider } from "@/components/intake/IntakeProvider";
import type { SubmissionRecord } from "@/types/implementation";

const sample: SubmissionRecord = {
  submission_id: "BMX-2026-0007",
  organisation: "Hotel ABC Group",
  properties: ["Hotel ABC Barcelona", "Hotel ABC Madrid", "Hotel ABC Seville"],
  country: "Spain",
  primary_contact: "Elena Márquez",
  primary_contact_email: "elena.marquez@hotelabc.com",
  pms: "OPERA Cloud",
  pms_version: "",
  pms_type: "Cloud",
  technical_contact: "Jane Smith",
  technical_contact_email: "jane.smith@hotelabc.com",
  technical_contact_mobile: "",
  connection_method: "OHIP",
  connection_details: {
    "Enterprise ID": "ABCHT",
    "Hotel ID / property code": "BCNABC",
    "OHIP gateway URL": "https://ohip-eu.oracleindustry.com",
  },
  connection_details_status: "complete",
  credentials_status: "received",
  submitted_at: "27 Aug 2026 at 15:50",
  submitted_by: "Elena Márquez",
  status: "Submitted",
  created_at: "27 Aug 2026 at 15:50",
  updated_at: "27 Aug 2026 at 16:12",
};

describe("Submissions HTML fidelity", () => {
  it("matches the approved list chrome, filters and seven-column cards", () => {
    render(<SubmissionsList submissions={[sample]} />);

    expect(screen.getByRole("heading", { name: "Implementation submissions" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Every BookMax Setup that has been submitted. Open one to review exactly what was provided. Credential values are never stored here or shown.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search submissions" })).toHaveAttribute(
      "placeholder",
      "Search customer, property or contact…",
    );
    expect(screen.getByRole("button", { name: "PMS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelector(".subs")).not.toBeNull();
    expect(document.querySelector(".log-list")).toBeNull();

    for (const label of ["Customer", "PMS", "Connection", "Credentials", "Submitted", "Status"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Hotel ABC Group")).toBeInTheDocument();
    expect(screen.getByText(/Hotel ABC Barcelona · \+2 more/)).toBeInTheDocument();
    expect(screen.getByText("OHIP")).toBeInTheDocument();
    expect(screen.getByText("27 Aug 2026")).toBeInTheDocument();
    expect(screen.queryByText("27 Aug 2026 at 15:50")).not.toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PMS" }));
    expect(screen.getByRole("option", { name: "All PMS" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OPERA Cloud" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PMS" }));

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(screen.getByRole("option", { name: "All statuses" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Submitted" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Under Review" })).toBeInTheDocument();
  });

  it("does not invent an em dash when connection details exist without a method label", () => {
    render(
      <SubmissionsList
        submissions={[
          {
            ...sample,
            connection_method: "",
            connection_details: { "API URL": "https://api.mews.com" },
          },
        ]}
      />,
    );

    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.queryByText("Not yet provided")).not.toBeInTheDocument();
  });

  it("matches the approved review cards without revealing secrets", () => {
    render(
      <SubmissionReview
        submission={{
          ...sample,
          can_update_status: true,
          can_open_credentials: true,
          credentials_received_at: "27 Aug 2026 at 16:12",
          credential_type: "API Credentials",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Hotel ABC Group" })).toBeInTheDocument();
    expect(screen.getByText("Hotel ABC Barcelona · OPERA Cloud")).toBeInTheDocument();
    expect(screen.getAllByText("BMX-2026-0007").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("Property & PMS")).toBeInTheDocument();
    expect(screen.getByText("Connection")).toBeInTheDocument();
    expect(screen.getByText("Submission record")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("append only")).toBeInTheDocument();
    expect(screen.getByText("Enterprise ID")).toBeInTheDocument();
    expect(screen.getByText("ABCHT")).toBeInTheDocument();
    expect(screen.getByText("OHIP gateway URL")).toBeInTheDocument();
    expect(
      screen.getByText(/Credential values are not held here and cannot be revealed on this page/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/client_secret|application_key/i)).not.toBeInTheDocument();
    expect(document.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(screen.getByText("Received, not yet looked at.")).toBeInTheDocument();
    expect(screen.getByText("Being checked by implementation.")).toBeInTheDocument();
  });

  it("keeps Submissions on the shared internal shell", () => {
    vi.mocked(usePathname).mockReturnValue("/implementation/submissions");
    render(
      <IntakeProvider>
        <AppShell viewerKind="admin" identity={{ email: "admin@bookmax.ai", name: "Padraig O'Connell" }}>
          <SubmissionsList submissions={[sample]} />
        </AppShell>
      </IntakeProvider>,
    );

    expect(document.querySelector(".app-internal")).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "BookMax" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submissions" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Users & Access" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getByText("Padraig O'Connell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Setup" })).not.toBeInTheDocument();
  });
});
