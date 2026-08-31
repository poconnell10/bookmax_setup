"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIntakeOptional } from "@/components/intake/IntakeProvider";
import { IMPLEMENTATION_STAGES, isSetupStagePath } from "@/lib/stages";

function crumbsFor(pathname: string): { trail: string[]; current: string } {
  if (pathname.startsWith("/implementation/thanks") || pathname.startsWith("/implementation/submitted")) {
    return { trail: ["BookMax", "Setup"], current: "Submitted" };
  }

  const stage = IMPLEMENTATION_STAGES.find((item) => item.href === pathname);
  if (stage) {
    return { trail: ["BookMax", "Implementation"], current: stage.label };
  }

  if (pathname.startsWith("/implementation/submissions/") && pathname !== "/implementation/submissions") {
    return { trail: ["BookMax", "Submissions"], current: "Review" };
  }

  if (pathname.startsWith("/implementation/submissions") || pathname.startsWith("/submissions")) {
    return { trail: ["BookMax"], current: "Submissions" };
  }

  if (pathname.startsWith("/account/login")) {
    return { trail: ["BookMax", "Account"], current: "Sign in" };
  }

  if (pathname.startsWith("/account/activate")) {
    return { trail: ["BookMax", "Account"], current: "Sign up" };
  }

  if (pathname.startsWith("/help")) {
    return { trail: ["BookMax"], current: "Implementation Help" };
  }

  return { trail: ["BookMax"], current: "Implementation Setup" };
}

export function AppHeader() {
  const pathname = usePathname();
  const intake = useIntakeOptional();
  const { trail, current } = crumbsFor(pathname);
  const showSave = isSetupStagePath(pathname) && Boolean(intake);

  return (
    <header className="intake-top">
      <div className="crumb">
        {trail.map((part, index) => (
          <span key={`${part}-${index}`}>
            {index > 0 ? <span className="sep">/</span> : null}
            {index === 0 ? (
              <Link href="/implementation/property" className="crumb-home">
                {part}
              </Link>
            ) : (
              <span>{part}</span>
            )}
          </span>
        ))}
        <span className="sep">/</span>
        <span className="cur">{current}</span>
      </div>
      {showSave ? (
        <div className="top-r">
          <span className="saved">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Progress saved · you can leave and resume
          </span>
          <button type="button" className="btn sm" onClick={() => void intake?.saveDraft()}>
            Save &amp; exit
          </button>
        </div>
      ) : null}
    </header>
  );
}
