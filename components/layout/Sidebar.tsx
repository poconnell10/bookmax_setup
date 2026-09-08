"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSeeInternalNav, canSeeUsersNav, type ViewerKind } from "@/lib/access/viewer";
import { SignOutButton } from "@/components/access/SignOutButton";
import { itemIsActive, NAV_SECTIONS, navAudienceFor } from "@/lib/navigation";

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
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  users: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M20 8v6M17 11h6" />
    </svg>
  ),
};

const ROLE_LABEL: Record<ViewerKind, string> = {
  admin: "Admin",
  engineer: "Engineer",
  viewer: "Viewer",
  customer: "Customer",
  pending: "Pending",
  disabled: "Disabled",
};

export function Sidebar({ viewerKind = "customer" }: { viewerKind?: ViewerKind }) {
  const pathname = usePathname();
  const allowed = new Set(navAudienceFor(viewerKind));
  const showSignOut = canSeeInternalNav(viewerKind) || canSeeUsersNav(viewerKind);

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
            <span className="rl">{ROLE_LABEL[viewerKind]}</span>
          </div>
          <SignOutButton />
        </div>
      ) : null}
    </aside>
  );
}
