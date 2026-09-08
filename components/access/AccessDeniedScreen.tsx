"use client";

import { SignOutButton } from "@/components/access/SignOutButton";
import { BrandMark } from "@/components/implementation/BrandMark";

export function AccessDeniedScreen() {
  return (
    <div className="apwrap on">
      <div className="ap">
        <div className="apmark">
          <BrandMark />
          <span className="wm">BookMax</span>
        </div>
        <div className="api api-off" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
          </svg>
        </div>
        <h1>Access denied</h1>
        <p className="apm">Your BookMax access is currently disabled.</p>
        <p className="aps">
          Contact your BookMax administrator if you believe this is a mistake. Signing out will return you
          to the access screen.
        </p>
        <div className="apbtn">
          <SignOutButton className="btn" />
        </div>
      </div>
    </div>
  );
}
