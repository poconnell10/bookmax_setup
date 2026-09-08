"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSeeInternalNav, canSeeUsersNav, type ViewerKind } from "@/lib/access/viewer";
import { SignOutButton } from "@/components/access/SignOutButton";
import { itemIsActive, NAV_SECTIONS, navAudienceFor } from "@/lib/navigation";

export type ShellIdentity = {
  email: string;
  name: string | null;
};

const ICONS: Record<string, ReactNode> = {
  setup: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  ),
  submissions: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  ),
  users: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-5" />
    </svg>
  ),
};

const ROLE_LABEL: Record<ViewerKind, string> = {
  admin: "Admin",
  engineer: "Engineer",
  viewer: "Viewer",
  customer: "Customer",
  pending: "No access",
  disabled: "Disabled",
};

function initials(name: string) {
  const parts = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2);
  const value = parts.map((part) => part[0]).join("").toUpperCase();
  return value || "?";
}

function displayName(identity?: ShellIdentity) {
  if (!identity) {
    return null;
  }
  if (identity.name?.trim()) {
    return identity.name.trim();
  }
  if (identity.email) {
    return identity.email.split("@")[0] || identity.email;
  }
  return null;
}

export function Sidebar({
  viewerKind = "customer",
  identity,
}: {
  viewerKind?: ViewerKind;
  identity?: ShellIdentity;
}) {
  const pathname = usePathname();
  const allowed = new Set(navAudienceFor(viewerKind));
  const showSignOut = canSeeInternalNav(viewerKind) || canSeeUsersNav(viewerKind);
  const who = displayName(identity);

  return (
    <aside className="sb">
      <div className="sbrand">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M11 6v20M11 6h7a5 5 0 0 1 0 10h-7M11 16h8a5 5 0 0 1 0 10h-8"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="wm">BookMax</span>
      </div>
      <nav className="sbody" aria-label="BookMax">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => allowed.has(item.audience));
          if (items.length === 0) {
            return null;
          }

          return (
            <div key={section.id}>
              <div className="g">{section.label}</div>
              {items.map((item) => {
                const active = itemIsActive(item, pathname);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`n${active ? " on" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {ICONS[item.id]}
                    <span className="lb">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      {showSignOut ? (
        <div className="sfoot">
          <div className="who">
            {who ? <span className="av">{initials(who)}</span> : null}
            <span className="wt">
              {who ? <span className="nm">{who}</span> : null}
              <span className="rl">{ROLE_LABEL[viewerKind]}</span>
            </span>
          </div>
          <SignOutButton />
        </div>
      ) : null}
    </aside>
  );
}
