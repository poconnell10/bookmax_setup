import { describe, expect, it } from "vitest";
import {
  connectStepComplete,
  emptySetupIntake,
  pmsSelectionComplete,
  submitBlockers,
} from "@/lib/setup/intake";
import { findSetupPms, nextMsg, SETUP_PMS_OPTIONS } from "@/lib/setup/pms-catalogue";
import { getSetupResumePath } from "@/lib/setup/resume";
import { createCustomerService } from "@/lib/implementation/customer/service";
import { createMemoryCustomerStore } from "@/lib/implementation/customer/memory-store";

const property = {
  id: "prop-1",
  implementationId: "impl-1",
  name: "Hotel",
  city: null,
  country: null,
  hotelBrand: null,
  contactName: "Jane",
  jobTitle: null,
  createdAt: "",
  updatedAt: "",
};

describe("M2 setup intake", () => {
  it("PMS-001 — v3-2 catalogue lists Cloud, On-premise, and Other", () => {
    expect(SETUP_PMS_OPTIONS.map((item) => item.label)).toEqual([
      "OPERA Cloud",
      "Shiji (SEP / Daylight)",
      "Infor HMS",
      "Hilton PEP",
      "Agilysys Cloud / Stay",
      "Mews",
      "Cloudbeds",
      "Stayntouch",
      "Lightspeed (Cloud)",
      "WebRezPro",
      "RoomRaccoon",
      "Hotelogix",
      "Clock PMS+",
      "RMS Cloud",
      "Amadeus HMS",
      "Little Hotelier",
      "OPERA 5 / On-Premise",
      "FOSSE",
      "OnQ",
      "SMSHost",
      "FSPMS",
      "Galaxy / Lightspeed",
      "Agilysys (On-Premise)",
      "Maestro PMS",
      "RoomKeyPMS",
      "ResortData Processing (RDP)",
      "roommaster",
      "AutoClerk",
      "Other / not listed",
    ]);
    expect(SETUP_PMS_OPTIONS.filter((item) => item.host === "cloud")).toHaveLength(16);
    expect(SETUP_PMS_OPTIONS.filter((item) => item.host === "onprem")).toHaveLength(12);
  });

  it("PMS-001b — hosting echo uses approved v3-2 nextMsg copy", () => {
    expect(nextMsg(findSetupPms("operacloud"))).toBe(
      "OPERA Cloud is cloud-hosted. Up next, you’ll need your API credentials or integration key.",
    );
    expect(nextMsg(findSetupPms("opera5"))).toBe(
      "OPERA 5 runs locally on property. Up next, you’ll need to configure your local interface server.",
    );
    expect(nextMsg(findSetupPms("other"))).toBe("");
  });

  it("PMS-002 — Other PMS requires a custom name", () => {
    expect(pmsSelectionComplete(emptySetupIntake())).toBe(false);
    expect(pmsSelectionComplete({ ...emptySetupIntake(), pmsId: "mews" })).toBe(true);
    expect(pmsSelectionComplete({ ...emptySetupIntake(), pmsId: "other" })).toBe(false);
    expect(
      pmsSelectionComplete({ ...emptySetupIntake(), pmsId: "other", otherPmsName: "HotelKey" }),
    ).toBe(true);
  });

  it("PMS-003 — OPERA Cloud, OPERA 5, brand, and I'm not sure are all continuable without identifiers", () => {
    expect(connectStepComplete({ ...emptySetupIntake(), pmsId: "operacloud" })).toBe(true);
    expect(connectStepComplete({ ...emptySetupIntake(), pmsId: "opera5" })).toBe(true);
    expect(connectStepComplete({ ...emptySetupIntake(), pmsId: "onq" })).toBe(true);
    expect(
      connectStepComplete({ ...emptySetupIntake(), pmsId: "opera5", pmsAccessMethod: "unsure" }),
    ).toBe(true);
  });

  it("RESUME-001 — resume path advances through setup stages", () => {
    expect(
      getSetupResumePath({
        status: "property_complete",
        property,
        intake: emptySetupIntake(),
        submitted: false,
      }),
    ).toBe("/setup/pms");
    expect(
      getSetupResumePath({
        status: "property_complete",
        property,
        intake: { ...emptySetupIntake(), pmsId: "mews" },
        submitted: false,
      }),
    ).toBe("/setup/review");
    expect(
      getSetupResumePath({
        status: "submitted",
        property,
        intake: { ...emptySetupIntake(), pmsId: "mews" },
        submitted: true,
      }),
    ).toBe("/setup/thanks");
  });

  it("SUBMIT-001 — customer can save intake and submit once with immutable snapshot", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    await service.ensureForUser("user-1");
    await service.saveProperty(
      "user-1",
      { name: "The Langham London", contactName: "John Smith" },
      { sameAsPrimaryContact: true },
    );
    await service.savePmsSelection("user-1", { pmsId: "mews", otherPmsName: "" });
    await service.saveConnectDetails("user-1", { hotelId: "" });
    expect(submitBlockers({ ...emptySetupIntake(), pmsId: "mews" }, property, "jane@hotel.com")).toEqual(
      [],
    );
    const submitted = await service.submitSetup("user-1", "jane@hotel.com");
    expect(submitted.implementation.status).toBe("submitted");
    expect(submitted.submission?.record.contactEmail).toBe("jane@hotel.com");
    expect(submitted.submission?.record.intake.pmsId).toBe("mews");
    const snapshot = submitted.submission?.record;
    await expect(service.submitSetup("user-1", "jane@hotel.com")).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(submitted.submission?.record).toEqual(snapshot);
  });

  it("PEOPLE-001 — technical contact persists on intake, not property", async () => {
    const store = createMemoryCustomerStore();
    const service = createCustomerService(store);
    await service.ensureForUser("user-1");
    const saved = await service.saveProperty(
      "user-1",
      { name: "Hotel", hotelBrand: "Langham", contactName: "Jane" },
      {
        sameAsPrimaryContact: false,
        technicalContactName: "Maria Rossi",
        technicalContactEmail: "maria@hotel.com",
        technicalContactMobile: "+39 041 000 0000",
      },
    );
    expect(saved.property?.hotelBrand).toBe("Langham");
    expect(saved.property?.city).toBeNull();
    expect(saved.property?.country).toBeNull();
    expect(saved.intake?.payload.technicalContactName).toBe("Maria Rossi");
    expect(saved.intake?.payload.technicalContactEmail).toBe("maria@hotel.com");
    expect(saved.intake?.payload.sameAsPrimaryContact).toBe(false);
    const resumed = await service.ensureForUser("user-1");
    expect(resumed.intake?.payload.technicalContactName).toBe("Maria Rossi");
  });
});
