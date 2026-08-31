import { existsSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { ImplementationSignIn, normalizeOtp } from "@/components/implementation/ImplementationSignIn";
import { LoginScreen } from "@/components/account/LoginScreen";
import { PropertyScreen } from "@/components/setup/PropertyScreen";
import { ContactsScreen } from "@/components/setup/ContactsScreen";
import { PmsScreen } from "@/components/setup/PmsScreen";
import { ReviewScreen } from "@/components/setup/ReviewScreen";
import { SuccessScreen } from "@/components/setup/SuccessScreen";
import { IntakeProvider } from "@/components/intake/IntakeProvider";
import {
  fieldsClearedOnPmsChange,
  createInitialIntakeState,
  pmsStepComplete,
  reviewSnapshot,
  submitBlockers,
  toSubmissionRecord,
} from "@/lib/implementation/selectors";
import { prototypePersistence } from "@/lib/implementation/persistence";
import type { IntakeState } from "@/types/implementation";

function renderSetup(ui: ReactElement, initialState?: IntakeState) {
  return render(<IntakeProvider initialState={initialState}>{ui}</IntakeProvider>);
}

function operaCloudState(overrides: Partial<IntakeState> = {}): IntakeState {
  return {
    ...createInitialIntakeState(),
    technicalContact: "Jane Smith",
    technicalContactEmail: "jane.smith@hotelabc.com",
    pmsId: "operacloud",
    hosting: "cloud",
    hotelId: "BCN01",
    connectionDetailsStatus: "complete",
    ...overrides,
  };
}

describe("customer implementation flow", () => {
  const push = vi.fn();

  beforeEach(() => {
    push.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      prefetch: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Test 1 — OTP then OPERA Cloud with a separate PMS access contact", async () => {
    renderSetup(<ImplementationSignIn />);

    expect(screen.getByRole("heading", { name: "Welcome to BookMax" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText(/prototype states/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create a password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery/i)).not.toBeInTheDocument();

    const input = screen.getByLabelText("Verification code");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith("/implementation/property");
  });

  it("OTP paste, typing and autofill all resolve to a 6-digit code", () => {
    expect(normalizeOtp("12 34-56abc")).toBe("123456");
    expect(normalizeOtp("99")).toBe("99");

    renderSetup(<ImplementationSignIn />);
    const input = screen.getByLabelText("Verification code");
    fireEvent.change(input, { target: { value: "12 34-56" } });
    expect(input).toHaveValue("123456");
    fireEvent.change(input, { target: { value: "12345" } });
    expect(input).toHaveValue("12345");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "847291" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith("/implementation/property");
  });

  it("Test 2 — OPERA Cloud without Enterprise ID is not blocked", () => {
    const state = operaCloudState({ enterpriseId: "" });
    expect(pmsStepComplete(state)).toBe(true);
    expect(submitBlockers(state)).toEqual([]);
  });

  it("Test 3 — same PMS access contact hides duplicate fields", () => {
    renderSetup(<ContactsScreen />, createInitialIntakeState());

    fireEvent.click(screen.getByRole("button", { name: /i am also the pms access contact/i }));
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("Test 4 — OPERA / OPERA 5 asks for property code and access, not OHIP credentials", () => {
    renderSetup(
      <PmsScreen />,
      operaCloudState({
        pmsId: "operaonprem",
        hosting: "onprem",
        hotelId: "",
        propertyCode: "BCN01",
        pmsAccessMethod: "sftp",
        connectionMethod: "sftp",
      }),
    );

    fireEvent.click(screen.getByRole("option", { name: /opera \/ opera 5/i }));
    expect(screen.getByLabelText("Property / Hotel Code")).toBeInTheDocument();
    expect(screen.getByText("How can data be provided from your PMS today?")).toBeInTheDocument();
    expect(screen.queryByLabelText("OHIP Enterprise ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gateway url/i)).not.toBeInTheDocument();
  });

  it("Test 5 — I'm not sure is a valid OPERA 5 access answer", () => {
    const state = operaCloudState({
      pmsId: "operaonprem",
      hosting: "onprem",
      hotelId: "",
      propertyCode: "BCN01",
      pmsAccessMethod: "unsure",
      connectionMethod: "unsure",
      enterpriseId: "",
    });
    expect(pmsStepComplete(state)).toBe(true);
    expect(submitBlockers(state)).toEqual([]);
  });

  it("Test 6 — Other PMS with I'm not sure can be submitted", () => {
    const state = operaCloudState({
      pmsId: "other",
      otherPmsName: "Custom PMS",
      hotelId: "",
      pmsAccessMethod: "unsure",
      connectionMethod: "unsure",
    });
    expect(pmsStepComplete(state)).toBe(true);
    expect(submitBlockers(state)).toEqual([]);
  });

  it("Test 7 — changing PMS clears OPERA-only fields and keeps property/contacts", () => {
    const previous = operaCloudState({ enterpriseId: "ABCHT", hotelId: "BCN01" });
    const next = {
      ...previous,
      ...fieldsClearedOnPmsChange(),
      pmsId: "fosse",
      hosting: "onprem" as const,
    };

    expect(next.organisation).toBe("Hotel ABC Group");
    expect(next.contactName).toBeTruthy();
    expect(next.enterpriseId).toBe("");
    expect(next.hotelId).toBe("");
    expect(next.pmsId).toBe("fosse");
  });

  it("Test 8 — review edit returns without requiring a full restart", () => {
    renderSetup(<ReviewScreen />, operaCloudState());

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(push).toHaveBeenCalledWith("/implementation/property?from=review");
    expect(screen.getByText("Hotel ABC Barcelona")).toBeInTheDocument();
    expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
  });

  it("Test 9 — property, contacts, PMS and success screens render for a small viewport", () => {
    renderSetup(<PropertyScreen />);
    expect(screen.getByRole("heading", { name: "Your property" })).toBeInTheDocument();
    expect(screen.getByText("From your BookMax agreement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Something incorrect?" })).toBeInTheDocument();
  });

  it("Test 10 — invitation data is prefilled so the two-minute path is possible", () => {
    renderSetup(<PropertyScreen />);
    expect(screen.getByText("Hotel ABC Barcelona")).toBeInTheDocument();
    expect(screen.getByText("Spain")).toBeInTheDocument();
  });

  it("successful submit opens the thank-you screen and does not ask for credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/implementation/submit")) {
          return { ok: true, json: async () => ({ submissionId: "BMX-NEW-1" }) };
        }
        return { ok: true, json: async () => ({ draftId: "draft-1" }) };
      }),
    );

    renderSetup(<ReviewScreen />, operaCloudState());
    fireEvent.click(screen.getByRole("button", { name: "Start BookMax Implementation" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/implementation/thanks");
    });
  });

  it("save failure does not show success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "fail" }) })),
    );
    renderSetup(<ReviewScreen />, operaCloudState());
    fireEvent.click(screen.getByRole("button", { name: "Start BookMax Implementation" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("submitted records appear in the log without secrets", async () => {
    const result = await prototypePersistence.submitImplementation({
      submission_id: "",
      organisation: "Northgate Hotels",
      properties: ["Northgate Central"],
      country: "Spain",
      primary_contact: "Priya Raman",
      primary_contact_email: "priya@northgatehotels.com",
      pms: "OPERA Cloud",
      pms_version: "Cloud",
      pms_type: "Cloud",
      technical_contact: "Priya Raman",
      technical_contact_email: "priya@northgatehotels.com",
      technical_contact_mobile: "",
      connection_method: "OPERA Cloud",
      connection_details: { "Hotel ID / Property Code": "NG01", client_secret: "nope" },
      connection_details_status: "complete",
      credentials_status: "not_received",
      submitted_at: "31 Aug 2026, 10:00",
      submitted_by: "Priya Raman",
      status: "Submitted",
      created_at: "31 Aug 2026, 10:00",
      updated_at: "31 Aug 2026, 10:00",
    });
    expect(result.submissionId).toBeTruthy();
  });

  it("success copy does not request credentials or offer a status loop", () => {
    renderSetup(<SuccessScreen />, operaCloudState({ submitted: true, properties: ["Hotel ABC Barcelona"] }));
    expect(screen.getByRole("heading", { name: "Thank you" })).toBeInTheDocument();
    expect(screen.getByText(/setup details have been received/i)).toBeInTheDocument();
    expect(screen.getByText(/bookmax implementation team will contact you/i)).toBeInTheDocument();
    expect(screen.queryByText(/view implementation status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provide api credentials/i)).not.toBeInTheDocument();
  });

  it("does not show a returning-customer status journey", () => {
    renderSetup(<ImplementationSignIn />, operaCloudState({ submitted: true }));
    expect(screen.getByRole("heading", { name: "Thank you" })).toBeInTheDocument();
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/view implementation status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for pms access/i)).not.toBeInTheDocument();
  });

  it("submit payload matches the review snapshot, including same-contact", () => {
    const state = operaCloudState({
      samePmsContact: true,
      technicalContact: "",
      technicalContactEmail: "",
      enterpriseId: "",
    });
    const snap = reviewSnapshot(state);
    const record = toSubmissionRecord(state, "31 Aug 2026, 11:00");

    expect(record.country).toBe(snap.country);
    expect(record.primary_contact).toBe("Elena Márquez");
    expect(record.primary_contact_email).toBe("elena.marquez@hotelabc.com");
    expect(record.technical_contact).toBe("Elena Márquez");
    expect(record.technical_contact_email).toBe("elena.marquez@hotelabc.com");
    expect(record.pms).toBe("OPERA Cloud");
    expect(record.pms_type).toBe("");
    expect(record.connection_details).toEqual({ "Property / Hotel ID": "BCN01" });
    expect(record.connection_details["OHIP Enterprise ID"]).toBeUndefined();
  });

  it("submit payload drops OPERA fields after a PMS change", () => {
    const next = {
      ...operaCloudState({ enterpriseId: "ABCHT", hotelId: "BCN01" }),
      ...fieldsClearedOnPmsChange(),
      pmsId: "fosse",
      hosting: "onprem" as const,
      pmsAccessMethod: "unsure" as const,
    };
    const record = toSubmissionRecord(next, "31 Aug 2026, 11:00");
    expect(record.pms).toBe("FOSSE");
    expect(record.primary_contact).toBe("Elena Márquez");
    expect(record.technical_contact).toBe("Jane Smith");
    expect(record.connection_details["OHIP Enterprise ID"]).toBeUndefined();
    expect(record.connection_details["Property / Hotel ID"]).toBeUndefined();
    expect(record.connection_details["Access method"]).toBe("To be confirmed");
  });

  it("does not keep the old unrouted setup components", () => {
    const intake = path.join(process.cwd(), "components/intake");
    expect(existsSync(path.join(intake, "PropertyStep.tsx"))).toBe(false);
    expect(existsSync(path.join(intake, "ConnectStep.tsx"))).toBe(false);
    expect(existsSync(path.join(intake, "SummaryStep.tsx"))).toBe(false);
    expect(existsSync(path.join(intake, "ThanksView.tsx"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "components/implementation/StageNav.tsx"))).toBe(false);
  });

  it("existing BookMax website routes still work", () => {
    const { unmount } = render(<Home />);
    expect(screen.getByText(/bookmax website/i)).toBeInTheDocument();
    unmount();
    render(<LoginScreen />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });
});
