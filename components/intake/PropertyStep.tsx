"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import {
  COUNTRY_OPTIONS,
  HOSTING_OPTIONS,
  PMS_CATALOGUE,
  findPms,
} from "@/lib/implementation/catalogue";
import {
  hostingNeedsConfirmation,
  propertyStepComplete,
} from "@/lib/implementation/selectors";

export function PropertyStep() {
  const router = useRouter();
  const { state, patch } = useIntake();
  const [editingKnown, setEditingKnown] = useState(false);
  const [query, setQuery] = useState("");
  const country = COUNTRY_OPTIONS.find((item) => item.value === state.country);
  const pms = findPms(state.pmsId);
  const visiblePms = PMS_CATALOGUE.filter(
    (item) =>
      !query ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.vendor.toLowerCase().includes(query.toLowerCase()),
  );

  function pickPms(id: string) {
    const next = findPms(id);
    patch({
      pmsId: id,
      hosting: next?.host || "",
      otherPmsName: id === "other" ? state.otherPmsName : "",
      connectionDetailsStatus: "not_started",
      credentialsStatus: "not_received",
      connectionMethod: null,
      environment: "",
    });
  }

  const canContinue = propertyStepComplete(state);

  return (
    <div className="step">
      <div className="card">
        <div className="chd">
          <div>
            <div className="t">About your property</div>
            <div className="s">
              Two minutes. We only need enough to reach your PMS — once connected, we can begin reviewing your configuration directly.
            </div>
          </div>
        </div>
        <div className="cb">
          <div className={`known${editingKnown ? " editing" : ""}`}>
            <div className="kh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>
                From your agreement — <b>nothing to do here</b> unless something has changed
              </span>
              <button type="button" className="ed" onClick={() => setEditingKnown((value) => !value)}>
                {editingKnown ? "Done" : "Edit"}
              </button>
            </div>
            {!editingKnown ? (
              <div className="kgrid">
                {[
                  ["Organisation", state.organisation],
                  ["Your name", state.contactName],
                  ["Email", state.contactEmail],
                  ["Country", country?.label || ""],
                ].map(([label, value]) => (
                  <span key={label} className="kv">
                    <span className="kk">{label}</span>
                    <span className="kd">{value}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flow">
                <div className="f w-m">
                  <label>Hotel, company or group</label>
                  <input
                    value={state.organisation}
                    onChange={(event) => patch({ organisation: event.target.value })}
                  />
                </div>
                <div className="f w-m">
                  <label>Your name</label>
                  <input
                    value={state.contactName}
                    onChange={(event) => patch({ contactName: event.target.value })}
                  />
                </div>
                <div className="f w-l">
                  <label>Your email</label>
                  <input
                    value={state.contactEmail}
                    onChange={(event) => patch({ contactEmail: event.target.value })}
                  />
                </div>
                <div className="f w-m">
                  <label>Country</label>
                  <select
                    value={state.country}
                    onChange={(event) => patch({ country: event.target.value })}
                  >
                    {COUNTRY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grp">
            <div className="gk">What we still need</div>
            <div className="flow">
              <div className="f full">
                <label>
                  Properties <span className="req">required</span>
                </label>
                <div className="plist">
                  {state.properties.map((property, index) => (
                    <div key={index} className="prow">
                      <span className="pn">{index + 1}</span>
                      <input
                        value={property}
                        placeholder={index ? "Another property name" : "Property name"}
                        onChange={(event) => {
                          const properties = [...state.properties];
                          properties[index] = event.target.value;
                          patch({ properties });
                        }}
                      />
                      {index ? (
                        <button
                          type="button"
                          className="prm"
                          aria-label="Remove this property"
                          onClick={() =>
                            patch({
                              properties: state.properties.filter((_, item) => item !== index),
                            })
                          }
                        >
                          ×
                        </button>
                      ) : (
                        <span className="pfirst">goes live first</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="padd"
                    onClick={() => patch({ properties: [...state.properties, ""] })}
                  >
                    Add another property
                  </button>
                </div>
              </div>
              <div className="f w-m">
                <label>
                  Technical contact <span className="req">required</span>
                </label>
                <input
                  placeholder="Name"
                  value={state.technicalContact}
                  onChange={(event) => patch({ technicalContact: event.target.value })}
                />
                <div className="hint">Who can approve PMS access — we go to them directly.</div>
              </div>
              <div className="f w-l">
                <label>
                  Their email <span className="req">required</span>
                </label>
                <input
                  placeholder="name@hotelabc.com"
                  value={state.technicalContactEmail}
                  onChange={(event) => patch({ technicalContactEmail: event.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <div>
            <div className="t">Which PMS do you use?</div>
            <div className="s">Everything after this is specific to your system.</div>
          </div>
        </div>
        <div className="cb">
          <div className="pmssearch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              placeholder="Search property management systems…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="pmsgrid">
            {visiblePms.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pms${state.pmsId === item.id ? " on" : ""}`}
                onClick={() => pickPms(item.id)}
              >
                <span className="pn">
                  <b>{item.name}</b>
                  <i>{item.vendor}</i>
                </span>
              </button>
            ))}
          </div>
          {state.pmsId === "other" ? (
            <div className="flow" style={{ marginTop: 13 }}>
              <div className="f w-m">
                <label>
                  PMS name <span className="req">required</span>
                </label>
                <input
                  value={state.otherPmsName}
                  placeholder="e.g. StayNTouch"
                  onChange={(event) => patch({ otherPmsName: event.target.value })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {hostingNeedsConfirmation(state) && pms ? (
        <div className="card">
          <div className="chd">
            <div>
              <div className="t">How is it hosted?</div>
              <div className="s">
                Cloud systems usually connect through a vendor API. On-premise and hybrid systems need a different route, which we will work out with your technical contact.
              </div>
            </div>
          </div>
          <div className="cb">
            <div className="opts">
              {HOSTING_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`opt${state.hosting === item.id ? " on" : ""}`}
                  onClick={() => patch({ hosting: item.id, connectionDetailsStatus: "not_started" })}
                >
                  <span className="rd" />
                  <span className="ot">
                    <b>{item.name}</b>
                    <i>{item.description}</i>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="navbar">
        <span className="lft">
          {!state.pmsId
            ? "Choose your PMS to continue."
            : canContinue
              ? `Next: we will tell you exactly what access ${pms?.name} needs.`
              : "Add your technical contact so we can request PMS access from the right person."}
        </span>
        <button
          type="button"
          className="btn pri"
          disabled={!canContinue}
          onClick={() => router.push("/implementation/connect")}
        >
          Continue to Connect PMS
        </button>
      </div>
    </div>
  );
}
