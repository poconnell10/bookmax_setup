"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthBrandPanel } from "@/components/account/AuthBrandPanel";

export function LoginScreen() {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("Sign-in will be connected to BookMax accounts later. No authentication ran.");
  }

  return (
    <div className="auth-wrap">
      <AuthBrandPanel />
      <div className="authpane">
        <div className="auth-card">
          <div className="auth-crumb">
            BookMax <span className="sep">/</span> Account <span className="sep">/</span>{" "}
            <span className="cur">Sign in</span>
          </div>
          <h1>Welcome back</h1>
          <p className="s">Sign in to continue BookMax setup.</p>
          <div className="sso">
            <button
              type="button"
              className="sso-btn"
              onClick={() => setMessage("Microsoft sign-in will be available when accounts are connected.")}
            >
              Continue with Microsoft
            </button>
            <button
              type="button"
              className="sso-btn"
              onClick={() => setMessage("A sign-in link can be emailed once authentication is connected.")}
            >
              Email me a sign-in link
            </button>
          </div>
          <div className="divider">or with email</div>
          <form onSubmit={onSubmit}>
            <div className="f" style={{ marginBottom: 15 }}>
              <label htmlFor="login-email">Work email</label>
              <input id="login-email" type="email" autoComplete="username" placeholder="you@property.com" />
            </div>
            <div className="f" style={{ marginBottom: 18 }}>
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
              />
            </div>
            <button className="btn pri" type="submit" style={{ width: "100%", justifyContent: "center" }}>
              Sign in
            </button>
          </form>
          <p className="sfine" style={{ textAlign: "center", marginTop: 18 }}>
            Need an account? <Link href="/account/activate">Sign up / Activate</Link>
            {" · "}
            <Link href="/implementation/property">Continue to setup</Link>
          </p>
          {message ? <div className="note">{message}</div> : null}
        </div>
      </div>
    </div>
  );
}
