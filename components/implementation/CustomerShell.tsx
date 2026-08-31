"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/implementation/BrandMark";
import { IMPLEMENTATION_STAGES } from "@/lib/stages";

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentIndex = IMPLEMENTATION_STAGES.findIndex((stage) => stage.href === pathname);
  const current = IMPLEMENTATION_STAGES[currentIndex];
  const isThanks = pathname.startsWith("/implementation/thanks");

  return (
    <div className="bmx-auth">
      <aside className="brandside">
        <div className="bmark">
          <BrandMark />
          <span className="wm">BookMax</span>
          <span className="pd">Implementation</span>
        </div>
        <div className="bpitch">
          <h2>Start your BookMax implementation</h2>
          <p>
            BookMax is a pre-arrival upsell solution. We need a few basic details about your property
            and PMS so our implementation team can get started. Takes about 2 minutes.
          </p>
          <p className="bpitch-note">
            You will not be asked for configuration we can retrieve from your PMS.
          </p>
          <div className="bsteps">
            {IMPLEMENTATION_STAGES.map((stage, index) => (
              <span
                key={stage.id}
                className={`bs${index === currentIndex ? " on" : ""}${isThanks ? " on" : ""}`}
              >
                <span className="bn">{index + 1}</span>
                <span className="bt">
                  <b>{stage.label}</b>
                  {stage.subtitle}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="bfoot">
          <span>About 2 minutes</span>
          <span>Privacy</span>
          <span>Contact implementation</span>
        </div>
      </aside>
      <main className="formside">
        <div className="shell shell-wide">
          <div className="mobmark">
            <BrandMark />
            <span className="wm">BookMax Implementation</span>
          </div>
          {current ? (
            <div className="mprog">
              Step {currentIndex + 1} of {IMPLEMENTATION_STAGES.length} · {current.label}
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
