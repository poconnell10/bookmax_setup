"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
import { useIntake } from "@/components/intake/IntakeProvider";
import { IMPLEMENTATION_STAGES } from "@/lib/stages";

export function AppHeader() {
  const pathname = usePathname();
  const { saveDraft } = useIntake();
  const current = IMPLEMENTATION_STAGES.find((stage) => stage.href === pathname);
  const onThanks = pathname === "/implementation/thanks";

  return (
    <header className="intake-top">
      <div className="crumb">
        <Link href="/implementation/property" className="flex items-center gap-2 no-underline text-ink">
          <BrandMark />
          <span className="text-sm font-semibold text-[var(--ink)]">BookMax</span>
        </Link>
        <span className="sep">/</span>
        <span>Implementation</span>
        <span className="sep">/</span>
        <span className="cur">{onThanks ? "Submitted" : current?.label || "Implementation Setup"}</span>
      </div>
      {!onThanks ? (
        <div className="top-r">
          <span className="saved">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Progress saved · you can leave and resume
          </span>
          <button type="button" className="btn sm" onClick={() => void saveDraft()}>
            Save &amp; exit
          </button>
        </div>
      ) : null}
    </header>
  );
}
