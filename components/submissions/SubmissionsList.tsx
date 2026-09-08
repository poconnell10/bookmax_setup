"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TraqraSelect } from "@/components/setup/TraqraSelect";
import {
  credentialBadge,
  formatSubmissionStamp,
  pmsSubline,
  propertySubline,
  STATUS_FILTER_OPTIONS,
  statusTone,
  visibleConnectionMethod,
} from "@/lib/implementation/internal/display";
import type { SubmissionRecord } from "@/types/implementation";

export function SubmissionsList({ submissions }: { submissions: SubmissionRecord[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pms, setPms] = useState("");
  const [status, setStatus] = useState("");

  const pmsOptions = useMemo(
    () => [
      { value: "", label: "All PMS" },
      ...[...new Set(submissions.map((item) => item.pms).filter((item) => item && item !== "—"))].sort().map((item) => ({
        value: item,
        label: item,
      })),
    ],
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
    <div className="subs">
      <h1>Implementation submissions</h1>
      <p className="lede">
        Every BookMax Setup that has been submitted. Open one to review exactly what was provided. Credential values are
        never stored here or shown.
      </p>
      <div className="filters">
        <div className="srch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Search customer, property or contact…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search submissions"
          />
        </div>
        <TraqraSelect
          id="fpms"
          value={pms}
          searchable={pmsOptions.length >= 9}
          ariaLabel="PMS"
          placeholder="All PMS"
          options={pmsOptions}
          onChange={setPms}
        />
        <TraqraSelect
          id="fstat"
          value={status}
          searchable={false}
          ariaLabel="Status"
          placeholder="All statuses"
          options={STATUS_FILTER_OPTIONS}
          onChange={setStatus}
        />
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
        <div className="list">
          {filtered.map((item) => {
            const credentials = credentialBadge(item.credentials_status);
            const connection = visibleConnectionMethod(item);
            const pmsMeta = pmsSubline(item);
            return (
              <button
                key={item.submission_id}
                type="button"
                className="row"
                onClick={() => router.push(`/implementation/submissions/${item.submission_id}`)}
              >
                <span>
                  <span className="fk">Customer</span>
                  <span className="fv">
                    {item.organisation}
                    <span className="sub2">{propertySubline(item) || "—"}</span>
                  </span>
                </span>
                <span>
                  <span className="fk">PMS</span>
                  <span className="fv">
                    {item.pms && item.pms !== "—" ? item.pms : "—"}
                    <span className="sub2">{pmsMeta || "—"}</span>
                  </span>
                </span>
                <span>
                  <span className="fk">Connection</span>
                  <span className={`fv sm${connection ? "" : " na"}`}>{connection || "Not yet provided"}</span>
                </span>
                <span>
                  <span className="fk">Credentials</span>
                  <span className={`bd ${credentials.tone}`}>{credentials.label}</span>
                </span>
                <span className="c5">
                  <span className="fk">Submitted</span>
                  <span className="fv sm">
                    {formatSubmissionStamp(item.submitted_at, "date") || item.submitted_at}
                    <span className="sub2">{item.technical_contact || item.submitted_by || "—"}</span>
                  </span>
                </span>
                <span className="c6">
                  <span className="fk">Status</span>
                  <span className={`bd ${statusTone(item.status)}`}>{item.status}</span>
                </span>
                <span className="chev" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
