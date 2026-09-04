"use client";

import { useState } from "react";
import Link from "next/link";
import { SUBMISSION_STATUSES, type SubmissionRecord, type SubmissionStatus } from "@/types/implementation";

function credentialLabel(status: SubmissionRecord["credentials_status"]) {
  return status === "received" ? "Received" : "Pending";
}

export function SubmissionReview({ submission }: { submission: SubmissionRecord }) {
  const [record, setRecord] = useState(submission);
  const [error, setError] = useState<string | null>(null);
  const canUpdateStatus = Boolean(record.can_update_status);

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
  }

  return (
    <div className="step">
      <div className="rhead">
        <div style={{ minWidth: 0 }}>
          <h2>{record.organisation}</h2>
          <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 3 }}>
            {record.properties.join(", ")} · {record.pms}
          </div>
          <span className="id">{record.submission_id}</span>
        </div>
        <div className="ract" style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <label htmlFor="submission-status">Status</label>
          {canUpdateStatus ? (
            <select
              id="submission-status"
              value={record.status}
              aria-label="Status"
              onChange={(event) => void onStatusChange(event.target.value as SubmissionStatus)}
            >
              {SUBMISSION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <span id="submission-status">{record.status}</span>
          )}
          <Link href="/implementation/submissions" className="btn sm">
            Back to log
          </Link>
        </div>
      </div>
      {error ? (
        <div className="sfine" role="alert" style={{ marginTop: 12, color: "var(--red)" }}>
          {error}
        </div>
      ) : null}

      <div className="card">
        <div className="chd">
          <span className="t">Property &amp; PMS</span>
          <span className="ro" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mut-2)" }}>
            read only
          </span>
        </div>
        <div className="cb">
          <div className="sgrid">
            <Row label="Customer" value={record.organisation} />
            <Row label="Property" value={record.properties.join(", ")} />
            <Row label="Number of properties" value={String(record.properties.length)} />
            <Row label="Country" value={record.country || "—"} />
            <Row
              label="Primary contact"
              value={[record.primary_contact, record.primary_contact_email].filter(Boolean).join(" · ") || "—"}
            />
            <Row label="PMS" value={record.pms} />
            <Row label="PMS version" value={record.pms_version || "—"} />
            <Row label="PMS type" value={record.pms_type || "—"} />
            <Row label="PMS access contact" value={record.technical_contact} />
            <Row label="PMS access email" value={record.technical_contact_email} />
            <Row label="WhatsApp / mobile" value={record.technical_contact_mobile || "—"} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <span className="t">Connection</span>
          <span className="ro" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mut-2)" }}>
            read only
          </span>
        </div>
        <div className="cb">
          <div className="sgrid">
            <Row label="Connection method" value={record.connection_method || "—"} />
            {Object.entries(record.connection_details).map(([key, value]) => (
              <Row key={key} label={key} value={value} />
            ))}
            <Row label="Credentials" value={credentialLabel(record.credentials_status)} />
            {record.credentials_status === "received" ? (
              <>
                <Row label="Received at" value={record.credentials_received_at || "—"} />
                <Row label="Credential type" value={record.credential_type || "—"} />
              </>
            ) : null}
          </div>
          <div className="secnote">
            <span>
              <b>Credential values are not held in this log.</b> This view records only whether they
              have been received.
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
          <span className="ro" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mut-2)" }}>
            read only
          </span>
        </div>
        <div className="cb">
          <div className="sgrid">
            <Row label="Submission ID" value={record.submission_id} />
            <Row label="Submitted at" value={record.submitted_at} />
            <Row label="Submitted by" value={record.submitted_by} />
            <Row label="Status" value={record.status} />
            <Row label="Last updated" value={record.updated_at} />
          </div>
        </div>
      </div>

      {record.audit_events && record.audit_events.length > 0 ? (
        <div className="card">
          <div className="chd">
            <span className="t">Activity</span>
            <span className="ro" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mut-2)" }}>
              audit
            </span>
          </div>
          <div className="cb">
            <div className="sgrid">
              {record.audit_events.map((event, index) => (
                <Row
                  key={`${event.eventType}-${event.createdAt}-${index}`}
                  label={event.eventType === "credential_opened" ? "Credentials revealed" : "Status changed"}
                  value={[
                    event.eventType === "status_changed"
                      ? `${String(event.metadata.previous_status ?? "")} → ${String(event.metadata.new_status ?? "")}`
                      : "Reveal",
                    event.metadata.changed_by_email || event.metadata.accessed_by_email || "",
                    event.createdAt,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="srow">
      <span className="sk2">{label}</span>
      <span className="sv2">{value || "—"}</span>
    </div>
  );
}
