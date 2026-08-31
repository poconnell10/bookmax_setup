"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createInitialIntakeState,
  stamp,
  submitBlockers,
  toDraftPayload,
  toSubmissionRecord,
} from "@/lib/implementation/selectors";
import type { IntakeState } from "@/types/implementation";

const DRAFT_KEY = "bookmax.draftId";
const SUBMITTED_KEY = "bookmax.submitted";

type IntakeContextValue = {
  state: IntakeState;
  patch: (update: Partial<IntakeState>) => void;
  saveDraft: () => Promise<void>;
  saveConnection: () => Promise<void>;
  submitSetup: () => Promise<void>;
  submitCredentials: (payload: {
    clientId: string;
    clientSecret: string;
    applicationKey: string;
  }) => Promise<void>;
  replaceCredentials: () => void;
  toastMessage: string | null;
  notify: (message: string) => void;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return (await response.json()) as T;
}

export function IntakeProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: IntakeState;
}) {
  const [state, setState] = useState<IntakeState>(() => {
    if (initialState) {
      return initialState;
    }

    if (typeof window === "undefined") {
      return createInitialIntakeState();
    }

    try {
      const saved = window.localStorage.getItem(SUBMITTED_KEY);
      if (saved) {
        return JSON.parse(saved) as IntakeState;
      }
    } catch {
      // ignore malformed local POC state
    }

    return createInitialIntakeState();
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const draftId = window.sessionStorage.getItem(DRAFT_KEY);

    if (!draftId) {
      return;
    }

    void fetch(`/api/implementation/draft?id=${encodeURIComponent(draftId)}`)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { draft: IntakeState | null };

        if (payload.draft) {
          setState(payload.draft);
        }
      });
  }, []);

  const patch = useCallback((update: Partial<IntakeState>) => {
    setState((current) => {
      const next = { ...current, ...update };

      if (
        next.connectionDetailsStatus === "complete" &&
        ("enterpriseId" in update ||
          "hotelId" in update ||
          "gatewayUrl" in update ||
          "environment" in update ||
          "pmsVersion" in update ||
          "connectionMethod" in update)
      ) {
        next.connectionDetailsStatus = "in_progress";
      }

      return next;
    });
  }, []);

  const saveDraft = useCallback(async () => {
    const result = await postJson<{ draftId: string }>("/api/implementation/draft", {
      draft: toDraftPayload(state),
    });

    setState((current) => ({ ...current, draftId: result.draftId }));
    window.sessionStorage.setItem(DRAFT_KEY, result.draftId);
    notify("Progress saved. You can leave and resume.");
  }, [notify, state]);

  const saveConnection = useCallback(async () => {
    const next = { ...state, connectionDetailsStatus: "complete" as const };
    const result = await postJson<{ draftId: string }>("/api/implementation/draft", {
      draft: toDraftPayload(next),
    });

    setState({ ...next, draftId: result.draftId });
    window.sessionStorage.setItem(DRAFT_KEY, result.draftId);
    notify(
      next.pmsId === "operacloud"
        ? "Connection details saved — credentials can follow later"
        : "Saved to your implementation record",
    );
  }, [notify, state]);

  const submitSetup = useCallback(async () => {
    if (state.submitted && state.submissionId) {
      return;
    }

    const blockers = submitBlockers(state);
    if (blockers.length > 0) {
      throw new Error(blockers[0]);
    }

    const submittedAt = stamp();
    const record = toSubmissionRecord(
      { ...state, submittedBy: state.contactName },
      submittedAt,
    );
    const result = await postJson<{ submissionId: string }>(
      "/api/implementation/submit",
      { record },
    );
    const submittedState: IntakeState = {
      ...state,
      submitted: true,
      status: "submitted",
      connectionDetailsStatus: "complete",
      submittedAt,
      submittedBy: state.contactName,
      submissionId: result.submissionId,
    };
    const draft = await postJson<{ draftId: string }>("/api/implementation/draft", {
      draft: toDraftPayload(submittedState),
    });
    window.sessionStorage.setItem(DRAFT_KEY, draft.draftId);
    try {
      window.localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ ...submittedState, draftId: draft.draftId }));
    } catch {
      // private browsing can block localStorage
    }
    setState({ ...submittedState, draftId: draft.draftId });
  }, [state]);

  const submitCredentials = useCallback(
    async (payload: {
      clientId: string;
      clientSecret: string;
      applicationKey: string;
    }) => {
      let draftId = state.draftId;

      if (!draftId) {
        const saved = await postJson<{ draftId: string }>("/api/implementation/draft", {
          draft: toDraftPayload(state),
        });
        draftId = saved.draftId;
        window.sessionStorage.setItem(DRAFT_KEY, draftId);
      }

      await postJson("/api/implementation/credentials", { draftId, ...payload });
      setState((current) => ({
        ...current,
        draftId,
        credentialsStatus: "received",
      }));
      notify("Credentials received — stored securely, not shown again");
    },
    [notify, state],
  );

  const replaceCredentials = useCallback(() => {
    setState((current) => ({ ...current, credentialsStatus: "not_received" }));
    notify("Enter the full credential set again");
  }, [notify]);

  const value = useMemo(
    () => ({
      state,
      patch,
      saveDraft,
      saveConnection,
      submitSetup,
      submitCredentials,
      replaceCredentials,
      toastMessage,
      notify,
    }),
    [
      state,
      patch,
      saveDraft,
      saveConnection,
      submitSetup,
      submitCredentials,
      replaceCredentials,
      toastMessage,
      notify,
    ],
  );

  return (
    <IntakeContext.Provider value={value}>
      {children}
      <div className={`toast${toastMessage ? " on" : ""}`} role="status">
        {toastMessage}
      </div>
    </IntakeContext.Provider>
  );
}

export function useIntakeOptional() {
  return useContext(IntakeContext);
}

export function useIntake() {
  const value = useIntakeOptional();

  if (!value) {
    throw new Error("useIntake must be used within IntakeProvider");
  }

  return value;
}
