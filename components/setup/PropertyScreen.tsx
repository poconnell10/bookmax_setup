"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { COUNTRY_OPTIONS } from "@/lib/implementation/catalogue";
import { propertyStepComplete } from "@/lib/implementation/selectors";

export function PropertyScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, patch, saveDraft } = useIntake();
  const fromReview = searchParams.get("from") === "review";
  const [error, setError] = useState(false);
  const locked = state.propertyLocked;
  const ready = propertyStepComplete(state);
  const countryLabel =
    COUNTRY_OPTIONS.find((item) => item.value === state.country)?.label || state.country;

  async function onContinue() {
    if (!ready) {
      setError(true);
      return;
    }
    try {
      await saveDraft();
    } catch {
      // draft persistence is best-effort in the POC
    }
    router.push(fromReview ? "/implementation/review" : "/implementation/contacts");
  }

  return (
    <div>
      <div className="intro">
        <h1>Set up your property for BookMax</h1>
        <p>
          BookMax is your pre-arrival upsell solution. We need a few basic details about your
          property and PMS so our implementation team can get started.
        </p>
        <span className="mins">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
          Takes about 2 minutes
        </span>
      </div>

      <div className="card">
        <div className="sec">
          <div className="ct">Your property</div>
          <div className="cs">From your BookMax agreement</div>
          {locked ? (
            <div style={{ marginTop: 15 }}>
              <div className="rv">
                <span className="rvr">
                  <span className="rk">Property</span>
                  <span className="rvv">{state.properties[0]}</span>
                </span>
                <span className="rvr">
                  <span className="rk">Country</span>
                  <span className="rvv">{countryLabel}</span>
                </span>
                {state.organisation ? (
                  <span className="rvr">
                    <span className="rk">Hotel brand</span>
                    <span className="rvv">{state.organisation}</span>
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="btn link"
                style={{ marginTop: 12 }}
                onClick={() => patch({ propertyLocked: false })}
              >
                Something incorrect?
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 15 }}>
              <div className={`f${error && !state.properties[0]?.trim() ? " iserr" : ""}`}>
                <label htmlFor="pname">
                  Property name<span className="rq">*</span>
                </label>
                <input
                  id="pname"
                  placeholder="e.g. The Gritti Palace"
                  value={state.properties[0] || ""}
                  onChange={(event) => patch({ properties: [event.target.value] })}
                />
              </div>
              <div className={`f${error && !state.country ? " iserr" : ""}`}>
                <label htmlFor="property-country">
                  Country<span className="rq">*</span>
                </label>
                <select
                  id="property-country"
                  value={state.country}
                  onChange={(event) => patch({ country: event.target.value })}
                >
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="pgroup">
                  Hotel brand<span className="op">· optional</span>
                </label>
                <input
                  id="pgroup"
                  placeholder="e.g. Marriott Luxury Collection"
                  value={state.organisation}
                  onChange={(event) => patch({ organisation: event.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="nav">
        <span />
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
