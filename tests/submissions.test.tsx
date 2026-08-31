import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmissionsList } from "@/components/submissions/SubmissionsList";
import { SubmissionReview } from "@/components/submissions/SubmissionReview";
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
  });

  it("seeds a prototype log entry without secrets", () => {
    const listed = listPrototypeSubmissions();
    expect(listed.length).toBeGreaterThan(0);
    expect(JSON.stringify(listed)).not.toMatch(/client_secret|application_key|password/i);
  });
});
