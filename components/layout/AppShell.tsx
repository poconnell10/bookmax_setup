"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { canSeeInternalNav, canSeeUsersNav, type ViewerKind } from "@/lib/access/viewer";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar, type ShellIdentity } from "@/components/layout/Sidebar";

export function AppShell({
  children,
  viewerKind = "customer",
  identity,
}: {
  children: ReactNode;
  viewerKind?: ViewerKind;
  identity?: ShellIdentity;
}) {
  const pathname = usePathname();
  const hideSidebar =
    pathname.startsWith("/implementation/thanks") || pathname.startsWith("/implementation/submitted");
  const internal = canSeeInternalNav(viewerKind) || canSeeUsersNav(viewerKind);

  return (
    <div className={`app${hideSidebar ? " no-sb" : ""}${internal ? " app-internal" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {hideSidebar ? null : <Sidebar viewerKind={viewerKind} identity={identity} />}
      <div className="main">
        <AppHeader viewerKind={internal ? viewerKind : undefined} />
        <div className="intake-scroll">
          <div className="intake-wrap">
            <main id="main-content">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
