"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { contactsStepComplete, looksLikeEmail } from "@/lib/implementation/selectors";

export function ContactsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, patch, saveDraft } = useIntake();
  const [error, setError] = useState(false);
  const fromReview = searchParams.get("from") === "review";
  const ready = contactsStepComplete(state);

  async function onContinue() {
    if (!ready) {
      setError(true);
      return;
    }
    try {
      await saveDraft();
    } catch {
      // best-effort
    }
    router.push(fromReview ? "/implementation/review" : "/implementation/pms");
  }

  return (
    <div>
      <div className="intro">
        <h1>Who should we work with?</h1>
        <p>Tell us who to contact so we can start your BookMax implementation.</p>
      </div>

      <div className="card">
        <div className="sec">
          <div className="sq">Primary contact</div>
          <div className="sh">This is the main contact for your BookMax implementation.</div>
          <div className="two">
            <div className={`f${error && !state.contactName.trim() ? " iserr" : ""}`}>
              <label htmlFor="primary-name">
                Name<span className="rq">*</span>
              </label>
              <input
                id="primary-name"
                value={state.contactName}
                onChange={(event) => {
                  const name = event.target.value;
                  patch(
                    state.samePmsContact
                      ? { contactName: name, technicalContact: name }
                      : { contactName: name },
                  );
                }}
              />
            </div>
            <div className={`f${error && !looksLikeEmail(state.contactEmail) ? " iserr" : ""}`}>
              <label htmlFor="primary-email">
                Work email<span className="rq">*</span>
              </label>
              <input
                id="primary-email"
                type="email"
                value={state.contactEmail}
                onChange={(event) => {
                  const email = event.target.value;
                  patch(
                    state.samePmsContact
                      ? { contactEmail: email, technicalContactEmail: email }
                      : { contactEmail: email },
                  );
                }}
              />
              {error && !looksLikeEmail(state.contactEmail) ? (
                <div className="err">Enter a work email.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sec">
          <div className="sq">Who should we contact about PMS access?</div>
          <div className="sh">
            Often someone in IT or your PMS provider. We go to them directly, so you don&apos;t have
            to relay anything technical.
          </div>
          <button
            type="button"
            className={`cb${state.samePmsContact ? " on" : ""}`}
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
            <span className="cbx">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="cbl">I am also the PMS access contact</span>
          </button>
          {state.samePmsContact ? null : (
            <div style={{ marginTop: 13 }}>
              <div className="two">
                <div className={`f${error && !state.technicalContact.trim() ? " iserr" : ""}`}>
                  <label htmlFor="pms-contact-name">
                    Name<span className="rq">*</span>
                  </label>
                  <input
                    id="pms-contact-name"
                    placeholder="e.g. Maria Rossi"
                    value={state.technicalContact}
                    onChange={(event) => patch({ technicalContact: event.target.value })}
                  />
                </div>
                <div
                  className={`f${error && !looksLikeEmail(state.technicalContactEmail) ? " iserr" : ""}`}
                >
                  <label htmlFor="pms-contact-email">
                    Work email<span className="rq">*</span>
                  </label>
                  <input
                    id="pms-contact-email"
                    type="email"
                    placeholder="maria.rossi@grittipalace.com"
                    value={state.technicalContactEmail}
                    onChange={(event) => patch({ technicalContactEmail: event.target.value })}
                  />
                  {error && !looksLikeEmail(state.technicalContactEmail) ? (
                    <div className="err">Enter a work email.</div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="nav">
        <button type="button" className="btn" onClick={() => router.push("/implementation/property")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <button type="button" className="btn pri" disabled={!ready} onClick={() => void onContinue()}>
          Continue
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
