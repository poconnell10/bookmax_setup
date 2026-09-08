"use client";

import { useState } from "react";
import Link from "next/link";
import { TraqraSelect } from "@/components/setup/TraqraSelect";
import {
  credentialBadge,
  formatAuditStamp,
  formatSubmissionStamp,
  STATUS_CHANGE_OPTIONS,
  statusTone,
  visibleConnectionMethod,
} from "@/lib/implementation/internal/display";
import type { SubmissionRecord, SubmissionStatus } from "@/types/implementation";

export function SubmissionReview({ submission }: { submission: SubmissionRecord }) {
  const [record, setRecord] = useState(submission);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const canUpdateStatus = Boolean(record.can_update_status);
  const credentials = credentialBadge(record.credentials_status);
  const connection = visibleConnectionMethod(record);

  async function onStatusChange(status: SubmissionStatus) {
    if (status === record.status || !canUpdateStatus) {
      return;
    }

    const response = await fetch(`/api/implementation/submissions/${record.submission_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setError("Status could not be updated. Try again.");
      return;
    }

    const payload = (await response.json()) as { submission: SubmissionRecord };
    setRecord(payload.submission);
    setError(null);
    setToast(`Status set to ${status}`);
    window.setTimeout(() => setToast(""), 2500);
  }

  const connectionRows = [
    connection ? { label: "Connection method", value: connection, mono: false } : null,
    ...Object.entries(record.connection_details)
      .filter(([, value]) => value?.trim())
      .map(([label, value]) => ({
        label,
        value,
        mono: /ID|URL|code|scope|host|Host/i.test(label),
      })),
  ].filter((row): row is { label: string; value: string; mono: boolean } => Boolean(row));

  return (
    <div className="review">
      <div className="rhead">
        <div style={{ minWidth: 0 }}>
          <h2>{record.organisation}</h2>
          <div className="rsub">
            {(record.properties[0] || "—") + " · " + (record.pms && record.pms !== "—" ? record.pms : "—")}
          </div>
          <span className="id">{record.submission_id}</span>
        </div>
        <div className="ract">
          <label>Status</label>
          {canUpdateStatus ? (
            <TraqraSelect
              id="stat"
              value={record.status}
              searchable={false}
              ariaLabel="Status"
              placeholder="Status"
              options={STATUS_CHANGE_OPTIONS}
              onChange={(value) => void onStatusChange(value as SubmissionStatus)}
            />
          ) : (
            <span className={`bd ${statusTone(record.status)}`} id="submission-status">
              {record.status}
            </span>
          )}
        </div>
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card">
        <div className="chd">
          <span className="t">Property &amp; PMS</span>
          <span className="ro">read only</span>
        </div>
        <div className="cb">
          <div className="kgrid">
            <Field label="Customer" value={record.organisation} />
            <Field label="Property" value={record.properties[0] || ""} />
            <Field label="Number of properties" value={String(record.properties.length)} />
            <Field label="PMS" value={record.pms} />
            <Field label="PMS version" value={record.pms_version} />
            <Field label="PMS type" value={record.pms_type} />
            <Field label="Technical contact" value={record.technical_contact} />
            <Field label="Email" value={record.technical_contact_email} />
            <Field label="WhatsApp / mobile" value={record.technical_contact_mobile} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <span className="t">Connection</span>
          <span className="ro">read only</span>
        </div>
        <div className="cb">
          <div className="kgrid">
            {connectionRows.length ? (
              connectionRows.map((row) => <Field key={row.label} label={row.label} value={row.value} mono={row.mono} />)
            ) : (
              <Field label="Connection method" value="" empty="Not yet provided" />
            )}
            <span className="kv">
              <span className="kk">Credentials</span>
              <span className="kd">
                <span className={`bd ${credentials.tone}`}>{credentials.label}</span>
              </span>
            </span>
          </div>
          <div className="secnote">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>
              <b>Credential values are not held here and cannot be revealed on this page.</b> Client secrets, passwords,
              API keys and private keys go straight to the secure store on submission. This log records only whether they
              have been received
              {record.credentials_received_at
                ? `, and when — ${formatSubmissionStamp(record.credentials_received_at) || record.credentials_received_at}`
                : ""}
              .
            </span>
            {record.can_open_credentials ? (
              <Link href={`/implementation/submissions/${record.submission_id}/credentials`} className="btn sm">
                Reveal credentials
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <span className="t">Submission record</span>
          <span className="ro">read only</span>
        </div>
        <div className="cb">
          <div className="kgrid">
            <Field label="Submission ID" value={record.submission_id} mono />
            <Field label="Submitted at" value={formatSubmissionStamp(record.submitted_at) || record.submitted_at} />
            <Field label="Submitted by" value={record.submitted_by} />
            <Field
              label="Connection details"
              value={
                record.connection_details_status === "complete"
                  ? "Complete"
                  : record.connection_details_status === "in_progress"
                    ? "In progress"
                    : "Not started"
              }
            />
            <Field label="Credential status" value={credentials.label} />
            <Field label="Credentials received at" value={formatSubmissionStamp(record.credentials_received_at)} />
            <Field label="Created" value={formatSubmissionStamp(record.created_at) || record.created_at} />
            <Field label="Last updated" value={formatSubmissionStamp(record.updated_at) || record.updated_at} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <span className="t">Activity</span>
          <span className="ro">append only</span>
        </div>
        <div className="cb">
          {record.audit_events && record.audit_events.length > 0 ? (
            <div className="aud">
              {[...record.audit_events].reverse().map((event, index) => (
                <div key={`${event.eventType}-${event.createdAt}-${index}`} className="ae">
                  <span className="at">{formatAuditStamp(event.createdAt)}</span>
                  <span className="av">
                    {event.eventType === "status_changed"
                      ? `Status changed to ${String(event.metadata.new_status ?? event.metadata.status ?? "")}`
                      : event.eventType === "credential_opened"
                        ? "Credentials revealed"
                        : "Implementation submitted"}
                    <i>
                      {String(event.metadata.changed_by_email || event.metadata.accessed_by_email || event.actorUserId || "")}
                    </i>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="kd na">No activity recorded yet.</div>
          )}
        </div>
      </div>

      {toast ? (
        <div className="toast on" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{toast}</span>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  empty,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  empty?: string;
}) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed && !empty) {
    return null;
  }
  return (
    <span className="kv">
      <span className="kk">{label}</span>
      <span className={`kd${mono ? " m" : ""}${trimmed ? "" : " na"}`}>{trimmed || empty}</span>
    </span>
  );
}
