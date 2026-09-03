"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { TraqraSelect } from "@/components/setup/TraqraSelect";
import { PMS_ACCESS_OPTIONS, PMS_CATALOGUE } from "@/lib/implementation/catalogue";
import {
  fieldsClearedOnPmsChange,
  hostingFromPms,
  isOperaCloudFamily,
  isOperaOnPrem,
  pmsStepComplete,
} from "@/lib/implementation/selectors";
import type { ConnectionMethod, PmsAccessMethod } from "@/types/implementation";

export function PmsScreen() {
  const router = useRouter();
  const { state, patch, saveDraft } = useIntake();
  const [error, setError] = useState(false);
  const [differentContact, setDifferentContact] = useState(false);
  const selected = PMS_CATALOGUE.find((item) => item.id === state.pmsId);
  const ready = pmsStepComplete(state);
  const showOperaCloud = isOperaCloudFamily(state);
  const showOperaOnPrem = isOperaOnPrem(state);
  const showOtherDetails = Boolean(state.pmsId) && !showOperaCloud && !showOperaOnPrem;
  const selectedAccess = PMS_ACCESS_OPTIONS.find((item) => item.value === state.pmsAccessMethod);

  function selectPms(id: string) {
    if (id === state.pmsId) {
      return;
    }
    patch({
      ...fieldsClearedOnPmsChange(),
      pmsId: id,
      hosting: hostingFromPms(id),
      otherPmsName: id === "other" ? state.otherPmsName : "",
    });
    setError(false);
  }

  function setAccess(method: Exclude<PmsAccessMethod, "">) {
    const mapped: ConnectionMethod | null =
      method === "api" ? "api" : method === "sftp" ? "sftp" : method === "unsure" ? "unsure" : null;
    patch({ pmsAccessMethod: method, connectionMethod: mapped });
  }

  async function onContinue() {
    if (!ready) {
      setError(true);
      return;
    }
    patch({ connectionDetailsStatus: "complete" });
    try {
      await saveDraft();
    } catch {
      // best-effort
    }
    router.push("/implementation/review");
  }

  return (
    <div>
      <div className="intro">
        <h1>Which system runs your front desk?</h1>
        <p>Your Property Management System — the software your team uses for reservations and check-in.</p>
      </div>
      <div className="card">
        <div className="f" style={{ marginBottom: 0 }}>
          <label>
            Property Management System<span className="rq">*</span>
          </label>
          <TraqraSelect
            id="pms"
            value={state.pmsId || ""}
            placeholder="Search or select your PMS"
            onChange={selectPms}
            options={PMS_CATALOGUE.map((item) => ({
              value: item.id,
              label: item.name,
              desc: item.vendor || undefined,
            }))}
          />
        </div>

        {state.pmsId === "other" ? (
          <div style={{ marginTop: 14 }}>
            <div className={`f${error && !state.otherPmsName.trim() ? " iserr" : ""}`} style={{ marginBottom: 0 }}>
              <label htmlFor="other-pms">
                What is it called?<span className="rq">*</span>
              </label>
              <input
                id="other-pms"
                placeholder="e.g. HotelKey"
                value={state.otherPmsName}
                onChange={(event) => patch({ otherPmsName: event.target.value })}
              />
            </div>
          </div>
        ) : null}

        {selected?.host ? (
          <div style={{ marginTop: 14 }}>
            <div className="note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>
                We know <b>{selected.name}</b> is{" "}
                {selected.host === "cloud"
                  ? "cloud-hosted"
                  : selected.host === "hybrid"
                    ? "usually hybrid"
                    : "installed at the property"}
                , so we won&apos;t ask you about hosting.
              </span>
            </div>
          </div>
        ) : null}

        {showOperaCloud ? (
          <div className="sec">
            <div className="sq">A few OPERA Cloud details</div>
            <div className="sh">Only what we need to start access. Blank optional fields are fine.</div>
            <div
              className={`f${error && !(state.hotelId || state.propertyCode).trim() ? " iserr" : ""}`}
            >
              <label htmlFor="hotel-id">
                Hotel ID / Property Code<span className="rq">*</span>
              </label>
              <input
                id="hotel-id"
                className="mono"
                value={state.hotelId}
                onChange={(event) =>
                  patch({ hotelId: event.target.value, propertyCode: event.target.value })
                }
              />
              {error && !(state.hotelId || state.propertyCode).trim() ? (
                <div className="err">Enter the Hotel ID or property code.</div>
              ) : null}
            </div>
            <div className="f">
              <label htmlFor="enterprise-id">
                OHIP Enterprise ID<span className="op">· optional</span>
              </label>
              <input
                id="enterprise-id"
                className="mono"
                value={state.enterpriseId}
                onChange={(event) => patch({ enterpriseId: event.target.value })}
              />
              <div className="hint">
                If you know it, enter it here. Otherwise leave it blank — our implementation team can
                confirm it.
              </div>
            </div>
            <div className="note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span>
                We&apos;ll contact <b>{state.technicalContact || "your PMS access contact"}</b> about
                PMS access. Never type a password or key into this form.
              </span>
            </div>
            <button
              type="button"
              className="btn link"
              style={{ marginTop: 12 }}
              onClick={() => setDifferentContact((value) => !value)}
            >
              {differentContact ? "Use the PMS access contact already entered" : "Use a different contact"}
            </button>
            {differentContact ? (
              <div className="two" style={{ marginTop: 13 }}>
                <div className="f">
                  <label htmlFor="alt-pms-name">PMS access contact name</label>
                  <input
                    id="alt-pms-name"
                    value={state.technicalContact}
                    onChange={(event) =>
                      patch({ technicalContact: event.target.value, samePmsContact: false })
                    }
                  />
                </div>
                <div className="f">
                  <label htmlFor="alt-pms-email">PMS access contact email</label>
                  <input
                    id="alt-pms-email"
                    type="email"
                    value={state.technicalContactEmail}
                    onChange={(event) =>
                      patch({ technicalContactEmail: event.target.value, samePmsContact: false })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showOperaOnPrem ? (
          <div className="sec">
            <div className="sq">A few OPERA details</div>
            <div className="sh">Tell us the property code and how data can be provided today.</div>
            <div
              className={`f${error && !(state.propertyCode || state.hotelId).trim() ? " iserr" : ""}`}
            >
              <label htmlFor="property-code">
                Property / Hotel Code<span className="rq">*</span>
              </label>
              <input
                id="property-code"
                className="mono"
                value={state.propertyCode || state.hotelId}
                onChange={(event) =>
                  patch({ propertyCode: event.target.value, hotelId: event.target.value })
                }
              />
            </div>
            <AccessChoices
              label="How can data be provided from your PMS today?"
              hideOnPrem
              value={state.pmsAccessMethod}
              error={error && !state.pmsAccessMethod}
              onChange={setAccess}
              hint={selectedAccess?.hint}
            />
          </div>
        ) : null}

        {showOtherDetails ? (
          <div className="sec">
            <div className="sq">
              A few details for {PMS_CATALOGUE.find((item) => item.id === state.pmsId)?.name}
            </div>
            <div className="sh">Only what you have to hand.</div>
            <div className="f">
              <label htmlFor="site-id">
                Property / site identifier<span className="op">· if known</span>
              </label>
              <input
                id="site-id"
                className="mono"
                value={state.propertyCode}
                onChange={(event) => patch({ propertyCode: event.target.value })}
              />
            </div>
            <AccessChoices
              label="How can data be accessed?"
              value={state.pmsAccessMethod}
              error={error && !state.pmsAccessMethod}
              onChange={setAccess}
              hint={selectedAccess?.hint}
            />
          </div>
        ) : null}
      </div>
      <div className="nav">
        <button type="button" className="btn" onClick={() => router.push("/implementation/contacts")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <button type="button" className="btn pri" disabled={!ready} onClick={() => void onContinue()}>
          Continue
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AccessChoices({
  label,
  value,
  error,
  onChange,
  hint,
  hideOnPrem = false,
}: {
  label: string;
  value: PmsAccessMethod;
  error: boolean;
  onChange: (value: Exclude<PmsAccessMethod, "">) => void;
  hint?: string;
  hideOnPrem?: boolean;
}) {
  const options = hideOnPrem
    ? PMS_ACCESS_OPTIONS.filter((item) => item.value !== "onprem")
    : PMS_ACCESS_OPTIONS;

  return (
    <div className={`f${error ? " iserr" : ""}`} style={{ marginBottom: 0 }}>
      <div className="sq">{label}</div>
      <div className="sh">If you&apos;re not sure, say so — that&apos;s a normal answer.</div>
      <div className="opts">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`opt${item.value === "unsure" ? " dk" : ""}${value === item.value ? " on" : ""}`}
            onClick={() => onChange(item.value)}
          >
            <span className="rd" />
            <span>
              <span className="ol">{item.label}</span>
              {item.hint ? <span className="od">{item.hint}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {hint && value === "unsure" ? (
        <div className="rsr" style={{ marginTop: 12 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{hint}</span>
        </div>
      ) : null}
      {error ? <div className="err">Choose an option — I&apos;m not sure is fine.</div> : null}
    </div>
  );
}
