"use client";

import { useIntake } from "@/components/intake/IntakeProvider";

export function SuccessScreen() {
  const { state } = useIntake();
  const property = state.properties[0];

  return (
    <section className="view on">
      <div className="icon g" aria-hidden="true" />
      <h1>Thank you</h1>
      <p className="sub">
        Thank you — your setup details have been received.
        {property ? ` We have the information for ${property}.` : ""}
      </p>
      <p className="sub">
        The BookMax Implementation team will contact you if anything else is required.
      </p>
      <div className="note">
        <b>No further action is required right now.</b> Our team owns the next step.
      </div>
    </section>
  );
}
