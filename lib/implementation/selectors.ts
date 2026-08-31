import { COUNTRY_OPTIONS, findPms } from "@/lib/implementation/catalogue";
import type {
  ConnectionMethod,
  CredentialLabel,
  HostingKind,
  IntakeState,
  PmsAccessMethod,
  StageId,
  SubmissionRecord,
} from "@/types/implementation";

export const KNOWN_CUSTOMER = {
  organisation: "Hotel ABC Group",
  contactName: "Elena Márquez",
  contactEmail: "elena.marquez@hotelabc.com",
  country: "es",
  properties: ["Hotel ABC Barcelona"],
};

export function createInitialIntakeState(): IntakeState {
  return {
    organisation: KNOWN_CUSTOMER.organisation,
    contactName: KNOWN_CUSTOMER.contactName,
    contactEmail: KNOWN_CUSTOMER.contactEmail,
    country: KNOWN_CUSTOMER.country,
    properties: [...KNOWN_CUSTOMER.properties],
    technicalContact: "",
    technicalContactEmail: "",
    pmsId: null,
    otherPmsName: "",
    hosting: "",
    pmsVersion: "",
    technicalContactMobile: "",
    connectionMethod: null,
    pmsAccessMethod: "",
    samePmsContact: false,
    propertyLocked: true,
    accessVerified: false,
    apiUrl: "",
    apiCredentialsAvailable: "",
    transferDetailsAvailable: "",
    sftpHost: "",
    environment: "",
    enterpriseId: "",
    hotelId: "",
    gatewayUrl: "",
    authMethod: "",
    oauthScope: "",
    chainCode: "",
    ohipAdmin: "",
    ohipAdminEmail: "",
    propertyCode: "",
    pmsAdmin: "",
    brandSponsor: "",
    connectionDetailsStatus: "not_started",
    credentialsStatus: "not_received",
    submitted: false,
    submittedAt: null,
    submittedBy: null,
    submissionId: null,
    draftId: null,
    status: "draft",
  };
}

export function filledProperties(state: IntakeState): string[] {
  return state.properties.map((item) => item.trim()).filter(Boolean);
}

export function selectedPms(state: IntakeState) {
  return findPms(state.pmsId);
}

export function hostingNeedsConfirmation(state: IntakeState): boolean {
  const pms = selectedPms(state);
  return !pms || !pms.host || pms.host === "hybrid" || pms.id === "other";
}

export function isOhipRoute(state: IntakeState): boolean {
  return state.pmsId === "operacloud" || state.pmsId === "oraclehosp";
}

export function isOperaOnPrem(state: IntakeState): boolean {
  return state.pmsId === "operaonprem";
}

export function isOperaCloudFamily(state: IntakeState): boolean {
  return isOhipRoute(state);
}

export function isBrandRoute(state: IntakeState): boolean {
  return selectedPms(state)?.kind === "brand";
}

export function isOnPremOrHybrid(state: IntakeState): boolean {
  return state.hosting === "onprem" || state.hosting === "hybrid" || state.hosting === "unsure";
}

export function isGenericCloudApi(state: IntakeState): boolean {
  const pms = selectedPms(state);
  return (
    !!pms &&
    pms.kind === "api" &&
    !isOhipRoute(state) &&
    state.hosting === "cloud"
  );
}

export function credentialMode(
  state: IntakeState,
): "ohip" | "api" | "sftp" | "access" | "none" {
  if (isBrandRoute(state)) {
    return "none";
  }

  if (isOhipRoute(state) || isGenericCloudApi(state)) {
    return "api";
  }

  if (state.connectionMethod === "api") {
    return "api";
  }

  if (state.connectionMethod === "sftp") {
    return "sftp";
  }

  if (state.connectionMethod === "unsure" || state.hosting === "unsure") {
    return "access";
  }

  if (isOnPremOrHybrid(state)) {
    return "access";
  }

  return "none";
}

export function credentialLabel(state: IntakeState): CredentialLabel | null {
  const mode = credentialMode(state);

  if (mode === "none") {
    return null;
  }

  if (mode === "sftp") {
    return "SFTP Credentials";
  }

  if (mode === "access") {
    return "Access Credentials";
  }

  return "API Credentials";
}

export function propertyStepComplete(state: IntakeState): boolean {
  return Boolean(filledProperties(state)[0] && state.country);
}

