"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { reviewSnapshot, submitBlockers } from "@/lib/implementation/selectors";

export function ReviewScreen() {
  const router = useRouter();
  const { state, submitSetup } = useIntake();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const snap = reviewSnapshot(state);
  const primaryContact = [snap.primaryName, snap.primaryEmail].filter(Boolean).join(" · ");
  const pmsContact = [snap.pmsContactName, snap.pmsContactEmail].filter(Boolean).join(" · ");

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
    <section className="view on">
      <h1>Review your BookMax setup</h1>
      <p className="sub">
        Check the details below. You can change anything before sending it to our implementation team.
      </p>
      <div className="card">
        <Section
          title="Property"
          href="/implementation/property?from=review"
          rows={[
            ["Property", snap.property],
            ["Country", snap.country],
            snap.organisation ? ["Hotel group", snap.organisation] : null,
          ]}
        />
        <Section
          title="Contacts"
          href="/implementation/contacts?from=review"
          rows={[
            ["Primary contact", primaryContact],
            ["PMS access contact", pmsContact],
          ]}
        />
        <Section
          title="PMS"
          href="/implementation/pms?from=review"
          rows={[
            ["PMS", snap.pms],
            snap.hosting ? ["Hosting", snap.hosting] : null,
            snap.hotelId ? ["Property / Hotel ID", snap.hotelId] : null,
            snap.enterpriseId ? ["OHIP Enterprise ID", snap.enterpriseId] : null,
            snap.accessMethod ? ["Access method", snap.accessMethod] : null,
          ]}
        />
        <button
          type="button"
          className="btn pri"
          disabled={busy}
          onClick={() => void onSubmit()}
        >
          Start BookMax Implementation
        </button>
        {error ? (
          <div className="err" role="alert" style={{ display: "flex", marginTop: 12 }}>
            {error}
          </div>
        ) : null}
        <button type="button" className="btn gh" onClick={() => router.push("/implementation/pms")}>
          Back
        </button>
      </div>
    </section>
  );
}

function Section({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: Array<[string, string] | null>;
}) {
  const router = useRouter();
  const visible = rows.filter((row): row is [string, string] => Boolean(row && row[1]));

  return (
    <div className="grp">
      <div className="sechd">
        <span className="gk" style={{ margin: 0 }}>
          {title}
        </span>
        <button type="button" className="btn sm" onClick={() => router.push(href)}>
          Edit
        </button>
      </div>
      <div className="subcard" style={{ marginTop: 2 }}>
        {visible.map(([key, value]) => (
          <div key={key} className="srow">
            <span className="sk2">{key}</span>
            <span className="sv2">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
