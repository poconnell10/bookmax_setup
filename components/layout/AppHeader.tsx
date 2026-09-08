"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIntakeOptional } from "@/components/intake/IntakeProvider";
import { canSeeInternalNav, canSeeUsersNav, type ViewerKind } from "@/lib/access/viewer";
import { IMPLEMENTATION_STAGES, isSetupStagePath } from "@/lib/stages";

const ROLE_BADGE: Record<ViewerKind, { label: string; tone: string }> = {
  admin: { label: "Admin", tone: "adm" },
  engineer: { label: "Engineer", tone: "info" },
  viewer: { label: "Viewer", tone: "mut" },
  customer: { label: "Customer", tone: "ok" },
  pending: { label: "No access", tone: "pend" },
  disabled: { label: "Disabled", tone: "off" },
};

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

  if (pathname.startsWith("/implementation/users")) {
    return { trail: ["BookMax"], current: "Users & Access" };
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

export function AppHeader({ viewerKind }: { viewerKind?: ViewerKind }) {
  const pathname = usePathname();
  const intake = useIntakeOptional();
  const { trail, current } = crumbsFor(pathname);
  const showSave = isSetupStagePath(pathname) && Boolean(intake);
  const role = viewerKind ? ROLE_BADGE[viewerKind] : null;
  const internal = viewerKind ? canSeeInternalNav(viewerKind) || canSeeUsersNav(viewerKind) : false;

  return (
    <header className="intake-top">
      <div className="crumb">
        {trail.map((part, index) => (
          <span key={`${part}-${index}`}>
            {index > 0 ? <span className="sep">/</span> : null}
            {index === 0 ? (
              internal ? (
                <span>{part}</span>
              ) : (
                <Link href="/implementation/property" className="crumb-home">
                  {part}
                </Link>
              )
            ) : (
              <span>{part}</span>
            )}
          </span>
        ))}
        <span className="sep">/</span>
        <span className="cur">{current}</span>
      </div>
      {role ? (
        <div className="asrole">
          <span>Signed in as</span>
          <span className={`bd ${role.tone}`}>{role.label}</span>
        </div>
      ) : null}
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
