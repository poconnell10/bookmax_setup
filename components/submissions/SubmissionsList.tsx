"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBMISSION_STATUSES, type SubmissionRecord } from "@/types/implementation";

function statusTone(status: string) {
  if (status === "Ready") return "ok";
  if (status === "Under Review") return "rev";
  if (status === "Information Required") return "pend";
  return "info";
}

function credentialLabel(status: SubmissionRecord["credentials_status"]) {
  return status === "received" ? "Received" : "Pending";
}

export function SubmissionsList({ submissions }: { submissions: SubmissionRecord[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pms, setPms] = useState("");
  const [status, setStatus] = useState("");

  const pmsOptions = useMemo(
    () => [...new Set(submissions.map((item) => item.pms).filter(Boolean))].sort(),
    [submissions],
  );

  const filtered = submissions.filter((item) => {
    const haystack = [
      item.organisation,
      item.properties.join(" "),
      item.pms,
      item.technical_contact,
      item.technical_contact_email,
      item.connection_method,
      item.submission_id,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const matchesPms = !pms || item.pms === pms;
    const matchesStatus = !status || item.status === status;
    return matchesQuery && matchesPms && matchesStatus;
  });

  return (
    <div className="step">
      <h1>Implementation submissions</h1>
      <p className="lede">
        Every BookMax Setup that has been submitted. Open one to review exactly what was provided.
        Credential values are never stored here or shown.
      </p>
      <div className="filters">
        <div className="srch" style={{ position: "relative", flex: 1, minWidth: 210 }}>
          <input
            type="search"
            placeholder="Search customer, property or contact…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search submissions"
          />
        </div>
        <select value={pms} onChange={(event) => setPms(event.target.value)} aria-label="PMS">
          <option value="">All PMS</option>
          {pmsOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {SUBMISSION_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="count">
          {filtered.length} of {submissions.length}
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="empty">
          <b>No submissions match.</b>
          <br />
          Clear the filters, or complete a BookMax Setup and refresh.
        </div>
      ) : (
        <div className="log-list">
          {filtered.map((item) => (
            <button
              key={item.submission_id}
              type="button"
              className="log-row"
              onClick={() => router.push(`/implementation/submissions/${item.submission_id}`)}
            >
              <span>
                <span className="fk">Customer</span>
                <span className="fv">
                  {item.organisation}
                  <span className="sub2">{item.properties[0] || "—"}</span>
                </span>
              </span>
              <span>
                <span className="fk">PMS</span>
                <span className="fv">
                  {item.pms || "—"}
                  <span className="sub2">
                    {item.pms_version || "—"} · {item.pms_type || "—"}
                  </span>
                </span>
              </span>
              <span>
                <span className="fk">Connection</span>
                <span className="fv" style={{ fontWeight: 500, fontSize: 12.5 }}>
                  {item.connection_method || "—"}
                </span>
              </span>
              <span>
                <span className="fk">Credentials</span>
                <span className={`bd ${item.credentials_status === "received" ? "ok" : "pend"}`}>
                  {credentialLabel(item.credentials_status)}
                </span>
              </span>
              <span className="c5">
                <span className="fk">Submitted</span>
                <span className="fv" style={{ fontWeight: 500, fontSize: 12.5 }}>
                  {item.submitted_at}
                  <span className="sub2">{item.technical_contact || "—"}</span>
                </span>
              </span>
              <span className={`bd ${statusTone(item.status)}`}>{item.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
