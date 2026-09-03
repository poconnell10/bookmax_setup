"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/implementation/BrandMark";
import { canReachSetupStage } from "@/lib/setup/resume";
import { emptySetupIntake, type SetupIntakePayload } from "@/lib/setup/intake";
import { SETUP_STAGES, setupStageIndex, type SetupStageId } from "@/lib/setup/stages";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

export function SetupShell({
  email,
  saved,
  property,
  intake,
  submitted,
  children,
}: {
  email?: string;
  saved?: boolean;
  property?: CustomerProperty | null;
  intake?: SetupIntakePayload;
  submitted?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentIndex = setupStageIndex(pathname);
  const flowStages = SETUP_STAGES.filter((stage) => stage.id !== "access");
  const showSteps = currentIndex >= 1;

  return (
    <div className="bmx-setup">
      <div className="top">
        <div className="brand">
          <BrandMark />
          <span className="wm">BookMax</span>
          {email ? <span className="who">{email}</span> : null}
        </div>
        <div className="topR">
          {saved ? (
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
              {flowStages.map((stage, index) => {
                const stageIndex = index + 1;
                const done = stageIndex < currentIndex;
                const on = stageIndex === currentIndex;
                const stageId = stage.id as Exclude<SetupStageId, "access">;
                const can =
                  canReachSetupStage(stageId, {
                    property: property ?? null,
                    intake: intake ?? emptySetupIntake(),
                    submitted: Boolean(submitted),
                  }) &&
                  stageIndex !== currentIndex;
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
                          stageIndex
                        )}
                      </span>
                      <span className="stl">{stage.label}</span>
                    </button>
                    {index < flowStages.length - 1 ? <span className="stbar" /> : null}
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
