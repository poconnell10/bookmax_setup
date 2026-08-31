"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
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
  const searchParams = useSearchParams();
  const { state, patch } = useIntake();
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [differentContact, setDifferentContact] = useState(false);
  const fromReview = searchParams.get("from") === "review";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return PMS_CATALOGUE;
    }
    return PMS_CATALOGUE.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.vendor.toLowerCase().includes(q),
    );
  }, [query]);

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

  function onContinue() {
    if (!pmsStepComplete(state)) {
      setError(true);
      return;
    }
    patch({ connectionDetailsStatus: "complete" });
    router.push(fromReview ? "/implementation/review" : "/implementation/review");
  }

  const showOperaCloud = isOperaCloudFamily(state);
  const showOperaOnPrem = isOperaOnPrem(state);
  const showOtherDetails = Boolean(state.pmsId) && !showOperaCloud && !showOperaOnPrem;
  const selectedAccess = PMS_ACCESS_OPTIONS.find((item) => item.value === state.pmsAccessMethod);

  return (
    <section className="view on">
      <h1>Which PMS does this property use?</h1>
      <p className="sub">
        Select your property management system. We&apos;ll only ask for the information needed for that
        system.
      </p>
      <div className="card">
        <div className="f">
          <label htmlFor="pms-search">Search PMS</label>
          <input
            id="pms-search"
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="pms-list" role="listbox" aria-label="Property management systems">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={state.pmsId === item.id}
              className={`pms-item${state.pmsId === item.id ? " on" : ""}`}
              onClick={() => selectPms(item.id)}
            >
              <b>{item.name}</b>
              <i>{item.vendor}</i>
            </button>
          ))}
        </div>

        {state.pmsId === "other" ? (
          <div className={`f${error && !state.otherPmsName.trim() ? " iserr" : ""}`}>
            <label htmlFor="other-pms">Enter your PMS</label>
            <input
              id="other-pms"
              value={state.otherPmsName}
              onChange={(event) => patch({ otherPmsName: event.target.value })}
            />
          </div>
        ) : null}

        {showOperaCloud ? (
          <>
            <h2 className="subhead">A few OPERA Cloud details</h2>
            <div className={`f${error && !(state.hotelId || state.propertyCode).trim() ? " iserr" : ""}`}>
              <label htmlFor="hotel-id">Hotel ID / Property Code</label>
              <input
                id="hotel-id"
                value={state.hotelId}
                onChange={(event) => patch({ hotelId: event.target.value, propertyCode: event.target.value })}
              />
              {error && !(state.hotelId || state.propertyCode).trim() ? (
                <div className="err">Enter the Hotel ID or property code.</div>
              ) : null}
            </div>
            <div className="f">
              <label htmlFor="enterprise-id">
                OHIP Enterprise ID <span className="opt">optional</span>
              </label>
              <input
                id="enterprise-id"
                value={state.enterpriseId}
                onChange={(event) => patch({ enterpriseId: event.target.value })}
              />
              <div className="hint">
                If you know it, enter it here. Otherwise leave it blank — our implementation team can
                confirm it.
              </div>
            </div>
            <div className="note">
              We&apos;ll contact <b>{state.technicalContact || "your PMS access contact"}</b> about PMS
              access.
            </div>
            <button
              type="button"
              className="btn ln"
              style={{ marginTop: 10 }}
              onClick={() => setDifferentContact((value) => !value)}
            >
              {differentContact ? "Use the PMS access contact already entered" : "Use a different contact"}
            </button>
            {differentContact ? (
              <>
                <div className="f">
                  <label htmlFor="alt-pms-name">PMS access contact name</label>
                  <input
                    id="alt-pms-name"
                    value={state.technicalContact}
                    onChange={(event) => patch({ technicalContact: event.target.value, samePmsContact: false })}
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
              </>
            ) : null}
          </>
        ) : null}

        {showOperaOnPrem ? (
          <>
            <h2 className="subhead">A few OPERA details</h2>
            <div className={`f${error && !(state.propertyCode || state.hotelId).trim() ? " iserr" : ""}`}>
              <label htmlFor="property-code">Property / Hotel Code</label>
              <input
                id="property-code"
                value={state.propertyCode || state.hotelId}
                onChange={(event) => patch({ propertyCode: event.target.value, hotelId: event.target.value })}
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
          </>
        ) : null}

        {showOtherDetails ? (
          <>
            <h2 className="subhead">A few details for {PMS_CATALOGUE.find((item) => item.id === state.pmsId)?.name}</h2>
            <div className="f">
              <label htmlFor="site-id">
                Property / site identifier <span className="opt">if known</span>
              </label>
              <input
                id="site-id"
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
          </>
        ) : null}

        <div className="navbar" style={{ marginTop: 18 }}>
          <button type="button" className="btn" onClick={() => router.push("/implementation/contacts")}>
            Back
          </button>
          <button type="button" className="btn pri" style={{ marginTop: 0, width: "auto" }} onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </section>
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
    <fieldset className={`f${error ? " iserr" : ""}`}>
      <legend>{label}</legend>
      <div className="choices">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`choice${value === item.value ? " on" : ""}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {hint ? <div className="note">{hint}</div> : null}
      {error ? <div className="err">Choose an option — I&apos;m not sure is fine.</div> : null}
    </fieldset>
  );
}
