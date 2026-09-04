import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmissionsList } from "@/components/submissions/SubmissionsList";
import { SubmissionReview } from "@/components/submissions/SubmissionReview";
import { SecureCredentialsPanel } from "@/components/submissions/SecureCredentialsPanel";
import { listPrototypeSubmissions } from "@/lib/implementation/persistence";
import type { SubmissionRecord } from "@/types/implementation";

const sample: SubmissionRecord = {
  submission_id: "BMX-TEST-1",
  organisation: "Hotel ABC Group",
  properties: ["Hotel ABC Barcelona"],
  country: "Spain",
  primary_contact: "Elena Márquez",
  primary_contact_email: "elena.marquez@hotelabc.com",
  pms: "OPERA Cloud",
  pms_version: "Cloud",
  pms_type: "Cloud",
  technical_contact: "Elena Márquez",
  technical_contact_email: "elena.marquez@hotelabc.com",
  technical_contact_mobile: "",
  connection_method: "OHIP",
  connection_details: { "Enterprise ID": "ABCHT" },
  connection_details_status: "complete",
  credentials_status: "received",
  submitted_at: "27 Aug 2026, 3:14 pm",
  submitted_by: "Elena Márquez",
  status: "Submitted",
  created_at: "27 Aug 2026, 3:14 pm",
  updated_at: "27 Aug 2026, 3:14 pm",
};

describe("submissions log", () => {
  it("lists the internal columns without secret values", () => {
    render(<SubmissionsList submissions={[sample]} />);

    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Hotel ABC Group")).toBeInTheDocument();
    expect(screen.getAllByText("OPERA Cloud").length).toBeGreaterThan(0);
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(JSON.stringify(sample)).not.toMatch(/client_secret|application_key|password/i);
  });

  it("opens a read-only review without credential secrets", () => {
    render(<SubmissionReview submission={sample} />);

    expect(screen.getAllByText("Hotel ABC Group").length).toBeGreaterThan(0);
    expect(screen.getByText("ABCHT")).toBeInTheDocument();
    expect(screen.queryByText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open secure credentials" })).not.toBeInTheDocument();
  });

  it("offers the secure credential path only when authorized", () => {
    render(
      <SubmissionReview
        submission={{
          ...sample,
          credentials_received_at: "27 Aug 2026, 3:14 pm",
          credential_type: "API Credentials",
          can_open_credentials: true,
          can_update_status: true,
        }}
      />,
    );

    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("Received at")).toBeInTheDocument();
    expect(screen.getByText("API Credentials")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open secure credentials" })).toHaveAttribute(
      "href",
      "/implementation/submissions/BMX-TEST-1/credentials",
    );
  });

  it("seeds a prototype log entry without secrets", () => {
    const listed = listPrototypeSubmissions();
    expect(listed.length).toBeGreaterThan(0);
    expect(JSON.stringify(listed)).not.toMatch(/client_secret|application_key|password/i);
  });
});

describe("secure credential reveal controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires an explicit action, does not persist secrets, and clears them on exit", async () => {
    const secret = "panel-secret-not-for-storage";
    const fetchMock = vi.fn(async () =>
      Response.json({
        credentialType: "API Credentials",
        receivedAt: "27 Aug 2026, 3:14 pm",
        clientId: "id-1",
        clientSecret: secret,
        applicationKey: "app-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      <SecureCredentialsPanel
        submissionId="BMX-TEST-1"
        organisation="Hotel ABC Group"
        credentialType="API Credentials"
        receivedAt="27 Aug 2026, 3:14 pm"
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open secure credentials" })).toBeInTheDocument();
    expect(screen.queryByText(secret)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open secure credentials" }));
    await waitFor(() => {
      expect(screen.getByText(secret)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/implementation/submissions/BMX-TEST-1/credentials",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    fireEvent.click(screen.getByRole("link", { name: "Back to submission" }));
    expect(screen.queryByText(secret)).not.toBeInTheDocument();
    unmount();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
