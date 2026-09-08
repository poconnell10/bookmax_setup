"use client";

import { SignOutButton } from "@/components/access/SignOutButton";
import { BrandMark } from "@/components/implementation/BrandMark";

export function AccessPendingScreen() {
  return (
    <div className="apwrap on">
      <div className="ap">
        <div className="apmark">
          <BrandMark />
          <span className="wm">BookMax</span>
        </div>
        <div className="api" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
        </div>
        <h1>Access pending</h1>
        <span className="apv">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Email verified
        </span>
        <p className="apm">
          Your email has been verified successfully, but your BookMax access has not been set up yet.
        </p>
        <p className="aps">
          Contact your BookMax administrator if you believe you should have access. You do not need to
          verify your email again — signing in later will pick up your access as soon as it is granted.
        </p>
        <div className="apbtn">
          <SignOutButton className="btn" />
        </div>
        <p className="apf">
          Support ·{" "}
          <a href="https://fpg-ingauge.atlassian.net/servicedesk/customer/portals" target="_blank" rel="noopener">
            Contact the service desk
          </a>
        </p>
      </div>
    </div>
  );
}
