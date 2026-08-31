"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/implementation/BrandMark";
import { useIntake } from "@/components/intake/IntakeProvider";
import { KNOWN_CUSTOMER, maskEmail } from "@/lib/implementation/selectors";

const OTP_LENGTH = 6;

export function normalizeOtp(value: string, length = OTP_LENGTH): string {
  return value.replace(/\D/g, "").slice(0, length);
}

export function ImplementationSignIn() {
  const router = useRouter();
  const { state, patch, notify, toastMessage } = useIntake();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const email = state.contactEmail || KNOWN_CUSTOMER.contactEmail;

  useEffect(() => {
    if (state.submitted) {
      router.replace("/implementation/thanks");
    }
  }, [router, state.submitted]);

  function goToSetup() {
    patch({
      accessVerified: true,
      contactEmail: email,
      contactName: state.contactName || KNOWN_CUSTOMER.contactName,
    });
    try {
      window.sessionStorage.setItem("bookmax.accessVerified", "1");
    } catch {
      // ignore
    }
    router.push("/implementation/property");
  }

  function onCodeChange(value: string) {
    setCode(normalizeOtp(value));
    setError(false);
  }

  function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("otp");
    const next = field instanceof HTMLInputElement ? normalizeOtp(field.value) : normalizeOtp(code);
    setCode(next);
    if (next.length !== OTP_LENGTH) {
      setError(true);
      return;
    }
    goToSetup();
  }

  if (state.submitted) {
    return (
      <AccessFrame>
        <div className="icon g" aria-hidden="true" />
        <h1>Thank you</h1>
        <p className="sub">Thank you — your setup details have been received.</p>
        <p className="sub">
          The BookMax Implementation team will contact you if anything else is required.
        </p>
      </AccessFrame>
    );
  }

  const activeIndex = Math.min(code.length, OTP_LENGTH - 1);

  return (
    <AccessFrame>
      <h1>Welcome to BookMax</h1>
      <p className="sub">
        Enter the verification code we sent to <b>{maskEmail(email)}</b> to start your implementation.
      </p>
      <form className="card" onSubmit={onContinue}>
        <div className={`f${error ? " iserr" : ""}`}>
          <label htmlFor="otp">Verification code</label>
          <div className="otp">
            <input
              id="otp"
              className="otp-control"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="otp"
              pattern="[0-9]*"
              maxLength={OTP_LENGTH}
              value={code}
              aria-label="Verification code"
              onChange={(event) => onCodeChange(event.target.value)}
              onInput={(event) => onCodeChange(event.currentTarget.value)}
            />
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <span
                key={index}
                className={`otp-box${error ? " bad" : ""}${index === activeIndex ? " on" : ""}`}
                aria-hidden="true"
              >
                {code[index] ?? ""}
              </span>
            ))}
          </div>
          {error ? <div className="err">Enter the 6-digit code from your email.</div> : null}
        </div>
        <button className="btn pri" type="submit">
          Continue
        </button>
      </form>
      <p className="foot">
        <button
          type="button"
          className="btn ln"
          onClick={() => {
            setSent(true);
            notify("A new code is on its way.");
          }}
        >
          Send a new code
        </button>
      </p>
      <p className="legal">
        Wrong email? Contact your implementation team.
        {sent ? " We sent another code to the address on your invitation." : ""}
      </p>
      <p className="legal">Microsoft sign-in will be available later for organisations that use it.</p>
      {toastMessage ? <div className="note">{toastMessage}</div> : null}
    </AccessFrame>
  );
}

function AccessFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bmx-auth">
      <aside className="brandside">
        <div className="bmark">
          <BrandMark />
          <span className="wm">BookMax</span>
          <span className="pd">Implementation</span>
        </div>
        <div className="bpitch">
          <h2>Start your BookMax implementation</h2>
          <p>
            BookMax is a pre-arrival upsell solution. We need a few basic details about your property
            and PMS so our implementation team can get started.
          </p>
          <p className="bpitch-note">Takes about 2 minutes.</p>
          <p className="bpitch-note">
            You will not be asked for configuration we can retrieve from your PMS.
          </p>
        </div>
        <div className="bfoot">
          <span>Privacy</span>
          <span>Security</span>
          <span>Contact implementation</span>
        </div>
      </aside>
      <main className="formside">
        <div className="shell">
          <div className="mobmark">
            <BrandMark />
            <span className="wm">BookMax Implementation</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
