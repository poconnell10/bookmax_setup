"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthSplitLayout } from "@/components/access/AuthSplitLayout";
import { OtpDigitInputs } from "@/components/access/OtpDigitInputs";
import {
  isCompleteOtp,
  OTP_INVALID_ERROR,
  OTP_NETWORK_ERROR,
  OTP_RESENT_MESSAGE,
  OTP_SEND_ERROR,
} from "@/lib/access/otp";

export function OtpVerifyScreen() {
  const router = useRouter();
  const [emailMasked, setEmailMasked] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/access/otp/pending");
        const payload = (await response.json()) as { ok?: boolean; emailMasked?: string };
        if (!response.ok || !payload.ok || !payload.emailMasked) {
          router.replace("/access?continue=1");
          return;
        }
        if (!cancelled) {
          setEmailMasked(payload.emailMasked);
        }
      } catch {
        router.replace("/access?continue=1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verifyCode(next: string) {
    if (busy || !isCompleteOtp(next)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: next }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; resumePath?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || OTP_INVALID_ERROR);
        return;
      }
      router.push(payload.resumePath || "/access/pending");
    } catch {
      setError(OTP_NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCompleteOtp(code)) {
      setError(OTP_INVALID_ERROR);
      return;
    }
    void verifyCode(code);
  }

  async function resend() {
    if (resending || busy || cooldown > 0) {
      return;
    }
    setResending(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/access/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || OTP_SEND_ERROR);
        return;
      }
      setInfo(OTP_RESENT_MESSAGE);
      setCooldown(20);
    } catch {
      setError(OTP_SEND_ERROR);
    } finally {
      setResending(false);
    }
  }

  async function changeEmail() {
    if (busy || resending) {
      return;
    }
    try {
      await fetch("/api/access/otp/pending", { method: "DELETE" });
    } catch {
      // continue even if the cookie clear request fails
    }
    setCode("");
    router.push("/access");
  }

  return (
    <AuthSplitLayout>
      <h1>Check your email</h1>
      <p className="sub">
        Enter the 6-digit verification code we sent to{" "}
        <b>{emailMasked || "your work email"}</b>
      </p>
      <form className="card" onSubmit={onSubmit}>
        <div className={`f${error ? " iserr" : ""}`}>
          <label htmlFor="otp-digit-0">Verification code</label>
          <OtpDigitInputs
            id="otp-digit-0"
            value={code}
            error={Boolean(error)}
            disabled={busy}
            onChange={(next) => {
              setCode(next);
              setError("");
            }}
          />
          {error ? (
            <div className="err" id="otp-error" role="alert">
              {error}
            </div>
          ) : null}
          {info ? (
            <p className="ok" role="status">
              {info}
            </p>
          ) : null}
        </div>
        <button className="btn pri" type="submit" disabled={busy || !isCompleteOtp(code)}>
          {busy ? "Verifying…" : "Continue"}
        </button>
      </form>
      <p className="foot foot-actions">
        <button
          type="button"
          className="btn ln"
          disabled={busy || resending || cooldown > 0}
          onClick={() => {
            void resend();
          }}
        >
          {resending ? "Sending…" : cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
        </button>
        <button
          type="button"
          className="btn ln"
          disabled={busy || resending}
          onClick={() => {
            void changeEmail();
          }}
        >
          Use a different email
        </button>
      </p>
    </AuthSplitLayout>
  );
}