export function contactsStepComplete(state: IntakeState): boolean {
  return Boolean(
    state.contactName.trim() &&
      looksLikeEmail(state.contactEmail) &&
      state.technicalContact.trim() &&
      looksLikeEmail(state.technicalContactEmail),
  );
}

export function pmsStepComplete(state: IntakeState): boolean {
  const pms = selectedPms(state);
  if (!pms) {
    return false;
  }

  if (pms.id === "other" && !state.otherPmsName.trim()) {
    return false;
  }

  if (isOperaCloudFamily(state)) {
    return Boolean((state.hotelId || state.propertyCode).trim());
  }

  if (isOperaOnPrem(state)) {
    return Boolean((state.propertyCode || state.hotelId).trim() && state.pmsAccessMethod);
  }

  return Boolean(state.pmsAccessMethod);
}

export function ohipConnectionComplete(state: IntakeState): boolean {
  const scopeRequired = state.authMethod && state.authMethod !== "Not sure";

  return Boolean(
    state.environment &&
      state.enterpriseId.trim() &&
      state.hotelId.trim() &&
      state.gatewayUrl.trim() &&
      state.authMethod &&
      (!scopeRequired || state.oauthScope.trim()) &&
      state.ohipAdmin.trim() &&
      state.ohipAdminEmail.trim(),
  );
}

export function onPremConnectionComplete(state: IntakeState): boolean {
  return state.pmsVersion.trim().length > 0;
}

export function brandConnectionComplete(state: IntakeState): boolean {
  return Boolean(state.propertyCode.trim() && state.brandSponsor.trim());
}

export function genericApiConnectionComplete(state: IntakeState): boolean {
  return Boolean(state.propertyCode.trim() && state.pmsAdmin.trim());
}

