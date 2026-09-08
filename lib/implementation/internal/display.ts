import { SUBMISSION_STATUSES, type SubmissionRecord, type SubmissionStatus } from "@/types/implementation";

export const STATUS_TONE: Record<SubmissionStatus, string> = {
  Submitted: "info",
  "Under Review": "rev",
  "Information Required": "pend",
  Ready: "ok",
};

export const STATUS_DESC: Record<SubmissionStatus, string> = {
  Submitted: "Received, not yet looked at.",
  "Under Review": "Being checked by implementation.",
  "Information Required": "Waiting on something from the customer.",
  Ready: "Everything needed is in place.",
};

export function statusTone(status: string) {
  if (status in STATUS_TONE) {
    return STATUS_TONE[status as SubmissionStatus];
  }
  return "mut";
}

export function credentialBadge(status: SubmissionRecord["credentials_status"]) {
  return status === "received" ? { label: "Received", tone: "ok" } : { label: "Pending", tone: "pend" };
}

export function formatSubmissionStamp(value: string | null | undefined, mode: "date" | "full" = "full") {
  if (!value || value === "—") {
    return "";
  }
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) {
    const date = new Date(iso);
    if (mode === "date") {
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  const datePart = value.split(" at ")[0].split(",")[0].trim();
  if (mode === "date") {
    return datePart;
  }
  if (value.includes(" at ")) {
    return value;
  }
  return value.replace(", ", " at ");
}

export function formatAuditStamp(value: string) {
  const iso = Date.parse(value);
  if (Number.isNaN(iso)) {
    return value;
  }
  return new Date(iso)
    .toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(",", "");
}

export function pmsSubline(record: SubmissionRecord) {
  return [record.pms_version, record.pms_type].filter((item) => item && item !== "—").join(" · ");
}

export function visibleConnectionMethod(record: SubmissionRecord) {
  const method = record.connection_method?.trim();
  if (method && method !== "—") {
    return method;
  }
  if (record.connection_details["SFTP host"]) {
    return "SFTP or file transfer";
  }
  if (record.connection_details["API URL"] || record.connection_details["OHIP gateway URL"]) {
    return "API";
  }
  if (Object.values(record.connection_details).some((item) => item?.trim())) {
    return "Connected";
  }
  return "";
}

export function propertySubline(record: SubmissionRecord) {
  const first = record.properties[0] || "";
  const extra = record.properties.length > 1 ? ` · +${record.properties.length - 1} more` : "";
  return `${first}${extra}`;
}

export const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...SUBMISSION_STATUSES.map((status) => ({ value: status, label: status })),
];

export const STATUS_CHANGE_OPTIONS = SUBMISSION_STATUSES.map((status) => ({
  value: status,
  label: status,
  desc: STATUS_DESC[status],
}));
