"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/implementation/BrandMark";
import { useIntake } from "@/components/intake/IntakeProvider";
import { IMPLEMENTATION_STAGES, isSetupStagePath } from "@/lib/stages";
import { canReachStage } from "@/lib/implementation/selectors";
import type { StageId } from "@/types/implementation";

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useIntake();
  const currentIndex = IMPLEMENTATION_STAGES.findIndex((stage) => stage.href === pathname);
  const isThanks = pathname.startsWith("/implementation/thanks");
  const showSteps = isSetupStagePath(pathname) && !isThanks;

  return (
    <div className="bmx-setup">
      <div className="top">
        <div className="brand">
          <BrandMark />
          <span className="wm">BookMax</span>
          <span className="who">{state.contactEmail || "—"}</span>
        </div>
        <div className="topR">
          {state.draftId && !isThanks ? (
            <span className="saved">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Saved — you can finish later
            </span>
          ) : null}
        </div>
      </div>
      <div className="scroll">
        <div className="wrap">
          {showSteps ? (
            <div className="steps">
              {IMPLEMENTATION_STAGES.map((stage, index) => {
                const done = index < currentIndex;
                const on = index === currentIndex;
                const can = canReachStage(state, stage.id as StageId) && index !== currentIndex;
                return (
                  <span key={stage.id} className={`st${on ? " on" : done ? " done" : ""}`}>
                    <button
                      type="button"
                      className="stb"
                      disabled={!can}
                      onClick={() => router.push(stage.href)}
                    >
                      <span className="stn">
                        {done ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="stl">{stage.label}</span>
                    </button>
                    {index < IMPLEMENTATION_STAGES.length - 1 ? <span className="stbar" /> : null}
                  </span>
                );
              })}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
