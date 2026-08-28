"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StageNav } from "@/components/implementation/StageNav";
import { IntakeProvider } from "@/components/intake/IntakeProvider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <IntakeProvider>
      <div className="intake min-h-full">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AppHeader />
        <div className="intake-scroll">
          <div className="intake-wrap">
            <StageNav />
            <main id="main-content">{children}</main>
          </div>
        </div>
      </div>
    </IntakeProvider>
  );
}
