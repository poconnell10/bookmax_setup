import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailAccessScreen } from "@/components/access/EmailAccessScreen";
import { OtpDigitInputs } from "@/components/access/OtpDigitInputs";
import { OtpVerifyScreen } from "@/components/access/OtpVerifyScreen";
import { EMAIL_VALIDATION_ERROR, isValidEmail, maskEmail, parseWorkEmail } from "@/lib/access/email";
import { isInternalEligibleEmail } from "@/lib/access/internal-eligibility";
import { normalizeOtp } from "@/lib/access/otp";

function stubAccessApis(options?: {
  sendOk?: boolean;
  verifyOk?: boolean;
  verifyError?: { error: string; code: string; status?: number };
  pending?: boolean;
}) {
  const sendOk = options?.sendOk ?? true;
  const verifyOk = options?.verifyOk ?? true;
  const pending = options?.pending ?? true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/access/otp/send")) {
        if (!sendOk) {
          return Response.json({ ok: false, error: "We couldn't send a verification code. Try again." }, { status: 400 });
        }
        return Response.json({ ok: true, emailMasked: "j••••@hotel.com" });
      }
      if (url.includes("/api/access/otp/verify")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (options?.verifyError) {
          return Response.json(
            { ok: false, code: options.verifyError.code, error: options.verifyError.error },
            { status: options.verifyError.status ?? 401 },
          );
        }
        if (!verifyOk || String(body.code || "").length !== 6) {
          return Response.json(
            {
              ok: false,
              code: "otp_invalid",
              error: "That code isn't valid. Check the code and try again.",
            },
            { status: 401 },
          );
        }
        return Response.json({ ok: true });
      }
      if (url.includes("/api/access/otp/pending") && init?.method === "DELETE") {
        return Response.json({ ok: true });
      }
      if (url.includes("/api/access/otp/pending")) {
        if (!pending) {
          return Response.json({ ok: false, code: "not_found" }, { status: 404 });
        }
        return Response.json({ ok: true, emailMasked: "j••••@hotel.com" });
      }
      return Response.json({ ok: false }, { status: 404 });
    }),
  );
}

describe("M1 email helpers", () => {
  it("AUTH-002 / AUTH-003 — rejects invalid and empty emails before any request shape is valid", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
    expect(isValidEmail("john@")).toBe(false);
    const invalid = parseWorkEmail("john@");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toBe(EMAIL_VALIDATION_ERROR);
    }
    const parsed = parseWorkEmail("  jane@hotel.com ");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.email).toBe("jane@hotel.com");
    }
  });

  it("masks email without exposing the full address", () => {
    expect(maskEmail("john@hotel.com")).toBe("j••••@hotel.com");
    expect(maskEmail("john@hotel.com")).not.toContain("john@");
  });

  it("treats frontlinepg.com and in-gauge.io as Internal-eligible, case-insensitively", () => {
    expect(isInternalEligibleEmail("nshaw@frontlinepg.com")).toBe(true);
    expect(isInternalEligibleEmail("asena@in-gauge.io")).toBe(true);
    expect(isInternalEligibleEmail("Andy@IN-GAUGE.IO")).toBe(true);
    expect(isInternalEligibleEmail("priya@hotel.com")).toBe(false);
    expect(isInternalEligibleEmail("qa@yopmail.com")).toBe(false);
  });
});

describe("M1 email entry", () => {
  const push = vi.fn();

  beforeEach(() => {
    push.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      prefetch: vi.fn(),
    } as never);
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    stubAccessApis();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows access copy and support link without privacy or security", () => {
    render(<EmailAccessScreen />);
    expect(screen.getByText(/Enter your email address to get started/)).toBeInTheDocument();
    expect(screen.getByLabelText("EMAIL ADDRESS")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^work email$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Enter your work email address/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Security" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "https://fpg-ingauge.atlassian.net/servicedesk/customer/portals",
    );
  });

  it("AUTH-001 — valid email requests OTP and opens the verification screen", async () => {
    render(<EmailAccessScreen />);
    expect(screen.getByRole("heading", { name: "Start your BookMax implementation" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), { target: { value: "jane@hotel.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/access/verify");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/access/otp/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "jane@hotel.com" }),
      }),
    );
  });

  it("AUTH-002 — invalid email is blocked without a Supabase call", () => {
    render(<EmailAccessScreen />);
    fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), { target: { value: "john@" } });
    fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(screen.getByText(EMAIL_VALIDATION_ERROR)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AUTH-003 — empty email is blocked without a request", () => {
    render(<EmailAccessScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(screen.getByText(EMAIL_VALIDATION_ERROR)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("M1 OTP input", () => {
  it("AUTH-007 — pasting six digits fills the fields", () => {
    const onChange = vi.fn();
    render(<OtpDigitInputs id="otp-digit-0" value="" onChange={onChange} />);
    fireEvent.paste(screen.getByLabelText("Digit 1 of 6"), {
      clipboardData: { getData: () => "482913" },
    });
    expect(onChange).toHaveBeenCalledWith("482913");
  });

  it("AUTH-008 — numeric input advances, backspace moves back, non-numeric is ignored", () => {
    const onChange = vi.fn();
    const { rerender } = render(<OtpDigitInputs id="otp-digit-0" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith("4");
    rerender(<OtpDigitInputs id="otp-digit-0" value="4" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Digit 2 of 6"), { target: { value: "ab" } });
    expect(onChange).not.toHaveBeenCalledWith("4ab");
    fireEvent.keyDown(screen.getByLabelText("Digit 2 of 6"), { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith("");
    expect(normalizeOtp("12 34-56abc")).toBe("123456");
  });
});

describe("M1 OTP verification screen", () => {
  const push = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
      prefetch: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AUTH-004 — valid OTP without a resume path stays off customer setup", async () => {
    stubAccessApis();
    render(<OtpVerifyScreen />);
    await screen.findByText(/j••••@hotel.com/);
    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), { target: { value: "123456" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/access/pending");
    });
  });

  it("AUTH-005 — incorrect OTP stays on the verification screen", async () => {
    stubAccessApis({ verifyOk: false });
    render(<OtpVerifyScreen />);
    await screen.findByText(/j••••@hotel.com/);
    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByText("That code isn't valid. Check the code and try again.")).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("AUTH-006 — expired OTP shows the expired message", async () => {
    stubAccessApis({
      verifyError: {
        code: "otp_expired",
        error: "This code has expired. Send a new code to continue.",
      },
    });
    render(<OtpVerifyScreen />);
    await screen.findByText(/j••••@hotel.com/);
    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByText("This code has expired. Send a new code to continue.")).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("AUTH-009 — resend requests a new code and confirms it", async () => {
    stubAccessApis();
    render(<OtpVerifyScreen />);
    await screen.findByText(/j••••@hotel.com/);
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    await waitFor(() => {
      expect(screen.getByText("A new code has been sent.")).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/access/otp/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("AUTH-010 — changing email returns to email entry and clears pending state", async () => {
    stubAccessApis();
    render(<OtpVerifyScreen />);
    await screen.findByText(/j••••@hotel.com/);
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/access");
    });
    expect(fetch).toHaveBeenCalledWith("/api/access/otp/pending", { method: "DELETE" });
  });

  it("AUTH-011 — missing pending email recovers to email entry without query-string email", async () => {
    stubAccessApis({ pending: false });
    render(<OtpVerifyScreen />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/access?continue=1");
    });
    expect(replace.mock.calls[0][0]).not.toMatch(/@/);
  });
});
