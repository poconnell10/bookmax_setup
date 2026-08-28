import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createInitialIntakeState,
  credentialLabel,
  isOhipRoute,
  ohipConnectionComplete,
  onPremConnectionComplete,
  suppliedConnectionDetails,
  toSubmissionRecord,
} from "@/lib/implementation/selectors";
import { prototypePersistence } from "@/lib/implementation/persistence";

describe("intake selectors", () => {
  it("uses API Credentials for OHIP and SFTP Credentials for the SFTP route", () => {
    const ohip = { ...createInitialIntakeState(), pmsId: "operacloud", hosting: "cloud" as const };
    const sftp = {
      ...createInitialIntakeState(),
      pmsId: "operaonprem",
      hosting: "onprem" as const,
      connectionMethod: "sftp" as const,
    };

    expect(isOhipRoute(ohip)).toBe(true);
    expect(credentialLabel(ohip)).toBe("API Credentials");
    expect(credentialLabel(sftp)).toBe("SFTP Credentials");
  });

  it("does not show a credentials label for brand-controlled routes", () => {
    const state = { ...createInitialIntakeState(), pmsId: "fosse", hosting: "onprem" as const };
    expect(credentialLabel(state)).toBeNull();
  });

  it("does not infer an environment the customer never chose", () => {
    const state = {
      ...createInitialIntakeState(),
      pmsId: "operacloud",
      hosting: "cloud" as const,
      enterpriseId: "ABCHT",
    };

    expect(suppliedConnectionDetails(state).Environment).toBeUndefined();
    expect(ohipConnectionComplete(state)).toBe(false);
  });

  it("treats on-prem version as the only required connection field", () => {
    const incomplete = {
      ...createInitialIntakeState(),
      pmsId: "operaonprem",
      hosting: "onprem" as const,
    };
    const complete = { ...incomplete, pmsVersion: "5.6.2" };

    expect(onPremConnectionComplete(incomplete)).toBe(false);
    expect(onPremConnectionComplete(complete)).toBe(true);
  });

  it("builds a submission record without secret values", () => {
    const record = toSubmissionRecord(
      {
        ...createInitialIntakeState(),
        pmsId: "operacloud",
        hosting: "cloud",
        technicalContact: "Alex",
        technicalContactEmail: "alex@hotel.test",
        connectionDetailsStatus: "complete",
      },
      "27 Aug 2026",
    );

    expect(JSON.stringify(record)).not.toMatch(/client_secret|application_key|password/i);
    expect(record.credentials_status).toBe("not_received");
  });
});

describe("persistence boundary", () => {
  it("accepts credentials through the secure path without storing the secret values", async () => {
    const draft = await prototypePersistence.saveDraft(createInitialIntakeState());
    await prototypePersistence.submitCredentials(draft.draftId, {
      clientId: "id-value",
      clientSecret: "secret-value",
      applicationKey: "app-value",
    });

    const loaded = await prototypePersistence.loadDraft(draft.draftId);

    expect(loaded?.credentialsStatus).toBe("received");
    expect(JSON.stringify(loaded)).not.toContain("secret-value");
    expect(JSON.stringify(loaded)).not.toContain("app-value");
  });

  it("keeps drafts and submissions in prototype memory, not Supabase", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/implementation/persistence.ts"),
      "utf8",
    );

    expect(source).toContain("new Map");
    expect(source).not.toMatch(/supabase/i);
  });
});
