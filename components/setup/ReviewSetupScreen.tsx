"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { fetchSetupContext } from "@/lib/setup/client";
import {
  accessMethodLabel,
  isSetupOhipPms,
  needsConnectionRoute,
  ownerEmail,
  ownerName,
  pmsDisplayName,
  submitBlockers,
  type SetupIntakePayload,
} from "@/lib/setup/intake";
import { findSetupPms, hostLabel, isSetupCloudPms } from "@/lib/setup/pms-catalogue";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

export function ReviewSetupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState<CustomerProperty | null>(null);
  const [intake, setIntake] = useState<SetupIntakePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialsReceived, setCredentialsReceived] = useState(false);
  const submitting = useRef(false);

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
        if (!payload.property || !payload.intake?.pmsId) {
          router.replace(payload.resumePath || "/setup/property");
          return;
        }
        setEmail(payload.email || "");
        setProperty(payload.property);
        setIntake(payload.intake);
        if (isSetupCloudPms(payload.intake.pmsId)) {
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

  async function onSubmit() {
    if (!intake || !property || submitting.current) {
      return;
    }
    const blockers = submitBlockers(intake, property, email);
    if (blockers.length > 0) {
      setError(blockers[0]);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/setup/submit", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "We could not submit your setup. Try again.");
        submitting.current = false;
        setBusy(false);
        return;
      }
      router.push("/setup/thanks");
    } catch {
      setError("We could not submit your setup. Check your connection and try again.");
      submitting.current = false;
      setBusy(false);
    }
  }

  if (loading || !intake || !property) {
    return (
      <SetupShell email={email}>
        <p className="sub">Loading…</p>
      </SetupShell>
    );
  }

  const pms = findSetupPms(intake.pmsId);
  const hotelId = intake.hotelId || intake.propertyCode;
  const unconfirmed = <span className="un">We&apos;ll confirm this</span>;
  const pmsOwner = ownerName(intake, property);
  const pmsOwnerEmail = ownerEmail(intake, email);

  return (
    <SetupShell email={email} saved property={property} intake={intake}>
      <div className="intro">
        <h1>Ready to start</h1>
        <p>This is everything you&apos;re sending us. Change anything that isn&apos;t right.</p>
      </div>
      <div className="card">
        <Group title="Property" changeWhat="property details" onEdit={() => router.push("/setup/property")}>
          <Row label="Property" value={property.name} />
          {property.hotelBrand ? <Row label="Hotel brand" value={property.hotelBrand} /> : null}
        </Group>
        <Group title="People" changeWhat="contact details" onEdit={() => router.push("/setup/property")}>
          {intake.sameAsPrimaryContact ? (
            <Row
              label={
                <>
                  You <span className="un">· and PMS access</span>
                </>
              }
              value={
                <>
                  {property.contactName}
                  <br />
                  <span style={{ fontWeight: 500, color: "var(--mut)" }}>{email}</span>
                </>
              }
            />
          ) : (
            <>
              <Row
                label="You"
                value={
                  <>
                    {property.contactName}
                    <br />
                    <span style={{ fontWeight: 500, color: "var(--mut)" }}>{email}</span>
                  </>
                }
              />
              <Row
                label="PMS access"
                value={
                  <>
                    {pmsOwner}
                    <br />
                    <span style={{ fontWeight: 500, color: "var(--mut)" }}>{pmsOwnerEmail}</span>
                  </>
                }
              />
            </>
          )}
        </Group>
        <Group title="PMS" changeWhat="your PMS" onEdit={() => router.push("/setup/pms")}>
          <Row
            label="System"
            value={
              <>
                {pmsDisplayName(intake)}
                {pms?.vendor ? <span className="un"> · {pms.vendor}</span> : null}
              </>
            }
          />
          <Row label="Hosting" value={<span className="un">{hostLabel(pms)}</span>} />
        </Group>
        <Group title="Access" changeWhat="access details" onEdit={() => router.push("/setup/connect")}>
          <Row label="Property code" value={hotelId || unconfirmed} />
          {isSetupOhipPms(intake.pmsId) ? (
            <Row label="OHIP enterprise ID" value={intake.enterpriseId || unconfirmed} />
          ) : null}
          {needsConnectionRoute(intake.pmsId) ? (
            <Row
              label="Data connection"
              value={accessMethodLabel(intake.pmsAccessMethod) || unconfirmed}
            />
          ) : null}
          {intake.pmsAccessMethod === "api" && intake.apiUrl ? (
            <Row label="API address" value={intake.apiUrl} />
          ) : null}
          {intake.pmsAccessMethod === "sftp" && intake.sftpHost ? (
            <Row label="SFTP host" value={intake.sftpHost} />
          ) : null}
          {isSetupCloudPms(intake.pmsId) ? (
            <Row
              label="Credentials"
              value={
                <span className="un">
                  {credentialsReceived ? "Received securely" : "We'll request these securely"}
                </span>
              }
            />
          ) : null}
        </Group>
      </div>
      <p className="whatnext">
        Submitting sends this to our implementation team. Nothing goes live yet — we&apos;ll contact you
        if anything is missing.
      </p>
      <div style={{ marginTop: 14 }}>
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
        <button type="button" className="btn" onClick={() => router.push("/setup/connect")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <span />
      </div>
    </SetupShell>
  );
}

function Group({
  title,
  changeWhat,
  onEdit,
  children,
}: {
  title: string;
  changeWhat: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rgrp">
      <div className="rgh">
        <span className="rgt">{title}</span>
        <button type="button" className="btn sm" aria-label={`Change ${changeWhat}`} onClick={onEdit}>
          Change
        </button>
      </div>
      <div className="rv">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <span className="rvr">
      <span className="rk">{label}</span>
      <span className="rvv">{value}</span>
    </span>
  );
}
