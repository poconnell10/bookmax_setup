"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CredentialLabel } from "@/types/implementation";

type Revealed = {
  credentialType: CredentialLabel;
  receivedAt: string;
  clientId: string;
  clientSecret: string;
  applicationKey: string;
};

export function SecureCredentialsPanel({
  submissionId,
  organisation,
  credentialType,
  receivedAt,
}: {
  submissionId: string;
  organisation: string;
  credentialType: CredentialLabel | null;
  receivedAt: string | null;
}) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      setRevealed(null);
    };
  }, []);

  async function onReveal() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/implementation/submissions/${submissionId}/credentials`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setError("Credentials could not be revealed.");
        return;
      }
      const payload = (await response.json()) as Revealed;
      setRevealed({
        credentialType: payload.credentialType,
        receivedAt: payload.receivedAt,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret,
        applicationKey: payload.applicationKey,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="step">
      <div className="rhead">
        <div style={{ minWidth: 0 }}>
          <h2>Credentials received</h2>
          <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 3 }}>{organisation}</div>
          <span className="id">{submissionId}</span>
        </div>
        <div className="ract">
          <Link
            href={`/implementation/submissions/${submissionId}`}
            className="btn sm"
            onClick={() => setRevealed(null)}
          >
            Back to submission
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <span className="t">Authorized retrieval</span>
        </div>
        <div className="cb">
          <div className="sgrid">
            <div className="srow">
              <span className="sk2">Credentials</span>
              <span className="sv2">Received</span>
            </div>
            <div className="srow">
              <span className="sk2">Received at</span>
              <span className="sv2">{receivedAt || "—"}</span>
            </div>
            <div className="srow">
              <span className="sk2">Credential type</span>
              <span className="sv2">{credentialType || "—"}</span>
            </div>
          </div>
          <div className="secnote">
            <span>
              These credentials are restricted to authorized implementation engineers. Revealing them
              decrypts the stored envelope on the server and creates an audit record. Values are not
              stored in the Submission Log.
            </span>
          </div>
          {error ? (
            <div className="sfine" role="alert" style={{ marginTop: 12, color: "var(--red)" }}>
              {error}
            </div>
          ) : null}
          {revealed ? (
            <>
              <div className="sgrid" style={{ marginTop: 16 }}>
                <div className="srow">
                  <span className="sk2">Client ID</span>
                  <span className="sv2">{revealed.clientId}</span>
                </div>
                <div className="srow">
                  <span className="sk2">Client secret</span>
                  <span className="sv2">{revealed.clientSecret}</span>
                </div>
                <div className="srow">
                  <span className="sk2">Application key</span>
                  <span className="sv2">{revealed.applicationKey || "—"}</span>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn sm" onClick={() => setRevealed(null)}>
                  Hide credentials
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 16 }}>
              <button type="button" className="btn pri" disabled={busy} onClick={() => void onReveal()}>
                {busy ? "Revealing…" : "Reveal credentials"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
