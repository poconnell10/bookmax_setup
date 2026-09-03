"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { fetchSetupContext } from "@/lib/setup/client";
import { ownerName, type SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

export function ThanksSetupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState<CustomerProperty | null>(null);
  const [intake, setIntake] = useState<SetupIntakePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

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

  const contact = intake ? ownerName(intake, property) : "";

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
          We&apos;ve received the information for <b>{property?.name || "your property"}</b>.
          <br />
          <br />
          Our implementation team can now begin your BookMax setup. If we need anything else to
          establish PMS access, we&apos;ll contact <b>{contact || "your PMS contact"}</b> directly.
        </p>
        <div className="dn">No further action is required right now.</div>
      </div>
    </SetupShell>
  );
}
