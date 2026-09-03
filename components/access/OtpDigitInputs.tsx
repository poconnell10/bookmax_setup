"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { OTP_LENGTH, normalizeOtp } from "@/lib/access/otp";

export function OtpDigitInputs({
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  error?: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? "");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function focusAt(index: number) {
    const next = Math.max(0, Math.min(OTP_LENGTH - 1, index));
    refs.current[next]?.focus();
    refs.current[next]?.select();
  }

  function applyDigits(next: string, focusIndex?: number) {
    const normalized = normalizeOtp(next);
    onChange(normalized);
    if (typeof focusIndex === "number") {
      focusAt(focusIndex);
      return;
    }
    focusAt(Math.min(normalized.length, OTP_LENGTH - 1));
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData?.getData("text") || event.clipboardData?.getData("text/plain") || "";
    if (!text) {
      return;
    }
    event.preventDefault();
    applyDigits(text, OTP_LENGTH - 1);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        applyDigits(value.slice(0, index) + value.slice(index + 1), index);
        return;
      }
      applyDigits(value.slice(0, Math.max(0, index - 1)), index - 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  return (
    <div className="otp" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          id={index === 0 ? id : undefined}
          className={`otp-box otp-digit${error ? " bad" : ""}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name={index === 0 ? "otp" : undefined}
          pattern="[0-9]*"
          maxLength={index === 0 ? OTP_LENGTH : 1}
          value={digit}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          disabled={disabled}
          onPaste={onPaste}
          onKeyDown={(event) => onKeyDown(index, event)}
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              applyDigits(value.slice(0, index) + value.slice(index + 1), index);
              return;
            }
            const incoming = normalizeOtp(raw);
            if (!incoming) {
              return;
            }
            if (incoming.length > 1) {
              applyDigits(incoming, OTP_LENGTH - 1);
              return;
            }
            const next = `${value.slice(0, index)}${incoming}${value.slice(index + 1)}`;
            applyDigits(next, index + 1);
          }}
        />
      ))}
    </div>
  );
}
