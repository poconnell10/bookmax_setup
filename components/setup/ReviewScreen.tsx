"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import {
  isOperaCloudFamily,
  reviewSnapshot,
  selectedPms,
  submitBlockers,
} from "@/lib/implementation/selectors";

export function ReviewScreen() {
  const router = useRouter();
  const { state, submitSetup } = useIntake();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const snap = reviewSnapshot(state);
  const pms = selectedPms(state);
  const sameContact =
    state.samePmsContact ||
    (snap.pmsContactName === snap.primaryName && snap.pmsContactEmail === snap.primaryEmail);
  const hosting =
    pms?.host === "cloud"
      ? "Cloud"
      : pms?.host === "onprem"
        ? "On-premise"
        : pms?.host === "hybrid"
          ? "Hybrid"
          : "To be confirmed";

  async function onSubmit() {
    if (submitting.current) {
      return;
    }
    const blockers = submitBlockers(state);
    if (blockers.length > 0) {
      setError(blockers[0]);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await submitSetup();
      router.push("/implementation/thanks");
    } catch {
      setError("We could not save your setup. Check your connection and try again.");
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="intro">
        <h1>Ready to start</h1>
        <p>This is everything you&apos;re sending us. Change anything that isn&apos;t right.</p>
      </div>
      <div className="card">
        <Group title="Property" onEdit={() => router.push("/implementation/property?from=review")}>
          <Row label="Property" value={snap.property} />
          {snap.country ? <Row label="Country" value={snap.country} /> : null}
          {snap.organisation ? <Row label="Hotel brand" value={snap.organisation} /> : null}
        </Group>
        <Group title="Contacts" onEdit={() => router.push("/implementation/contacts?from=review")}>
          <Row
            label="You"
            value={
              <>
                {snap.primaryName}
                <br />
                <span style={{ fontWeight: 500, color: "var(--mut)" }}>{snap.primaryEmail}</span>
              </>
            }
          />
          <Row
            label="PMS access"
            value={
              <>
                {snap.pmsContactName}
                <br />
                <span style={{ fontWeight: 500, color: "var(--mut)" }}>{snap.pmsContactEmail}</span>
                {sameContact ? <span className="un"> · same as you</span> : null}
              </>
            }
          />
        </Group>
        <Group title="PMS" onEdit={() => router.push("/implementation/pms?from=review")}>
          <Row
            label="System"
            value={
              <>
                {snap.pms}
                {pms?.vendor ? <span className="un"> · {pms.vendor}</span> : null}
              </>
            }
          />
          {hosting ? <Row label="Hosting" value={<span className="un">{hosting}</span>} /> : null}
          <Row
            label="Property / Hotel ID"
            value={snap.hotelId || <span className="un">We’ll confirm this</span>}
          />
          {isOperaCloudFamily(state) ? (
            <Row
              label="OHIP Enterprise ID"
              value={snap.enterpriseId || <span className="un">We’ll confirm this</span>}
            />
          ) : null}
          {snap.accessMethod ? <Row label="Access method" value={snap.accessMethod} /> : null}
        </Group>
      </div>
      <div style={{ marginTop: 18 }}>
        <button type="button" className="btn pri lg" disabled={busy} onClick={() => void onSubmit()}>
          Start BookMax implementation
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        {error ? (
          <div className="err" role="alert">
            {error}
          </div>
        ) : null}
      </div>
      <div className="nav">
        <button type="button" className="btn" onClick={() => router.push("/implementation/pms")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <span />
      </div>
    </div>
  );
}

function Group({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rgrp">
      <div className="rgh">
        <span className="rgt">{title}</span>
        <button type="button" className="btn sm" onClick={onEdit}>
          Change
        </button>
      </div>
      <div className="rv">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="rvr">
      <span className="rk">{label}</span>
      <span className="rvv">{value}</span>
    </span>
  );
}
