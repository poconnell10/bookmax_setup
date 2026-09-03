import {
  findSetupPms,
  isSetupBrandPms,
  isSetupCloudPms,
  isSetupOhipPms,
  isSetupOnPremPms,
  isSetupOtherPms,
  type SetupPmsId,
} from "@/lib/setup/pms-catalogue";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

export type SetupAccessMethod = "" | "interface" | "sftp" | "api" | "unsure";

export type SetupIntakePayload = {
  pmsId: SetupPmsId | null;
  otherPmsName: string;
  hotelId: string;
  propertyCode: string;
  enterpriseId: string;
  pmsAccessMethod: SetupAccessMethod;
  apiUrl: string;
  sftpHost: string;
  sameAsPrimaryContact: boolean;
  technicalContactName: string;
  technicalContactEmail: string;
  technicalContactMobile: string;
};

export type SetupSubmissionRecord = {
  implementationId: string;
  property: {
    name: string;
    city: string | null;
    country: string | null;
    hotelBrand: string | null;
    contactName: string;
    jobTitle: string | null;
  };
  contactEmail: string;
  intake: SetupIntakePayload;
  submittedAt: string;
};

export const SETUP_ACCESS_OPTIONS: Array<{
  value: Exclude<SetupAccessMethod, "">;
  label: string;
  hint: string;
}> = [
  {
    value: "interface",
    label: "Existing integration or interface",
    hint: "Something already connected to your PMS today.",
  },
  {
    value: "sftp",
    label: "SFTP or file transfer",
    hint: "Files sent to us on a schedule.",
  },
  {
    value: "api",
    label: "API",
    hint: "A direct connection your PMS or vendor provides.",
  },
  {
    value: "unsure",
    label: "I'm not sure",
    hint: "Most people pick this. We take it from here.",
  },
];

export function emptySetupIntake(): SetupIntakePayload {
  return {
    pmsId: null,
    otherPmsName: "",
    hotelId: "",
    propertyCode: "",
    enterpriseId: "",
    pmsAccessMethod: "",
    apiUrl: "",
    sftpHost: "",
    sameAsPrimaryContact: false,
    technicalContactName: "",
    technicalContactEmail: "",
    technicalContactMobile: "",
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeSetupIntake(input: unknown): SetupIntakePayload {
  const base = emptySetupIntake();
  if (!input || typeof input !== "object") {
    return base;
  }
  const value = input as Record<string, unknown>;
  const pms = findSetupPms(typeof value.pmsId === "string" ? value.pmsId : null);
  const rawMethod = value.pmsAccessMethod;
  const method =
    SETUP_ACCESS_OPTIONS.some((item) => item.value === rawMethod) && typeof rawMethod === "string"
      ? (rawMethod as Exclude<SetupAccessMethod, "">)
      : "";
  return {
    pmsId: pms?.id ?? null,
    otherPmsName: asString(value.otherPmsName),
    hotelId: asString(value.hotelId) || asString(value.propertyCode),
    propertyCode: asString(value.propertyCode) || asString(value.hotelId),
    enterpriseId: asString(value.enterpriseId),
    pmsAccessMethod: method,
    apiUrl: asString(value.apiUrl),
    sftpHost: asString(value.sftpHost),
    sameAsPrimaryContact: value.sameAsPrimaryContact === true || value.samePmsContact === true,
    technicalContactName: asString(value.technicalContactName) || asString(value.technicalContact),
    technicalContactEmail: asString(value.technicalContactEmail),
    technicalContactMobile: asString(value.technicalContactMobile),
  };
}

export function mergeSetupIntake(
  current: SetupIntakePayload,
  patch: Partial<SetupIntakePayload>,
): SetupIntakePayload {
  const next = { ...current, ...patch };
  if (patch.pmsId !== undefined && patch.pmsId !== current.pmsId) {
    next.hotelId = "";
    next.propertyCode = "";
    next.enterpriseId = "";
    next.pmsAccessMethod = "";
    next.apiUrl = "";
    next.sftpHost = "";
    if (patch.pmsId !== "other") {
      next.otherPmsName = "";
    }
  }
  return normalizeSetupIntake(next);
}

export function pmsSelectionComplete(intake: SetupIntakePayload): boolean {
  if (!intake.pmsId) {
    return false;
  }
  if (intake.pmsId === "other") {
    return Boolean(intake.otherPmsName.trim());
  }
  return true;
}

export function connectStepComplete(intake: SetupIntakePayload): boolean {
  return pmsSelectionComplete(intake);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function submitBlockers(
  intake: SetupIntakePayload,
  property: CustomerProperty | null,
  contactEmail: string,
): string[] {
  const blockers: string[] = [];
  if (!property) {
    blockers.push("Property details are missing.");
  }
  if (!pmsSelectionComplete(intake)) {
    blockers.push("Select your property management system.");
  }
  if (contactEmail.trim() && !looksLikeEmail(contactEmail)) {
    blockers.push("Contact email must look like an email.");
  }
  if (
    !intake.sameAsPrimaryContact &&
    intake.technicalContactEmail.trim() &&
    !looksLikeEmail(intake.technicalContactEmail)
  ) {
    blockers.push("PMS access contact email must look like an email.");
  }
  return blockers;
}

export function pmsDisplayName(intake: SetupIntakePayload): string {
  if (!intake.pmsId) {
    return "";
  }
  if (intake.pmsId === "other") {
    return intake.otherPmsName.trim() || "Other / not listed";
  }
  return findSetupPms(intake.pmsId)?.label || "";
}

export function accessMethodLabel(method: SetupAccessMethod): string {
  if (method === "unsure") {
    return "To be confirmed with your PMS contact";
  }
  return SETUP_ACCESS_OPTIONS.find((item) => item.value === method)?.label || "";
}

export function needsConnectionRoute(pmsId: string | null): boolean {
  return isSetupOnPremPms(pmsId) || isSetupOtherPms(pmsId);
}

export function needsCloudAccessFields(pmsId: string | null): boolean {
  return isSetupCloudPms(pmsId) || isSetupBrandPms(pmsId);
}

export function ownerName(intake: SetupIntakePayload, property: CustomerProperty | null): string {
  if (intake.sameAsPrimaryContact) {
    return property?.contactName || "";
  }
  return intake.technicalContactName.trim();
}

export function ownerEmail(intake: SetupIntakePayload, sessionEmail: string): string {
  if (intake.sameAsPrimaryContact) {
    return sessionEmail;
  }
  return intake.technicalContactEmail.trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

export function buildSubmissionRecord(input: {
  implementationId: string;
  property: CustomerProperty;
  contactEmail: string;
  intake: SetupIntakePayload;
}): SetupSubmissionRecord {
  return {
    implementationId: input.implementationId,
    property: {
      name: input.property.name,
      city: input.property.city,
      country: input.property.country,
      hotelBrand: input.property.hotelBrand,
      contactName: input.property.contactName,
      jobTitle: input.property.jobTitle,
    },
    contactEmail: input.contactEmail,
    intake: normalizeSetupIntake(input.intake),
    submittedAt: new Date().toISOString(),
  };
}

export { isSetupOhipPms };
