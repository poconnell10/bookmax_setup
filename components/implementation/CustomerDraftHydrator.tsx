"use client";

import { useLayoutEffect, useRef } from "react";
import { useIntake } from "@/components/intake/IntakeProvider";
import type { IntakeState } from "@/types/implementation";

const DRAFT_KEY = "bookmax.draftId";

export function CustomerDraftHydrator({ initialState }: { initialState: IntakeState }) {
  const { patch } = useIntake();
  const applied = useRef(false);

  useLayoutEffect(() => {
    if (applied.current) {
      return;
    }
    applied.current = true;
    patch(initialState);
    if (initialState.draftId) {
      try {
        window.sessionStorage.setItem(DRAFT_KEY, initialState.draftId);
      } catch {
        // ignore
      }
    }
  }, [initialState, patch]);

  return null;
}
