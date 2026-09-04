"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { fetchSetupContext } from "@/lib/setup/client";
import { ownerName, type SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerProperty } from "@/lib/implementation/customer/types";
import { createClient } from "@/lib/supabase/client";

export function ThanksSetupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState<CustomerProperty | null>(null);
  const [intake, setIntake] = useState<SetupIntakePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);

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
        if (!payload.submission) {
          router.replace(payload.resumePath || "/setup/property");
          return;
        }
        setEmail(payload.email || "");
        setProperty(payload.property || null);
        setIntake(payload.intake || null);
        setReady(true);
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

  if (loading || !ready) {
    return (
      <SetupShell email={email}>
        <p className="sub">Loading…</p>
      </SetupShell>
    );
  }

  const propertyName = property?.name?.trim() || "";
  const technicalContactName = intake ? ownerName(intake, property) : "";

  async function onExit() {
    if (exiting) {
      return;
    }
    setExiting(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/access");
    }
  }

  return (
    <SetupShell email={email} property={property} intake={intake || undefined} submitted>
      <div className="donecard">
        <div className="dni" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1>You&apos;re all set.</h1>
        <p className="dm">
          Thank you for completing the initial setup details for <b>{propertyName}</b>.
        </p>
        <p className="dm">
          Our engineering and integration teams are now moving into the execution phase of your{" "}
          <b>BookMax</b> implementation.
        </p>
        <p className="dm">
          <b>Connection &amp; Systems Testing</b>
          <br />
          We&apos;ll validate the connection and integration configuration to ensure data is flowing
          correctly.
        </p>
        <p className="dm">
          <b>PMS Access &amp; Deployment</b>
          <br />
          Our implementation engineering team will begin configuring and deploying BookMax for your
          property.
        </p>
        <div className="dn">No further action is required from you at this time.</div>
        <p className="dm">
          If we require any additional PMS access or technical information, our team will contact{" "}
          <b>{technicalContactName}</b> directly.
        </p>
        <p className="dm">
          We appreciate your partnership and look forward to getting <b>{propertyName}</b> live on
          BookMax.
        </p>
        <p className="dm">
          <button type="button" className="btn" onClick={() => void onExit()} disabled={exiting}>
            Exit
          </button>
        </p>
      </div>
    </SetupShell>
  );
}
