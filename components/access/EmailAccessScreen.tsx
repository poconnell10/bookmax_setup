"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthSplitLayout } from "@/components/access/AuthSplitLayout";
import { EMAIL_VALIDATION_ERROR, isValidEmail, normalizeEmail } from "@/lib/access/email";
import { OTP_SEND_ERROR } from "@/lib/access/otp";

export function EmailAccessScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resumeHint = searchParams.get("continue") === "1";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const next = normalizeEmail(email);
    if (!isValidEmail(next)) {
      setError(EMAIL_VALIDATION_ERROR);
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || OTP_SEND_ERROR);
        return;
      }
      router.push("/access/verify");
    } catch {
      setError(OTP_SEND_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h1>Start your BookMax implementation</h1>
      <p className="sub">
        Enter your email address to get started. We&apos;ll send you a verification code.
      </p>
      {resumeHint ? (
        <p className="note" role="status">
          Enter your work email again to continue verification.
        </p>
      ) : null}
      <form className="card" onSubmit={onSubmit} noValidate>
        <div className={`f${error ? " iserr" : ""}`}>
          <label htmlFor="work-email">EMAIL ADDRESS</label>
          <input
            ref={inputRef}
            id="work-email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@company.com"
            value={email}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "work-email-error" : undefined}
            className={error ? "bad" : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
          />
          {error ? (
            <div className="err" id="work-email-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        <button className="btn pri" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send verification code"}
        </button>
      </form>
      <p className="legal">
        Already started your implementation? Enter the same email address to continue.
      </p>
    </AuthSplitLayout>
  );
}
