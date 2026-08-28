import { findPms } from "@/lib/implementation/catalogue";
import type {
  CredentialLabel,
  IntakeState,
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
  return state.pmsId === "operacloud";
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
  const pms = selectedPms(state);
  const otherOk = state.pmsId !== "other" || state.otherPmsName.trim().length > 0;

  return Boolean(
    pms &&
      state.hosting &&
      otherOk &&
      state.technicalContact.trim() &&
      state.technicalContactEmail.trim() &&
      filledProperties(state)[0],
  );
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

export function canReachStage(state: IntakeState, stage: "property" | "connect" | "summary") {
  if (stage === "property") {
    return true;
  }

  if (stage === "connect") {
    return propertyStepComplete(state);
  }

  return propertyStepComplete(state) && state.connectionDetailsStatus === "complete";
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
  if (isOhipRoute(state)) {
    return "OHIP";
  }

  if (state.connectionMethod === "api") {
    return "API / Integration";
  }

  if (state.connectionMethod === "sftp") {
    return "SFTP / File Transfer";
  }

  if (state.connectionMethod === "unsure") {
    return "To be confirmed";
  }

  return "";
}

export function suppliedConnectionDetails(state: IntakeState): Record<string, string> {
  const details: Record<string, string> = {};

  if (isOhipRoute(state)) {
    if (environmentLabel(state)) {
      details.Environment = environmentLabel(state);
    }
    if (state.enterpriseId.trim()) {
      details["Enterprise ID"] = state.enterpriseId.trim();
    }
    if (state.hotelId.trim()) {
      details["Hotel ID"] = state.hotelId.trim();
    }
    if (state.gatewayUrl.trim()) {
      details["Gateway URL"] = state.gatewayUrl.trim();
    }
    if (state.authMethod) {
      details["Authentication Method"] = state.authMethod;
    }
    if (state.oauthScope.trim()) {
      details["OAuth Scope"] = state.oauthScope.trim();
    }
    if (state.chainCode.trim()) {
      details["Chain Code"] = state.chainCode.trim();
    }
    if (state.ohipAdmin.trim()) {
      details["OHIP Administrator"] = state.ohipAdmin.trim();
    }
    if (state.ohipAdminEmail.trim()) {
      details["Administrator Email"] = state.ohipAdminEmail.trim();
    }
    return details;
  }

  if (isBrandRoute(state)) {
    if (state.propertyCode.trim()) {
      details["Brand property code"] = state.propertyCode.trim();
    }
    if (state.brandSponsor.trim()) {
      details["Brand sponsor"] = state.brandSponsor.trim();
    }
    return details;
  }

  if (isGenericCloudApi(state)) {
    if (state.propertyCode.trim()) {
      details["Property / hotel code"] = state.propertyCode.trim();
    }
    if (state.pmsAdmin.trim()) {
      details["PMS administrator"] = state.pmsAdmin.trim();
    }
    return details;
  }

  const method = connectionMethodLabel(state);
  if (method) {
    details["Connection Method"] = method;
  }
  if (state.apiUrl.trim()) {
    details["API URL"] = state.apiUrl.trim();
  }
  if (state.sftpHost.trim()) {
    details["SFTP Host"] = state.sftpHost.trim();
  }

  return details;
}

export function toDraftPayload(state: IntakeState): IntakeState {
  return {
    ...state,
  };
}

export function toSubmissionRecord(state: IntakeState, submittedAt: string): SubmissionRecord {
  const pms = selectedPms(state);

  return {
    submission_id: state.submissionId || `BMX-${Date.now()}`,
    organisation: state.organisation.trim(),
    properties: filledProperties(state),
    pms: pmsDisplayName(state),
    pms_version: state.pmsVersion.trim() || (pms?.host === "cloud" ? "Cloud" : ""),
    pms_type: hostingLabel(state),
    technical_contact: state.technicalContact.trim(),
    technical_contact_email: state.technicalContactEmail.trim(),
    technical_contact_mobile: state.technicalContactMobile.trim(),
    connection_method: connectionMethodLabel(state) || selectedPms(state)?.integration || "",
    connection_details: suppliedConnectionDetails(state),
    connection_details_status: state.connectionDetailsStatus,
    credentials_status: state.credentialsStatus,
    submitted_at: submittedAt,
    submitted_by: state.contactName.trim() || "Customer",
    status: "submitted",
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
