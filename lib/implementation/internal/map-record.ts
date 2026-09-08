import {
  accessMethodLabel,
  pmsDisplayName,
  type SetupIntakePayload,
} from "@/lib/setup/intake";
import { findSetupPms, isSetupCloudPms, isSetupOhipPms } from "@/lib/setup/pms-catalogue";
import type { CredentialLabel, SubmissionRecord } from "@/types/implementation";
import type {
  CredentialReceipt,
  InternalAuditView,
  InternalQueueRow,
  InternalRole,
  InternalSubmissionView,
} from "@/lib/implementation/internal/types";

function formatDisplayTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso || "—";
  }
  return date
    .toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(",", " at");
}

export function credentialTypeForIntake(intake: SetupIntakePayload): CredentialLabel {
  if (intake.pmsAccessMethod === "sftp") {
    return "SFTP Credentials";
  }
  if (isSetupCloudPms(intake.pmsId)) {
    return "API Credentials";
  }
  return "Access Credentials";
}

function pmsTypeLabel(pms: ReturnType<typeof findSetupPms>) {
  if (pms?.host === "cloud") {
    return "Cloud";
  }
  if (pms?.host === "onprem") {
    return "On-prem";
  }
  if (pms?.host === "hybrid") {
    return "Hybrid";
  }
  return "";
}

function connectionMethodFor(intake: SetupIntakePayload) {
  if (isSetupOhipPms(intake.pmsId)) {
    return "OHIP";
  }
  return accessMethodLabel(intake.pmsAccessMethod);
}

function connectionDetails(intake: SetupIntakePayload): Record<string, string> {
  const details: Record<string, string> = {};
  if (intake.enterpriseId.trim()) {
    details["Enterprise ID"] = intake.enterpriseId.trim();
  }
  const hotel = intake.hotelId.trim() || intake.propertyCode.trim();
  if (hotel) {
    details["Hotel ID / property code"] = hotel;
  }
  if (intake.apiUrl.trim()) {
    details[isSetupOhipPms(intake.pmsId) ? "OHIP gateway URL" : "API URL"] = intake.apiUrl.trim();
  }
  if (intake.sftpHost.trim()) {
    details["SFTP host"] = intake.sftpHost.trim();
  }
  return details;
}

export function toInternalSubmissionView(
  row: InternalQueueRow,
  receipt: CredentialReceipt | null,
  role: InternalRole,
  events: InternalAuditView[] = [],
): InternalSubmissionView {
  const { record } = row;
  const pms = findSetupPms(record.intake.pmsId);
  const received = Boolean(receipt);
  const submittedAt = formatDisplayTime(row.submittedAt || record.submittedAt);
  const updatedAt = formatDisplayTime(row.workflowUpdatedAt || row.submittedAt);
  const mapped: SubmissionRecord = {
    submission_id: row.id,
    organisation: record.property.hotelBrand?.trim() || record.property.name || "—",
    properties: record.property.name ? [record.property.name] : [],
    country: record.property.country || "",
    primary_contact: record.property.contactName || "",
    primary_contact_email: record.contactEmail || "",
    pms: pmsDisplayName(record.intake) || pms?.label || "—",
    pms_version: "",
    pms_type: pmsTypeLabel(pms),
    technical_contact: record.intake.sameAsPrimaryContact
      ? record.property.contactName
      : record.intake.technicalContactName,
    technical_contact_email: record.intake.sameAsPrimaryContact
      ? record.contactEmail
      : record.intake.technicalContactEmail,
    technical_contact_mobile: record.intake.technicalContactMobile,
    connection_method: connectionMethodFor(record.intake),
    connection_details: connectionDetails(record.intake),
    connection_details_status: record.intake.pmsAccessMethod ? "complete" : "not_started",
    credentials_status: received ? "received" : "not_received",
    submitted_at: submittedAt,
    submitted_by: record.property.contactName || record.contactEmail || "—",
    status: row.workflowStatus,
    created_at: submittedAt,
    updated_at: updatedAt,
  };

  return {
    ...mapped,
    credentials_received_at: receipt ? formatDisplayTime(receipt.receivedAt) : null,
    credential_type: received ? credentialTypeForIntake(record.intake) : null,
    can_open_credentials: received && (role === "engineer" || role === "admin"),
    can_update_status: role === "engineer" || role === "admin",
    audit_events: events.map((event) => ({
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt,
      metadata: event.metadata,
    })),
  };
}
