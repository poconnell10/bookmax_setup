"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

export function PropertySavedScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/setup/property");
        if (response.status === 401 || response.status === 403) {
          router.replace("/access");
          return;
        }
        const payload = (await response.json()) as {
          ok?: boolean;
          email?: string;
          property?: CustomerProperty | null;
        };
        if (!response.ok || !payload.ok) {
          router.replace("/access");
          return;
        }
        if (cancelled) {
          return;
        }
        setEmail(payload.email || "");
        setPropertyName(payload.property?.name || "");
        if (!payload.property) {
          router.replace("/setup/property");
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

  if (loading) {
    return (
      <SetupShell email={email}>
        <p className="sub">Loading…</p>
      </SetupShell>
    );
  }

  return (
    <SetupShell email={email} saved>
      <div className="donecard">
        <div className="dni" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1>Property saved</h1>
        <p className="dm">
          We&apos;ve saved the details for <b>{propertyName || "your property"}</b>.
          <br />
          <br />
          You can return to this site anytime, enter the same work email, and continue this
          implementation. Further setup steps will be available in a later milestone.
        </p>
        <div className="dn">Your property has been saved.</div>
        <button
          type="button"
          className="btn link"
          style={{ marginTop: 22 }}
          onClick={() => router.push("/setup/property")}
        >
          Review property details
        </button>
      </div>
    </SetupShell>
  );
}
