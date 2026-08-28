"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { canReachStage } from "@/lib/implementation/selectors";
import { IMPLEMENTATION_STAGES } from "@/lib/stages";

export function StageNav() {
  const pathname = usePathname();
  const { state } = useIntake();

  if (pathname === "/implementation/thanks") {
    return null;
  }

  const currentIndex = IMPLEMENTATION_STAGES.findIndex((stage) => stage.href === pathname);

  return (
    <nav aria-label="Implementation stages" className="phases">
      {IMPLEMENTATION_STAGES.map((stage, index) => {
        const reachable = canReachStage(state, stage.id);
        const isCurrent = pathname === stage.href;
        const isDone = index < currentIndex && reachable;
        const className = `phb${isCurrent ? " on" : ""}${isDone ? " done" : ""}`;

        const inner = (
          <>
            <span className="phn">{isDone ? "✓" : index + 1}</span>
            <span className="pht">
              <b>{stage.label}</b>
              <i>{stage.subtitle}</i>
            </span>
          </>
        );

        return (
          <span key={stage.id} className="ph">
            {reachable ? (
              <Link
                href={stage.href}
                className={className}
                aria-current={isCurrent ? "page" : undefined}
              >
                {inner}
              </Link>
            ) : (
              <button type="button" className={className} disabled>
                {inner}
              </button>
            )}
            {index < IMPLEMENTATION_STAGES.length - 1 ? <span className="phbar" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
