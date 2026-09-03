"use client";

import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { createInitialIntakeState } from "@/lib/implementation/selectors";

export function SuccessScreen() {
  const router = useRouter();
  const { state, patch } = useIntake();
  const property = state.properties[0]?.trim();
  const owner = (state.samePmsContact ? state.contactName : state.technicalContact).trim();

  function restart() {
    try {
      window.localStorage.removeItem("bookmax.submitted");
      window.sessionStorage.removeItem("bookmax.draftId");
      window.sessionStorage.removeItem("bookmax.accessVerified");
    } catch {
      // ignore
    }
    patch(createInitialIntakeState());
    router.push("/implementation/property");
  }

  return (
    <div className="donecard">
      <div className="dni" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h1>You&apos;re all set.</h1>
      <p className="dm">
        We&apos;ve received the information for <b>{property || "your property"}</b>.
        <br />
        <br />
        Our implementation team can now begin your BookMax setup. If we need anything else to
        establish PMS access, we&apos;ll contact <b>{owner || "your PMS contact"}</b> directly.
      </p>
      <div className="dn">No further action is required right now.</div>
      <button type="button" className="btn link" style={{ marginTop: 22 }} onClick={restart}>
        Set up another property
      </button>
    </div>
  );
}
