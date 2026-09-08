import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatSubmissionStamp,
  pmsSubline,
  visibleConnectionMethod,
} from "@/lib/implementation/internal/display";
import { toInternalSubmissionView } from "@/lib/implementation/internal/map-record";
import { emptySetupIntake } from "@/lib/setup/intake";
import type { InternalQueueRow } from "@/lib/implementation/internal/types";
import type { SubmissionRecord } from "@/types/implementation";

function queueRow(intake: Partial<ReturnType<typeof emptySetupIntake>>): InternalQueueRow {
  return {
    id: "BMX-QA-1",
    implementationId: "impl-1",
    submittedAt: "2026-08-27T14:50:00.000Z",
    workflowStatus: "Submitted",
    workflowUpdatedAt: "2026-08-27T15:12:00.000Z",
    workflowUpdatedBy: null,
    record: {
      implementationId: "impl-1",
      contactEmail: "jane.smith@hotelabc.com",
      submittedAt: "2026-08-27T14:50:00.000Z",
      property: {
        name: "Hotel ABC Barcelona",
        city: "Barcelona",
        country: "Spain",
        hotelBrand: "Hotel ABC Group",
        contactName: "Elena Márquez",
        jobTitle: null,
      },
      intake: {
        ...emptySetupIntake(),
        sameAsPrimaryContact: true,
        ...intake,
      },
    },
  };
}

describe("submission display mapping", () => {
  it("formats list dates without a time and review stamps with at", () => {
    expect(formatSubmissionStamp("27 Aug 2026 at 15:50", "date")).toBe("27 Aug 2026");
    expect(formatSubmissionStamp("27 Aug 2026 at 15:50", "full")).toBe("27 Aug 2026 at 15:50");
    expect(formatSubmissionStamp("27 Aug 2026, 3:14 pm", "full")).toMatch(/ at /);
  });

  it("maps OPERA Cloud to OHIP and keeps connection values visible", () => {
    const view = toInternalSubmissionView(
      queueRow({
        pmsId: "operacloud",
        pmsAccessMethod: "api",
        enterpriseId: "ABCHT",
        hotelId: "BCNABC",
        apiUrl: "https://ohip-eu.oracleindustry.com",
      }),
      { implementationId: "impl-1", receivedAt: "2026-08-27T15:12:00.000Z" },
      "engineer",
    );

    expect(view.organisation).toBe("Hotel ABC Group");
    expect(view.properties).toEqual(["Hotel ABC Barcelona"]);
    expect(view.pms).toBe("OPERA Cloud");
    expect(view.pms_type).toBe("Cloud");
    expect(view.pms_version).toBe("");
    expect(view.connection_method).toBe("OHIP");
    expect(view.connection_details["Enterprise ID"]).toBe("ABCHT");
    expect(view.connection_details["Hotel ID / property code"]).toBe("BCNABC");
    expect(view.connection_details["OHIP gateway URL"]).toBe("https://ohip-eu.oracleindustry.com");
    expect(visibleConnectionMethod(view)).toBe("OHIP");
    expect(visibleConnectionMethod(view)).not.toBe("—");
    expect(view.submitted_at).toContain(" at ");
    expect(view.can_update_status).toBe(true);
    expect(view.can_open_credentials).toBe(true);
  });

  it("maps Mews API without collapsing a real connection to a dash", () => {
    const view = toInternalSubmissionView(
      queueRow({
        pmsId: "mews",
        pmsAccessMethod: "api",
        apiUrl: "https://api.mews.com",
      }),
      null,
      "viewer",
    );

    expect(view.connection_method).toBe("API");
    expect(view.connection_details["API URL"]).toBe("https://api.mews.com");
    expect(visibleConnectionMethod(view)).toBe("API");
    expect(view.can_update_status).toBe(false);
    expect(view.can_open_credentials).toBe(false);
  });

  it("uses PMS type without duplicating a missing version", () => {
    const record = {
      pms_version: "",
      pms_type: "Cloud",
    } as SubmissionRecord;
    expect(pmsSubline(record)).toBe("Cloud");
  });
});

describe("submissions CSS fidelity", () => {
  it("keeps the approved 7-column grid and responsive collapse", () => {
    const css = readFileSync(path.join(process.cwd(), "app/intake.css"), "utf8");
    expect(css).toContain("minmax(170px, 1.2fr) minmax(140px, 1fr) minmax(120px, auto) minmax(110px, auto) minmax(105px, auto) minmax(105px, auto) 26px");
    expect(css).toContain("@media (max-width: 1080px)");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain(".app-internal .subs .row");
    expect(css).toContain(".app-internal .review .kgrid");
  });
});
