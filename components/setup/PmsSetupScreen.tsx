"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { fetchSetupContext } from "@/lib/setup/client";
import { emptySetupIntake, ownerName, pmsSelectionComplete, type SetupIntakePayload } from "@/lib/setup/intake";
import { findSetupPms, nextMsg, SETUP_PMS_OPTIONS, type SetupPmsOption } from "@/lib/setup/pms-catalogue";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

function matchesQuery(option: SetupPmsOption, query: string): boolean {
  if (option.id === "other" || !query) {
    return true;
  }
  const haystack = `${option.label} ${option.vendor}`.toLowerCase();
  return haystack.includes(query);
}

export function PmsSetupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState<CustomerProperty | null>(null);
  const [intake, setIntake] = useState<SetupIntakePayload>(emptySetupIntake());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [formError, setFormError] = useState("");
  const [pmsId, setPmsId] = useState("");
  const [otherPmsName, setOtherPmsName] = useState("");
  const [query, setQuery] = useState("");

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
        setEmail(payload.email || "");
        setProperty(payload.property);
        setIntake(payload.intake || emptySetupIntake());
        setPmsId(payload.intake?.pmsId || "");
        setOtherPmsName(payload.intake?.otherPmsName || "");
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

  const selected = findSetupPms(pmsId);
  const draft: SetupIntakePayload = {
    ...intake,
    pmsId: (pmsId || null) as SetupIntakePayload["pmsId"],
    otherPmsName,
  };
  const normalizedQuery = query.trim().toLowerCase();
  const cloud = SETUP_PMS_OPTIONS.filter((item) => item.host === "cloud" && matchesQuery(item, normalizedQuery));
  const onprem = SETUP_PMS_OPTIONS.filter((item) => item.host === "onprem" && matchesQuery(item, normalizedQuery));
  const other = SETUP_PMS_OPTIONS.find((item) => item.id === "other")!;
  const visible = [...cloud, ...onprem, other];
  const owner = ownerName(intake, property);

  function pickPms(id: string) {
    setPmsId(id);
    setError(false);
    if (id !== "other") {
      setOtherPmsName("");
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const named = visible.filter((item) => item.id !== "other");
    if (named.length === 1) {
      pickPms(named[0].id);
    }
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!delta) {
      return;
    }
    event.preventDefault();
    const next = visible[(index + delta + visible.length) % visible.length];
    pickPms(next.id);
  }

  async function onContinue() {
    if (!pmsSelectionComplete(draft)) {
      setError(true);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/setup/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "pms", pmsId: draft.pmsId, otherPmsName: draft.otherPmsName }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFormError(payload.error || "We couldn't save your selection. Try again.");
        return;
      }
      router.push("/setup/connect");
    } catch {
      setFormError("We couldn't save your selection. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SetupShell email={email}>
        <p className="sub">Loading…</p>
      </SetupShell>
    );
  }

  function renderRow(option: SetupPmsOption, index: number) {
    const on = pmsId === option.id;
    return (
      <button
        key={option.id}
        type="button"
        className={`pr${option.id === "other" ? " esc" : ""}${on ? " on" : ""}`}
        role="radio"
        aria-checked={on}
        tabIndex={pmsId ? (on ? 0 : -1) : index === 0 ? 0 : -1}
        onClick={() => pickPms(option.id)}
        onKeyDown={(event) => onRowKeyDown(event, index)}
      >
        <span className="rd2" />
        <span className="pn2">{option.label}</span>
        {option.vendor ? <span className="pv2">{option.vendor}</span> : null}
      </button>
    );
  }

  return (
    <SetupShell email={email} saved property={property} intake={intake}>
      <div className="intro">
        <h1>Which system runs your front desk?</h1>
        <p>Your Property Management System — the software your team uses for reservations and check-in.</p>
      </div>
      <div className="card">
        <div className={`f${error && !pmsId ? " iserr" : ""}`} style={{ marginBottom: 0 }}>
          <label htmlFor="pmsq">
            Property Management System<span className="rq">*</span>
          </label>
          <div className="pfilter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              id="pmsq"
              placeholder="Start typing to narrow the list"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>
          <div className="plist" role="radiogroup" aria-label="Property Management System">
            {!cloud.length && !onprem.length ? (
              <div className="pnone">
                Nothing matches “{query.trim()}” — choose <b>Other / not listed</b> and tell us the name.
              </div>
            ) : null}
            {cloud.length ? (
              <>
                <div className="pg">
                  Cloud<span>{cloud.length}</span>
                </div>
                {cloud.map((item, index) => renderRow(item, index))}
              </>
            ) : null}
            {onprem.length ? (
              <>
                <div className="pg">
                  On-premise<span>{onprem.length}</span>
                </div>
                {onprem.map((item, index) => renderRow(item, cloud.length + index))}
              </>
            ) : null}
            {renderRow(other, visible.length - 1)}
          </div>
          {error && !pmsId ? <div className="err">Select your property management system.</div> : null}
        </div>
        {pmsId === "other" ? (
          <div id="pmsOther" style={{ marginTop: 14 }}>
            <div className={`f${error && !otherPmsName.trim() ? " iserr" : ""}`} style={{ marginBottom: 0 }}>
              <label htmlFor="pmsname">
                What is it called?<span className="rq">*</span>
              </label>
              <input
                id="pmsname"
                placeholder="e.g. HotelKey"
                value={otherPmsName}
                onChange={(event) => {
                  setOtherPmsName(event.target.value);
                  setError(false);
                }}
              />
              {error && !otherPmsName.trim() ? <div className="err">Enter the PMS name.</div> : null}
            </div>
          </div>
        ) : null}
        {selected ? (
          <div id="pmsEcho" style={{ marginTop: 14 }}>
            {selected.host ? (
              <div className="note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span>{nextMsg(selected)}</span>
              </div>
            ) : (
              <div className="note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 16v-5M12 8h.01" />
                </svg>
                <span>
                  No problem — we&apos;ll look into it and work out the right connection method with{" "}
                  {owner || "your PMS contact"}.
                </span>
              </div>
            )}
          </div>
        ) : null}
        {formError ? (
          <div className="err" role="alert">
            {formError}
          </div>
        ) : null}
      </div>
      <div className="nav">
        <button type="button" className="btn" onClick={() => router.push("/setup/property")}>
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
