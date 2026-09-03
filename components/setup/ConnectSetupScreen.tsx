"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { fetchSetupContext } from "@/lib/setup/client";
import {
  emptySetupIntake,
  initials,
  isSetupOhipPms,
  needsCloudAccessFields,
  needsConnectionRoute,
  ownerEmail,
  ownerName,
  SETUP_ACCESS_OPTIONS,
  type SetupIntakePayload,
} from "@/lib/setup/intake";
import { findSetupPms, isSetupCloudPms, nextMsg } from "@/lib/setup/pms-catalogue";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

export function ConnectSetupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState<CustomerProperty | null>(null);
  const [intake, setIntake] = useState<SetupIntakePayload>(emptySetupIntake());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState<SetupIntakePayload | null>(null);
  const [credentialsReceived, setCredentialsReceived] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const [credError, setCredError] = useState("");
  const [credSubmitting, setCredSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchSetupContext();
        if (cancelled) {
          return;
        }
        if (!payload.ok) {
          router.replace("/access");
          return;
        }
        if (payload.submission) {
          router.replace("/setup/thanks");
          return;
        }
        if (!payload.property) {
          router.replace("/setup/property");
          return;
        }
        if (!payload.intake?.pmsId) {
          router.replace("/setup/pms");
          return;
        }
        const loaded = payload.intake;
        setEmail(payload.email || "");
        setProperty(payload.property);
        setIntake(loaded);
        setDraft(loaded);
        if (isSetupCloudPms(loaded.pmsId)) {
          try {
            const statusResponse = await fetch("/api/setup/credentials/status");
            const status = (await statusResponse.json()) as {
              ok?: boolean;
              credentialsReceived?: boolean;
            };
            if (!cancelled && status.ok && status.credentialsReceived === true) {
              setCredentialsReceived(true);
            }
          } catch {
            // Receipt lookup is optional; treat failure as not received.
          }
        }
      } catch {
        router.replace("/access");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function patch(next: Partial<SetupIntakePayload>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  function clearCredentialFields() {
    setClientId("");
    setClientSecret("");
    setApplicationKey("");
  }

  function onNotNow() {
    clearCredentialFields();
    setCredError("");
    setCredOpen(false);
  }

  async function onSubmitCredentials() {
    const id = clientId.trim();
    const secret = clientSecret.trim();
    if (!id || !secret) {
      setCredError("Enter your Client ID and client secret.");
      return;
    }
    setCredSubmitting(true);
    setCredError("");
    try {
      const body: { clientId: string; clientSecret: string; applicationKey?: string } = {
        clientId: id,
        clientSecret: secret,
      };
      const key = applicationKey.trim();
      if (key) {
        body.applicationKey = key;
      }
      const response = await fetch("/api/setup/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok?: boolean; credentialsReceived?: boolean; error?: string };
      if (!response.ok || payload.ok !== true || payload.credentialsReceived !== true) {
        setCredError(payload.error || "We couldn't submit your credentials. Try again.");
        return;
      }
      clearCredentialFields();
      setCredOpen(false);
      setCredentialsReceived(true);
    } catch {
      setCredError("We couldn't submit your credentials. Try again.");
    } finally {
      setCredSubmitting(false);
    }
  }

  async function onContinue() {
    if (!draft) {
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/setup/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "connect", ...draft }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFormError(payload.error || "We couldn't save your connection details. Try again.");
        return;
      }
      router.push("/setup/review");
    } catch {
      setFormError("We couldn't save your connection details. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !draft) {
    return (
      <SetupShell email={email}>
        <p className="sub">Loading…</p>
      </SetupShell>
    );
  }

  const pms = findSetupPms(draft.pmsId);
  const pmsName = pms?.id === "other" ? draft.otherPmsName || "your PMS" : pms?.label || "your PMS";
  const contact = ownerName(draft, property);
  const contactEmail = ownerEmail(draft, email);
  const showCloud = needsCloudAccessFields(draft.pmsId);
  const showRoute = needsConnectionRoute(draft.pmsId);
  const echo = nextMsg(pms);

  return (
    <SetupShell email={email} saved property={property} intake={intake}>
      <div className="intro">
        <h1>Connecting to {pmsName}</h1>
        <p>Tell us what you know. Anything you&apos;re unsure of, we&apos;ll sort out with your PMS contact.</p>
      </div>
      {echo ? (
        <div className="note" style={{ marginTop: 19 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>{echo}</span>
        </div>
      ) : null}
      {showCloud ? (
        <div className={`card${draft.hotelId || draft.propertyCode ? " ok" : ""}`} id="a-need">
          <div className="sqrow">
            <span className="sq">What we need to get started</span>
            <span className="ckd">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Done
            </span>
          </div>
          <div className="sh">
            The unique identifier assigned to your hotel in your PMS — found under your property settings
            or dashboard URL.
          </div>
          <div className="f">
            <label htmlFor="ax_code">
              Hotel ID / property code<span className="op">· if you know it</span>
            </label>
            <input
              id="ax_code"
              className="mono"
              placeholder="e.g. GRITTI"
              value={draft.hotelId || draft.propertyCode}
              onChange={(event) =>
                patch({ hotelId: event.target.value, propertyCode: event.target.value })
              }
            />
            <div className="hint">The short code your PMS uses for this property.</div>
          </div>
          {isSetupOhipPms(draft.pmsId) ? (
            <div className="f">
              <label htmlFor="ax_ent">
                OHIP enterprise ID<span className="op">· optional</span>
              </label>
              <input
                id="ax_ent"
                className="mono"
                placeholder="Leave blank if you're not sure"
                value={draft.enterpriseId}
                onChange={(event) => patch({ enterpriseId: event.target.value })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {showRoute ? (
        <>
          <div className={`card${draft.hotelId || draft.propertyCode ? " ok" : ""}`} id="a-need">
            <div className="sqrow">
              <span className="sq">What we need to get started</span>
              <span className="ckd">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Done
              </span>
            </div>
            <div className="sh">
              The unique identifier assigned to your hotel in your PMS — found under your property settings
              or dashboard URL.
            </div>
            <div className="f" style={{ marginBottom: 0 }}>
              <label htmlFor="ax_code_onprem">
                Hotel ID / property code<span className="op">· if you know it</span>
              </label>
              <input
                id="ax_code_onprem"
                className="mono"
                placeholder="e.g. GRITTI"
                value={draft.hotelId || draft.propertyCode}
                onChange={(event) =>
                  patch({ hotelId: event.target.value, propertyCode: event.target.value })
                }
              />
            </div>
          </div>
          <div className={`card${draft.pmsAccessMethod ? " ok" : ""}`} id="a-route">
            <div className="sqrow">
              <span className="sq">How can your property send us PMS data?</span>
              <span className="ckd">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Done
              </span>
            </div>
            <div className="sh">If you&apos;re not sure, say so — that&apos;s a normal answer.</div>
            <div className="opts">
              {SETUP_ACCESS_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`opt${item.value === "unsure" ? " dk" : ""}${draft.pmsAccessMethod === item.value ? " on" : ""}`}
                  onClick={() => patch({ pmsAccessMethod: item.value })}
                >
                  <span className="rd" />
                  <span>
                    <span className="ol">{item.label}</span>
                    <span className="od">{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <RouteExtra draft={draft} contact={contact} onPatch={patch} />
          </div>
        </>
      ) : null}

      <div className={`card${contact && contactEmail ? " ok" : ""}`} id="a-owner">
        <div className="sqrow">
          <span className="sq">Who manages PMS access?</span>
          <span className="ckd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Done
          </span>
        </div>
        <div className="sh">We contact them directly about credentials — never through you.</div>
        <div className="owner">
          <span className="av">{initials(contact)}</span>
          <span className="on2">
            <span className="n2">{contact || "Not set"}</span>
            <span className="e2">{contactEmail || "—"}</span>
          </span>
          <button type="button" className="btn sm" onClick={() => router.push("/setup/property")}>
            Change
          </button>
        </div>
        {isSetupCloudPms(draft.pmsId) ? (
          <div id="credOpt" style={{ marginTop: 12 }}>
            {credentialsReceived ? (
              <div className="rsr">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>Credentials received — thank you. They are encrypted and will not be shown again.</span>
              </div>
            ) : credOpen ? (
              <div className="note" style={{ display: "block" }}>
                <div className="f" style={{ marginTop: 0 }}>
                  <label htmlFor="cd_id">Client ID</label>
                  <div className="sh" style={{ marginBottom: 6 }}>
                    The public identifier for your API integration, found under Developer or API Settings in your
                    PMS portal.
                  </div>
                  <input
                    id="cd_id"
                    className="mono"
                    placeholder="Paste the client ID"
                    autoComplete="off"
                    value={clientId}
                    onChange={(event) => {
                      setClientId(event.target.value);
                      setCredError("");
                    }}
                  />
                </div>
                <div className="f">
                  <label htmlFor="cd_sec">Client secret</label>
                  <div className="sh" style={{ marginBottom: 6 }}>
                    Generated inside your PMS developer portal or API settings alongside your Client ID.
                  </div>
                  <input
                    id="cd_sec"
                    className="mono"
                    type="password"
                    placeholder="Paste the client secret"
                    autoComplete="off"
                    value={clientSecret}
                    onChange={(event) => {
                      setClientSecret(event.target.value);
                      setCredError("");
                    }}
                  />
                </div>
                <div className="f">
                  <label htmlFor="cd_key">
                    Application key<span className="op">· if issued</span>
                  </label>
                  <div className="sh" style={{ marginBottom: 6 }}>
                    A secondary key issued by your PMS to authorize access.
                  </div>
                  <input
                    id="cd_key"
                    className="mono"
                    type="password"
                    placeholder="Paste the application key"
                    autoComplete="off"
                    value={applicationKey}
                    onChange={(event) => setApplicationKey(event.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn pri"
                    disabled={credSubmitting || !clientId.trim() || !clientSecret.trim()}
                    onClick={() => void onSubmitCredentials()}
                  >
                    {credSubmitting ? "Submitting…" : "Submit securely"}
                  </button>
                  <button type="button" className="btn link" onClick={onNotNow}>
                    Not now
                  </button>
                </div>
                {credError ? (
                  <div className="err" role="alert">
                    {credError}
                  </div>
                ) : null}
              </div>
            ) : (
              <button type="button" className="btn link" onClick={() => setCredOpen(true)}>
                I already have our {pms?.cred || "API"} credentials to hand
              </button>
            )}
          </div>
        ) : null}
      </div>

      {formError ? (
        <div className="err" role="alert">
          {formError}
        </div>
      ) : null}
      <div className="nav">
        <button type="button" className="btn" onClick={() => router.push("/setup/pms")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <button type="button" className="btn pri" disabled={saving} onClick={() => void onContinue()}>
          {saving ? "Saving…" : "Continue"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </SetupShell>
  );
}

function RouteExtra({
  draft,
  contact,
  onPatch,
}: {
  draft: SetupIntakePayload;
  contact: string;
  onPatch: (next: Partial<SetupIntakePayload>) => void;
}) {
  if (draft.pmsAccessMethod === "unsure") {
    return (
      <div className="rsr" style={{ marginTop: 12 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>
          That&apos;s fine — we&apos;ll work with {contact || "your PMS contact"} to determine the
          correct connection method. Nothing more is needed from you.
        </span>
      </div>
    );
  }
  if (draft.pmsAccessMethod === "api") {
    return (
      <div className="f" style={{ marginTop: 14, marginBottom: 0 }}>
        <label htmlFor="ax_url">
          API or integration address<span className="op">· if you know it</span>
        </label>
        <input
          id="ax_url"
          className="mono"
          placeholder="Leave blank if you're not sure"
          value={draft.apiUrl}
          onChange={(event) => onPatch({ apiUrl: event.target.value })}
        />
      </div>
    );
  }
  if (draft.pmsAccessMethod === "sftp") {
    return (
      <div className="f" style={{ marginTop: 14, marginBottom: 0 }}>
        <label htmlFor="ax_sftp">
          SFTP host or server<span className="op">· if you know it</span>
        </label>
        <input
          id="ax_sftp"
          className="mono"
          placeholder="Leave blank if you're not sure"
          value={draft.sftpHost}
          onChange={(event) => onPatch({ sftpHost: event.target.value })}
        />
        <div className="hint">
          Ports, folders and scheduling are set up during implementation — no need to gather them now.
        </div>
      </div>
    );
  }
  if (draft.pmsAccessMethod === "interface") {
    return (
      <div className="rsr" style={{ marginTop: 12 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>
          Good — an existing interface is usually the quickest route. We&apos;ll confirm the details
          with {contact || "your PMS contact"}.
        </span>
      </div>
    );
  }
  return null;
}
