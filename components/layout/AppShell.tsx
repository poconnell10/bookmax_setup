"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ViewerKind } from "@/lib/access/viewer";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({
  children,
  viewerKind = "customer",
}: {
  children: ReactNode;
  viewerKind?: ViewerKind;
}) {
  const pathname = usePathname();
  const hideSidebar =
    pathname.startsWith("/implementation/thanks") || pathname.startsWith("/implementation/submitted");

  return (
    <div className={`app${hideSidebar ? " no-sb" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {hideSidebar ? null : <Sidebar viewerKind={viewerKind} />}
      <div className="main">
        <AppHeader />
        <div className="intake-scroll">
          <div className="intake-wrap">
            <main id="main-content">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
