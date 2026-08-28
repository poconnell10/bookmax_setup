"use client";

import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { credentialLabel } from "@/lib/implementation/selectors";

export function ThanksView() {
  const router = useRouter();
  const { state } = useIntake();
  const label = credentialLabel(state);
  const pending = state.credentialsStatus !== "received" && Boolean(label);

  return (
    <div className="thx">
      <div className="thxi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="24" height="24">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h1>Thank you</h1>
      <p className="thxm">Your BookMax implementation setup has been submitted.</p>
      <p className="thxs">
        We will review the information provided and contact you if anything further is required. You will then receive the next steps for your BookMax implementation.
      </p>
      <div className="subcard" style={{ marginTop: 22, textAlign: "left" }}>
        <div className="srow">
          <span className="sk2">Implementation Setup</span>
          <span className="bd ok">Submitted</span>
        </div>
        <div className="srow">
          <span className="sk2">Connection Details</span>
          <span className="bd ok">Submitted</span>
        </div>
        {label ? (
          <div className="srow">
            <span className="sk2">{label}</span>
            <span className={`bd ${state.credentialsStatus === "received" ? "ok" : "part"}`}>
              {state.credentialsStatus === "received" ? "Received" : "Pending"}
            </span>
          </div>
        ) : null}
        {state.submittedAt ? (
          <div className="sfine" style={{ marginTop: 12 }}>
            Submitted {state.submittedAt}
          </div>
        ) : null}
        {pending ? (
          <div className="sfine">You can return to provide your credentials when they are available.</div>
        ) : null}
      </div>
      {pending ? (
        <button
          type="button"
          className="btn pri"
          style={{ marginTop: 18 }}
          onClick={() => router.push("/implementation/connect")}
        >
          Provide {label}
        </button>
      ) : null}
    </div>
  );
}
