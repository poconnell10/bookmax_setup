"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthBrandPanel } from "@/components/account/AuthBrandPanel";

export function ActivateScreen() {
  const [state, setState] = useState<"idle" | "pending">("idle");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState("pending");
  }

  return (
    <div className="auth-wrap">
      <AuthBrandPanel />
      <div className="authpane">
        <div className="auth-card">
          <div className="auth-crumb">
            BookMax <span className="sep">/</span> Account <span className="sep">/</span>{" "}
            <span className="cur">Sign up</span>
          </div>
          <h1>Activate your account</h1>
          <p className="s">
            Use your work email and invitation to open BookMax setup — Property &amp; PMS, Connect PMS, then Summary.
          </p>
          {state === "pending" ? (
            <div className="note">
              Account status: pending activation. We will email an activation link when BookMax accounts are connected. No account was created.
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="f" style={{ marginBottom: 15 }}>
                <label htmlFor="activate-email">Work email</label>
                <input
                  id="activate-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@property.com"
                  required
                />
              </div>
              <div className="f" style={{ marginBottom: 18 }}>
                <label htmlFor="invite-code">
                  Invitation code <span className="opt">optional</span>
                </label>
                <input id="invite-code" type="text" autoComplete="off" placeholder="Invitation or activation code" />
              </div>
              <button className="btn pri" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                Request activation
              </button>
            </form>
          )}
          <p className="sfine" style={{ textAlign: "center", marginTop: 18 }}>
            Already activated? <Link href="/account/login">Log in</Link>
            {" · "}
            <Link href="/implementation/property">Continue to setup</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