export function connectStepComplete(state: IntakeState): boolean {
  if (isOhipRoute(state)) {
    return ohipConnectionComplete(state);
  }

  if (isBrandRoute(state)) {
    return brandConnectionComplete(state);
  }

  if (isGenericCloudApi(state)) {
    return genericApiConnectionComplete(state);
  }

  return onPremConnectionComplete(state);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function submitBlockers(state: IntakeState): string[] {
  const blockers: string[] = [];

  if (!canReachStage(state, "review")) {
    blockers.push("Required fields are missing.");
  }

  if (state.contactEmail.trim() && !looksLikeEmail(state.contactEmail)) {
    blockers.push("Primary contact email must look like an email.");
  }

  if (state.technicalContactEmail.trim() && !looksLikeEmail(state.technicalContactEmail)) {
    blockers.push("PMS access contact email must look like an email.");
  }

  return blockers;
}

export function canReachStage(state: IntakeState, stage: StageId) {
  if (stage === "property") {
    return true;
  }

  if (stage === "contacts") {
    return propertyStepComplete(state);
  }

  if (stage === "pms") {
    return propertyStepComplete(state) && contactsStepComplete(state);
  }

  return propertyStepComplete(state) && contactsStepComplete(state) && pmsStepComplete(state);
}

export function pmsDisplayName(state: IntakeState): string {
  const pms = selectedPms(state);

  if (!pms) {
    return "";
  }

  if (pms.id === "other" && state.otherPmsName.trim()) {
    return `${pms.name} · ${state.otherPmsName.trim()}`;
  }

  return pms.name;
}

export function hostingLabel(state: IntakeState): string {
  if (state.hosting === "cloud") {
    return "Cloud";
  }

  if (state.hosting === "onprem") {
    return "On-premise";
  }

  if (state.hosting === "hybrid") {
    return "Hybrid";
  }

  if (state.hosting === "unsure") {
    return "Unsure";
  }

  return "";
}

export function environmentLabel(state: IntakeState): string {
  if (state.environment === "uat") {
    return "Test / UAT";
  }

  if (state.environment === "prod") {
    return "Live / Production";
  }

  return "";
}

export function connectionMethodLabel(state: IntakeState): string {
  if (isOperaCloudFamily(state)) {
    return "OPERA Cloud";
  }

  return pmsAccessMethodLabel(state.pmsAccessMethod) || "";
}

export function pmsAccessMethodLabel(method: PmsAccessMethod | ConnectionMethod | null): string {
  if (method === "interface") {
    return "Existing interface / integration";
  }
  if (method === "sftp") {
    return "SFTP or file transfer";
  }
  if (method === "api") {
    return "API";
  }
  if (method === "onprem") {
    return "On-premise system";
  }
  if (method === "unsure") {
    return "To be confirmed";
  }
  return "";
}

export type ReviewSnapshot = {
  property: string;
  country: string;
  organisation: string;
  primaryName: string;
  primaryEmail: string;
  pmsContactName: string;
  pmsContactEmail: string;
  pms: string;
  hosting: string;
  hotelId: string;
  enterpriseId: string;
  accessMethod: string;
  details: Record<string, string>;
};

export function reviewSnapshot(state: IntakeState): ReviewSnapshot {
  const country =
    COUNTRY_OPTIONS.find((item) => item.value === state.country)?.label || state.country;
  const primaryName = state.contactName.trim();
  const primaryEmail = state.contactEmail.trim();
  const pmsContactName = (state.samePmsContact ? state.contactName : state.technicalContact).trim();
  const pmsContactEmail = (
    state.samePmsContact ? state.contactEmail : state.technicalContactEmail
  ).trim();
  const hotelId = (state.hotelId || state.propertyCode).trim();
  const enterpriseId = isOperaCloudFamily(state) ? state.enterpriseId.trim() : "";
  const accessMethod = pmsAccessMethodLabel(state.pmsAccessMethod);
  const hostingLabelValue = hostingLabel(state);
  const hosting =
    hostingLabelValue && !isOperaCloudFamily(state) && !isOperaOnPrem(state)
      ? hostingLabelValue
      : "";

  const details: Record<string, string> = {};
  if (hotelId) {
    details["Property / Hotel ID"] = hotelId;
  }
  if (enterpriseId) {
    details["OHIP Enterprise ID"] = enterpriseId;
  }
  if (accessMethod) {
    details["Access method"] = accessMethod;
  }

  return {
    property: filledProperties(state)[0] || "",
    country,
    organisation: state.organisation.trim(),
    primaryName,
    primaryEmail,
    pmsContactName,
    pmsContactEmail,
    pms: pmsDisplayName(state),
    hosting,
    hotelId,
    enterpriseId,
    accessMethod,
    details,
  };
}

export function suppliedConnectionDetails(state: IntakeState): Record<string, string> {
  return reviewSnapshot(state).details;
}

export function hostingFromPms(pmsId: string | null): HostingKind | "" {
  const pms = findPms(pmsId);
  if (!pms || pms.host === "hybrid") {
    return pms?.host === "hybrid" ? "hybrid" : "";
  }
  return pms.host;
}

export function fieldsClearedOnPmsChange(): Partial<IntakeState> {
  return {
    otherPmsName: "",
    enterpriseId: "",
    hotelId: "",
    propertyCode: "",
    pmsAccessMethod: "",
    connectionMethod: null,
    gatewayUrl: "",
    authMethod: "",
    oauthScope: "",
    chainCode: "",
    environment: "",
    pmsVersion: "",
    brandSponsor: "",
    pmsAdmin: "",
  };
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1) {
    return trimmed || "your work email";
  }
  return `${trimmed[0]}••••@${trimmed.slice(at + 1)}`;
}

export function toDraftPayload(state: IntakeState): IntakeState {
  return {
    ...state,
  };
}

export function toSubmissionRecord(state: IntakeState, submittedAt: string): SubmissionRecord {
  const snap = reviewSnapshot(state);

  return {
    submission_id: state.submissionId || `BMX-${Date.now()}`,
    organisation: snap.organisation,
    properties: filledProperties(state),
    country: snap.country,
    primary_contact: snap.primaryName,
    primary_contact_email: snap.primaryEmail,
    pms: snap.pms,
    pms_version: "",
    pms_type: snap.hosting,
    technical_contact: snap.pmsContactName,
    technical_contact_email: snap.pmsContactEmail,
    technical_contact_mobile: state.technicalContactMobile.trim(),
    connection_method: snap.accessMethod,
    connection_details: snap.details,
    connection_details_status: state.connectionDetailsStatus,
    credentials_status: state.credentialsStatus,
    submitted_at: submittedAt,
    submitted_by: snap.primaryName || "Customer",
    status: "Submitted",
    created_at: submittedAt,
    updated_at: submittedAt,
  };
}

export function stamp(): string {
  return new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
