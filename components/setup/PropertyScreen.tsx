"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { COUNTRY_OPTIONS } from "@/lib/implementation/catalogue";
import { propertyStepComplete } from "@/lib/implementation/selectors";

export function PropertyScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, patch } = useIntake();
  const [error, setError] = useState(false);
  const fromReview = searchParams.get("from") === "review";
  const locked = state.propertyLocked;

  function onContinue() {
    if (!propertyStepComplete(state)) {
      setError(true);
      return;
    }
    router.push(fromReview ? "/implementation/review" : "/implementation/contacts");
  }

  return (
    <section className="view on">
      <h1>Your property</h1>
      <p className="sub">Confirm the property we&apos;re setting up for BookMax.</p>
      <div className="card">
        {locked ? (
          <div className="known">
            <div className="kh">From your BookMax agreement</div>
            <div className="kgrid">
              <span className="kv">
                <span className="kk">Property</span>
                <span className="kd">{state.properties[0]}</span>
              </span>
              <span className="kv">
                <span className="kk">Country</span>
                <span className="kd">
                  {COUNTRY_OPTIONS.find((item) => item.value === state.country)?.label || state.country}
                </span>
              </span>
              {state.organisation ? (
                <span className="kv">
                  <span className="kk">Hotel group</span>
                  <span className="kd">{state.organisation}</span>
                </span>
              ) : null}
            </div>
            <button type="button" className="btn ln" style={{ marginTop: 12 }} onClick={() => patch({ propertyLocked: false })}>
              Something incorrect?
            </button>
          </div>
        ) : (
          <>
            <div className={`f${error && !state.properties[0]?.trim() ? " iserr" : ""}`}>
              <label htmlFor="property-name">Property name</label>
              <input
                id="property-name"
                value={state.properties[0] || ""}
                onChange={(event) => patch({ properties: [event.target.value] })}
              />
              {error && !state.properties[0]?.trim() ? <div className="err">Enter the property name.</div> : null}
            </div>
            <div className={`f${error && !state.country ? " iserr" : ""}`}>
              <label htmlFor="property-country">Country</label>
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
              <label htmlFor="hotel-group">
                Hotel group / management company <span className="opt">optional</span>
              </label>
              <input
                id="hotel-group"
                value={state.organisation}
                onChange={(event) => patch({ organisation: event.target.value })}
              />
            </div>
          </>
        )}
        <button type="button" className="btn pri" onClick={onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}
