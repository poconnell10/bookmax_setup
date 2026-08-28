"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import {
  AUTH_METHOD_OPTIONS,
  ENVIRONMENT_OPTIONS,
} from "@/lib/implementation/catalogue";
import {
  connectStepComplete,
  credentialLabel,
  filledProperties,
  isBrandRoute,
  isGenericCloudApi,
  isOhipRoute,
  isOnPremOrHybrid,
  pmsDisplayName,
  selectedPms,
} from "@/lib/implementation/selectors";

export function ConnectStep() {
  const router = useRouter();
  const { state, patch, saveConnection, submitCredentials, replaceCredentials } = useIntake();
  const pms = selectedPms(state);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const label = credentialLabel(state);
  const saved = state.connectionDetailsStatus === "complete";
  const ready = connectStepComplete(state);
  const ohip = isOhipRoute(state);
  const onPrem = isOnPremOrHybrid(state) && !ohip && !isBrandRoute(state) && !isGenericCloudApi(state);
  const properties = filledProperties(state);

  if (!pms) {
    return (
      <div className="step">
        <div className="card">
          <div className="cb">Choose a PMS first.</div>
        </div>
      </div>
    );
  }

  async function onSubmitCredentials() {
    await submitCredentials({ clientId, clientSecret, applicationKey });
    setClientId("");
    setClientSecret("");
    setApplicationKey("");
  }

  return (
    <div className="step">
      <div className="why">
        <span>
          <b>Two minutes.</b> We need enough to start the integration work — which property, which system, and who owns access.
        </span>
      </div>

      <div className="card">
        <div className="chd">
          <div>
            <div className="t">
              {pms.name} <span className="code">{ohip ? "OHIP" : pms.integration}</span>
            </div>
            <div className="s">
              {ohip
                ? "Enter connection details first. API credentials can follow later."
                : isBrandRoute(state)
                  ? "Access is granted by the brand. We need the property code and who can sponsor the request."
                  : onPrem
                    ? "Tell us how data can leave your PMS today. If you are not sure, say so."
                    : "A few identifiers and the person who owns access."}
            </div>
          </div>
        </div>
        <div className="cb">
          <div className="known" style={{ marginBottom: 15 }}>
            <div className="kh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>
                Already on file — <b>nothing to re-enter</b>
              </span>
            </div>
            <div className="kgrid">
              {[
                ["Property", properties[0] + (properties.length > 1 ? `  ·  +${properties.length - 1} more` : "")],
                ["PMS", pmsDisplayName(state)],
                ["Technical contact", `${state.technicalContact} · ${state.technicalContactEmail}`],
              ].map(([key, value]) => (
                <span key={key} className="kv">
                  <span className="kk">{key}</span>
                  <span className="kd">{value}</span>
                </span>
              ))}
            </div>
          </div>

          {ohip ? <OhipDetails /> : null}
          {onPrem ? <OnPremDetails /> : null}
          {isBrandRoute(state) ? <BrandDetails /> : null}
          {isGenericCloudApi(state) ? <GenericApiDetails /> : null}

          <div className="sumact">
            {saved ? (
              <span className="savedok">Connection details saved</span>
            ) : (
              <span className="sumn">
                {ready ? "You can return and change any of this later." : "Complete the fields above to save."}
              </span>
            )}
            <button
              type="button"
              className={saved ? "btn sm" : "btn pri"}
              disabled={!saved && !ready}
              onClick={() => {
                if (saved) {
                  patch({ connectionDetailsStatus: "in_progress" });
                  return;
                }
                void saveConnection();
              }}
            >
              {saved ? "Edit details" : ohip ? "Save connection details" : "Save & continue"}
            </button>
          </div>

          {saved && ohip && state.credentialsStatus !== "received" ? (
            <div className="defer">
              <div className="dfr">
                <span className="dfk">Connection details</span>
                <span className="bd ok">Complete</span>
              </div>
              <div className="dfr">
                <span className="dfk">{label}</span>
                <span className="bd part">Pending</span>
              </div>
              <div className="dfn">
                You can return at any time to complete your API credentials. Nothing about this implementation is treated as failed while they are outstanding.
              </div>
            </div>
          ) : null}

          {ohip ? (
            <div className="grp" id="credBlk">
              <div className="sechd">
                <span className="gk" style={{ margin: 0 }}>
                  Secure API Credentials
                </span>
                <span className={`cdst ${state.credentialsStatus === "received" ? "ok" : "pend"}`}>
                  {state.credentialsStatus === "received" ? "Received" : "Pending"}
                </span>
              </div>
              <div className="secsub">
                You may securely submit Client ID, Client Secret and Application Key now, or leave them pending and return later.
              </div>
              <div className="cred" style={{ marginBottom: 13 }}>
                <span className="ct">
                  <b>Handled separately from your configuration</b>
                  <i>
                    Credentials are submitted to a secure server endpoint and are never displayed again after submission.
                  </i>
                </span>
              </div>
              {state.credentialsStatus === "received" ? (
                <div className="credok">
                  <div className="kgrid">
                    <span className="kv">
                      <span className="kk">Client ID</span>
                      <span className="kd stored">Stored securely</span>
                    </span>
                    <span className="kv">
                      <span className="kk">Client Secret</span>
                      <span className="kd stored">Stored securely</span>
                    </span>
                    <span className="kv">
                      <span className="kk">Application Key</span>
                      <span className="kd stored">Stored securely</span>
                    </span>
                  </div>
                  <button type="button" className="btn sm" style={{ marginTop: 13 }} onClick={replaceCredentials}>
                    Replace credentials
                  </button>
                </div>
              ) : (
                <>
                  <div className="row two">
                    <div className="f fullrow">
                      <label>
                        Client ID <span className="req">required</span>
                      </label>
                      <input
                        className="mono"
                        autoComplete="off"
                        value={clientId}
                        onChange={(event) => setClientId(event.target.value)}
                      />
                    </div>
                    <div className="f">
                      <label>
                        Client Secret <span className="req">required</span>
                      </label>
                      <input
                        className="mono"
                        type="password"
                        autoComplete="off"
                        value={clientSecret}
                        onChange={(event) => setClientSecret(event.target.value)}
                      />
                    </div>
                    <div className="f">
                      <label>
                        Application Key <span className="req">required</span>
                      </label>
                      <input
                        className="mono"
                        type="password"
                        autoComplete="off"
                        value={applicationKey}
                        onChange={(event) => setApplicationKey(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="sumact" style={{ borderTop: "none" }}>
                    <span className="sumn">All three are needed together. You can leave this until later.</span>
                    <button
                      type="button"
                      className="btn pri"
                      disabled={!clientId.trim() || !clientSecret.trim() || !applicationKey.trim()}
                      onClick={() => void onSubmitCredentials()}
                    >
                      Submit API credentials
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="navbar">
        <button type="button" className="btn" onClick={() => router.push("/implementation/property")}>
          Back
        </button>
        <button
          type="button"
          className="btn pri"
          disabled={!saved}
          onClick={() => router.push("/implementation/summary")}
        >
          Continue to Summary
        </button>
      </div>
    </div>
  );
}

function OhipDetails() {
  const { state, patch } = useIntake();
  const status =
    state.connectionDetailsStatus === "complete"
      ? "Saved"
      : state.environment || state.enterpriseId
        ? "In progress"
        : "Not started";

  return (
    <div className="grp">
      <div className="sechd">
        <span className="gk" style={{ margin: 0 }}>
          OHIP Connection Details
        </span>
        <span className={`cdst ${status === "Saved" ? "ok" : status === "In progress" ? "pend" : ""}`}>
          {status}
        </span>
      </div>
      <div className="secsub">
        Enter the environment and property information needed to prepare your OHIP connection. You can save this section without API credentials.
      </div>
      <div className="f fullrow">
        <label>
          Environment <span className="req">required</span>
        </label>
        <div className="seg">
          {ENVIRONMENT_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={state.environment === item.value ? "on" : ""}
              onClick={() => patch({ environment: item.value })}
            >
              {item.label}
            </button>
          ))}
        </div>
        {state.environment ? (
          <div className="segmsg">
            <b>{ENVIRONMENT_OPTIONS.find((item) => item.value === state.environment)?.label}</b>
            {" — "}
            {ENVIRONMENT_OPTIONS.find((item) => item.value === state.environment)?.description}
          </div>
        ) : (
          <div className="segmsg">Select the environment you want BookMax to use. Nothing is assumed.</div>
        )}
      </div>
      <div className="row two" style={{ marginTop: 13 }}>
        <Field label="Enterprise ID" required value={state.enterpriseId} onChange={(value) => patch({ enterpriseId: value })} />
        <Field label="Hotel ID / Property Code" required value={state.hotelId} onChange={(value) => patch({ hotelId: value })} />
        <Field label="OHIP Gateway URL" required value={state.gatewayUrl} onChange={(value) => patch({ gatewayUrl: value })} />
        <div className="f">
          <label>
            Authentication Method <span className="req">required</span>
          </label>
          <select value={state.authMethod} onChange={(event) => patch({ authMethod: event.target.value })}>
            <option value="">Select…</option>
            {AUTH_METHOD_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="OAuth Scope"
          required={Boolean(state.authMethod && state.authMethod !== "Not sure")}
          value={state.oauthScope}
          onChange={(value) => patch({ oauthScope: value })}
        />
        <Field label="Chain Code" value={state.chainCode} onChange={(value) => patch({ chainCode: value })} />
        <Field label="OHIP Administrator" required value={state.ohipAdmin} onChange={(value) => patch({ ohipAdmin: value })} />
        <Field
          label="Administrator Email"
          required
          value={state.ohipAdminEmail}
          onChange={(value) => patch({ ohipAdminEmail: value })}
        />
      </div>
    </div>
  );
}

function OnPremDetails() {
  const { state, patch } = useIntake();
  const pms = selectedPms(state);

  return (
    <div className="grp">
      <div className="flow">
        <div className="f w-m">
          <label>PMS</label>
          <input readOnly value={pmsDisplayName(state)} />
        </div>
        <div className="f w-m">
          <label>
            PMS Version <span className="req">required</span>
          </label>
          <input
            className="mono"
            placeholder="e.g. 5.6.2 — or approximate"
            value={state.pmsVersion}
            onChange={(event) => patch({ pmsVersion: event.target.value })}
          />
        </div>
        <div className="f w-m">
          <label>Technical Contact</label>
          <input readOnly value={state.technicalContact} />
        </div>
        <div className="f w-l">
          <label>Email</label>
          <input readOnly value={state.technicalContactEmail} />
        </div>
        <div className="f w-m">
          <label>
            WhatsApp / Mobile <span className="opt">optional</span>
          </label>
          <input
            placeholder="+34 …"
            value={state.technicalContactMobile}
            onChange={(event) => patch({ technicalContactMobile: event.target.value })}
          />
        </div>
      </div>
      <div className="grp">
        <div className="gk">Do you know how your PMS data can be accessed?</div>
        <div className="secsub">Optional — if you&apos;re unsure, we&apos;ll work directly with your technical contact.</div>
        <div className="opts">
          {(
            [
              ["api", "API / Integration", "Our installation exposes an API, or we run middleware that could carry the data."],
              ["sftp", "SFTP / File Transfer", "We can place files on a secure server."],
              ["unsure", "Not sure", "I do not know what is available."],
            ] as const
          ).map(([id, name, description]) => (
            <button
              key={id}
              type="button"
              className={`opt${state.connectionMethod === id ? " on" : ""}`}
              onClick={() => patch({ connectionMethod: id })}
            >
              <span className="rd" />
              <span className="ot">
                <b>{name}</b>
                <i>{description}</i>
              </span>
            </button>
          ))}
        </div>
        {state.connectionMethod === "api" ? (
          <div className="reveal">
            <div className="flow">
              <div className="f w-l">
                <label>
                  API / Integration URL <span className="opt">optional</span>
                </label>
                <input
                  className="mono"
                  value={state.apiUrl}
                  onChange={(event) => patch({ apiUrl: event.target.value })}
                />
              </div>
              <div className="f w-m">
                <label>
                  API credentials available? <span className="opt">optional</span>
                </label>
                <select
                  value={state.apiCredentialsAvailable}
                  onChange={(event) =>
                    patch({ apiCredentialsAvailable: event.target.value as IntakeAvailability })
                  }
                >
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Not sure</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}
        {state.connectionMethod === "sftp" ? (
          <div className="reveal">
            <div className="flow">
              <div className="f w-m">
                <label>
                  Transfer details available? <span className="opt">optional</span>
                </label>
                <select
                  value={state.transferDetailsAvailable}
                  onChange={(event) =>
                    patch({ transferDetailsAvailable: event.target.value as IntakeAvailability })
                  }
                >
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Not sure</option>
                </select>
              </div>
              {state.transferDetailsAvailable === "Yes" ? (
                <div className="f w-m">
                  <label>
                    SFTP Host / Server <span className="opt">optional</span>
                  </label>
                  <input
                    className="mono"
                    placeholder="sftp.example.com"
                    value={state.sftpHost}
                    onChange={(event) => patch({ sftpHost: event.target.value })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {state.connectionMethod === "unsure" ? (
          <div className="why" style={{ marginTop: 12 }}>
            <span>
              No problem — we will work with <b>{state.technicalContact || "your technical contact"}</b> to determine the best connection method. You can carry on and submit.
            </span>
          </div>
        ) : null}
        <p className="hint" style={{ marginTop: 12, fontSize: 12, color: "var(--mut)" }}>
          {pms?.name} is already selected. Version is the one detail we cannot look up.
        </p>
      </div>
    </div>
  );
}

function BrandDetails() {
  const { state, patch } = useIntake();

  return (
    <div className="grp">
      <div className="row two">
        <Field label="Brand property code" required value={state.propertyCode} onChange={(value) => patch({ propertyCode: value })} />
        <Field label="Brand sponsor" required value={state.brandSponsor} onChange={(value) => patch({ brandSponsor: value })} />
      </div>
    </div>
  );
}

function GenericApiDetails() {
  const { state, patch } = useIntake();

  return (
    <div className="grp">
      <div className="row two">
        <Field label="Property / hotel code" required value={state.propertyCode} onChange={(value) => patch({ propertyCode: value })} />
        <Field label="PMS administrator" required value={state.pmsAdmin} onChange={(value) => patch({ pmsAdmin: value })} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="f">
      <label>
        {label}{" "}
        {required ? <span className="req">required</span> : <span className="opt">optional</span>}
      </label>
      <input className="mono" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

type IntakeAvailability = "" | "Yes" | "No" | "Not sure";
