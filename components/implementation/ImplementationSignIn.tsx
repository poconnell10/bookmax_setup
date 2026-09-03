"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/implementation/BrandMark";
import { useIntake } from "@/components/intake/IntakeProvider";
import { SuccessScreen } from "@/components/setup/SuccessScreen";
import { KNOWN_CUSTOMER, maskEmail } from "@/lib/implementation/selectors";
import type { InvitationPublicView } from "@/lib/implementation/invitation/types";
import type { IntakeState } from "@/types/implementation";

const OTP_LENGTH = 6;

export function normalizeOtp(value: string, length = OTP_LENGTH): string {
  return value.replace(/\D/g, "").slice(0, length);
}

const SIGN_IN_STEPS = [
  ["Access", "Set up or sign in"],
  ["Property & PMS", "About two minutes"],
  ["Connect", "Who owns PMS access"],
  ["Discovery", "We read your configuration"],
  ["Setup & validation", "Your decisions, then we verify"],
] as const;

type ImplementationSignInProps = {
  invitation?: InvitationPublicView | null;
};

export function ImplementationSignIn({ invitation = null }: ImplementationSignInProps) {
  const router = useRouter();
  const { state, patch, notify } = useIntake();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Enter the 6-digit code from your email.");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoSendRef = useRef(false);
  const email = invitation?.invitedEmail || state.contactEmail || KNOWN_CUSTOMER.contactEmail;

  useEffect(() => {
    if (state.submitted) {
      router.replace("/implementation/thanks");
    }
  }, [router, state.submitted]);

  useEffect(() => {
    if (!invitation || autoSendRef.current) {
      return;
    }
    autoSendRef.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/implementation/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const payload = (await response.json()) as { ok?: boolean };
        if (response.ok && payload.ok) {
          setSent(true);
        }
      } catch {
        // Quiet auto-send; user can resend manually.
      }
    })();
  }, [invitation]);

  async function sendCode(options?: { quiet?: boolean }) {
    try {
      const response = await fetch("/api/implementation/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        throttled?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        if (!options?.quiet) {
          setError(true);
          setErrorMessage(payload.error || "Could not send a verification code.");
        }
        return false;
      }
      setSent(true);
      if (!options?.quiet && !payload.throttled) {
        notify("A new code is on its way.");
      }
      return true;
    } catch {
      if (!options?.quiet) {
        setError(true);
        setErrorMessage("Could not send a verification code.");
      }
      return false;
    }
  }

  async function verifyCode(next: string) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/implementation/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: next }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        intakePatch?: Partial<IntakeState>;
      };

      if (!response.ok || !payload.ok) {
        setError(true);
        setErrorMessage(payload.error || "Enter the 6-digit code from your email.");
        return;
      }

      patch({
        accessVerified: true,
        contactEmail: email,
        contactName:
          invitation?.contactName || state.contactName || KNOWN_CUSTOMER.contactName,
        ...(payload.intakePatch || {}),
      });
      try {
        window.sessionStorage.setItem("bookmax.accessVerified", "1");
      } catch {
        // ignore
      }
      router.push("/implementation/property");
    } catch {
      setError(true);
      setErrorMessage("Enter the 6-digit code from your email.");
    } finally {
      setBusy(false);
    }
  }

  function onCodeChange(value: string) {
    setCode(normalizeOtp(value));
    setError(false);
  }

  function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const field = event.currentTarget.elements.namedItem("otp");
    const next = field instanceof HTMLInputElement ? normalizeOtp(field.value) : normalizeOtp(code);
    setCode(next);
    if (next.length !== OTP_LENGTH) {
      setError(true);
      setErrorMessage("Enter the 6-digit code from your email.");
      return;
    }
    void verifyCode(next);
  }

  if (state.submitted) {
    return (
      <div className="bmx-setup">
        <SuccessScreen />
      </div>
    );
  }

  const activeIndex = Math.min(code.length, OTP_LENGTH - 1);

  return (
    <div className="bmx-auth">
      <aside className="brandside">
        <div className="bmark">
          <BrandMark />
          <span className="wm">traqra</span>
          <span className="pd">BookMax</span>
        </div>
        <div className="bpitch">
          <h2>Your BookMax implementation, in five steps.</h2>
          <p>
            You will not be asked to re-type configuration we can read from your PMS. Tell us how to
            reach it, and we take it from there.
          </p>
          <div className="bsteps">
            {SIGN_IN_STEPS.map(([title, detail], index) => (
              <span key={title} className={`bs${index === 0 ? " on" : ""}`}>
                <span className="bn">{index + 1}</span>
                <span className="bt">
                  <b>{title}</b>
                  {detail}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="bfoot">
          <a href="#privacy">Privacy</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact implementation</a>
        </div>
      </aside>
      <main className="formside">
        <div className="shell">
          <div className="mobmark">
            <BrandMark />
            <span className="wm">
              traqra <span style={{ color: "var(--mut-2)", fontWeight: 500 }}>BookMax</span>
            </span>
          </div>
          <section className="view on">
            <h1>Sign in to continue</h1>
            <p className="sub">
              Enter the verification code we sent to <b>{maskEmail(email)}</b> to start your
              implementation.
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
                    disabled={busy}
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
                {error ? <div className="err">{errorMessage}</div> : null}
              </div>
              <button className="btn pri" type="submit" disabled={busy}>
                Continue
              </button>
            </form>
            <p className="foot">
              <button
                type="button"
                className="btn ln"
                disabled={busy}
                onClick={() => {
                  void sendCode();
                }}
              >
                Send a new code
              </button>
            </p>
            <p className="legal">
              Wrong email? Contact your implementation team.
              {sent ? " We sent another code to the address on your invitation." : ""}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
