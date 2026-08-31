"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { contactsStepComplete, looksLikeEmail } from "@/lib/implementation/selectors";

export function ContactsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, patch } = useIntake();
  const [error, setError] = useState(false);
  const fromReview = searchParams.get("from") === "review";

  function onContinue() {
    if (!contactsStepComplete(state)) {
      setError(true);
      return;
    }
    router.push(fromReview ? "/implementation/review" : "/implementation/pms");
  }

  return (
    <section className="view on">
      <h1>Who should we work with?</h1>
      <p className="sub">Tell us who to contact so we can start your BookMax implementation.</p>
      <div className="card">
        <div className="gk" style={{ marginTop: 0 }}>
          Primary contact
        </div>
        <p className="hint-copy">This is the main contact for your BookMax implementation.</p>
        <div className={`f${error && !state.contactName.trim() ? " iserr" : ""}`}>
          <label htmlFor="primary-name">Name</label>
          <input
            id="primary-name"
            value={state.contactName}
            onChange={(event) => {
              const name = event.target.value;
              if (state.samePmsContact) {
                patch({ contactName: name, technicalContact: name });
              } else {
                patch({ contactName: name });
              }
            }}
          />
        </div>
        <div className={`f${error && !looksLikeEmail(state.contactEmail) ? " iserr" : ""}`}>
          <label htmlFor="primary-email">Work email</label>
          <input
            id="primary-email"
            type="email"
            value={state.contactEmail}
            onChange={(event) => {
              const email = event.target.value;
              if (state.samePmsContact) {
                patch({ contactEmail: email, technicalContactEmail: email });
              } else {
                patch({ contactEmail: email });
              }
            }}
          />
          {error && !looksLikeEmail(state.contactEmail) ? (
            <div className="err">Enter a work email.</div>
          ) : null}
        </div>

        <div className="gk">Who should we contact about PMS access?</div>
        <button
          type="button"
          className={`cbx${state.samePmsContact ? " on" : ""}`}
          aria-pressed={state.samePmsContact}
          onClick={() => {
            const next = !state.samePmsContact;
            patch({
              samePmsContact: next,
              ...(next
                ? {
                    technicalContact: state.contactName,
                    technicalContactEmail: state.contactEmail,
                  }
                : {}),
            });
          }}
        >
          <span className="bx" />
          <span>I am also the PMS access contact</span>
        </button>

        {state.samePmsContact ? null : (
          <>
            <div className={`f${error && !state.technicalContact.trim() ? " iserr" : ""}`}>
              <label htmlFor="pms-contact-name">Name</label>
              <input
                id="pms-contact-name"
                value={state.technicalContact}
                onChange={(event) => patch({ technicalContact: event.target.value })}
              />
            </div>
            <div className={`f${error && !looksLikeEmail(state.technicalContactEmail) ? " iserr" : ""}`}>
              <label htmlFor="pms-contact-email">Work email</label>
              <input
                id="pms-contact-email"
                type="email"
                value={state.technicalContactEmail}
                onChange={(event) => patch({ technicalContactEmail: event.target.value })}
              />
              {error && !looksLikeEmail(state.technicalContactEmail) ? (
                <div className="err">Enter a work email.</div>
              ) : null}
            </div>
          </>
        )}

        <div className="navbar" style={{ marginTop: 18 }}>
          <button type="button" className="btn" onClick={() => router.push("/implementation/property")}>
            Back
          </button>
          <button type="button" className="btn pri" style={{ marginTop: 0, width: "auto" }} onClick={onContinue}>
            Continue to PMS
          </button>
        </div>
      </div>
    </section>
  );
}
