import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertPrototypePersistenceAllowed,
  prototypeFilePersistenceEnabled,
} from "@/lib/implementation/persistence-config";
import { writePrototypeSnapshot } from "@/lib/implementation/prototype-file-store";
import type {
  IntakeState,
  SubmissionRecord,
  SubmissionStatus,
} from "@/types/implementation";
import { SUBMISSION_STATUSES } from "@/types/implementation";

export type CredentialPayload = {
  clientId: string;
  clientSecret: string;
  applicationKey: string;
};

export type PersistencePort = {
  saveDraft: (draft: IntakeState) => Promise<{ draftId: string }>;
  loadDraft: (draftId: string) => Promise<IntakeState | null>;
  submitImplementation: (
    record: SubmissionRecord,
  ) => Promise<{ submissionId: string }>;
  submitCredentials: (
    draftId: string,
    payload: CredentialPayload,
  ) => Promise<{ credentialsStatus: "received" }>;
};

const DRAFTS = new Map<string, IntakeState>();
const SUBMISSIONS = new Map<string, SubmissionRecord>();
const CREDENTIAL_RECEIPTS = new Map<string, true>();
const RECENT_SUBMITS = new Map<string, { submissionId: string; at: number }>();

const STORE_FILE = join(process.cwd(), "data", "poc-submissions.json");
const SECRET_KEY =
  /secret|password|api[_-]?key|private[_-]?key|token|client[_-]?secret/i;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function withoutSecrets(draft: IntakeState): IntakeState {
  return { ...draft };
}

function stripSecretFields(
  details: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !SECRET_KEY.test(key)),
  );
}

export function publicSubmission(record: SubmissionRecord): SubmissionRecord {
  return {
    ...record,
    country: record.country || "",
    primary_contact: record.primary_contact || record.submitted_by || "",
    primary_contact_email: record.primary_contact_email || "",
    connection_details: stripSecretFields(record.connection_details || {}),
  };
}

function fingerprint(record: SubmissionRecord): string {
  return [
    record.organisation,
    record.properties.join("|"),
    record.pms,
    record.submitted_by,
  ]
    .join("::")
    .toLowerCase();
}

function seedPrototypeSubmissions() {
  if (SUBMISSIONS.size > 0) {
    return;
  }

  SUBMISSIONS.set("BMX-ABC-001", {
    submission_id: "BMX-ABC-001",
    organisation: "Hotel ABC Group",
    properties: ["Hotel ABC Barcelona"],
    country: "Spain",
    primary_contact: "Elena Márquez",
    primary_contact_email: "elena.marquez@hotelabc.com",
    pms: "OPERA Cloud",
    pms_version: "Cloud",
    pms_type: "Cloud",
    technical_contact: "Jane Smith",
    technical_contact_email: "jane.smith@hotelabc.com",
    technical_contact_mobile: "",
    connection_method: "OHIP",
    connection_details: {
      Environment: "Test / UAT",
      "Enterprise ID": "ABCHT",
      "Hotel ID": "BCN01",
    },
    connection_details_status: "complete",
    credentials_status: "received",
    submitted_at: "27 Aug 2026, 3:14 pm",
    submitted_by: "Implementation contact",
    status: "Submitted",
    created_at: "27 Aug 2026, 3:14 pm",
    updated_at: "27 Aug 2026, 3:14 pm",
  });
}

async function loadStore() {
  if (!prototypeFilePersistenceEnabled()) {
    seedPrototypeSubmissions();
    return;
  }
  try {
    const parsed = JSON.parse(await readFile(STORE_FILE, "utf8")) as {
      submissions: SubmissionRecord[];
    };
    if (
      !Array.isArray(parsed.submissions) ||
      parsed.submissions.some(
        (record) =>
          !record ||
          typeof record.submission_id !== "string" ||
          typeof record.submitted_at !== "string" ||
          !Array.isArray(record.properties),
      )
    ) {
      throw new Error("Invalid prototype persistence file.");
    }
    for (const record of parsed.submissions) {
      SUBMISSIONS.set(record.submission_id, publicSubmission(record));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    seedPrototypeSubmissions();
    await saveStore();
  }
}

async function saveStore() {
  if (!prototypeFilePersistenceEnabled()) return;
  await writePrototypeSnapshot(
    STORE_FILE,
    JSON.stringify(
      { submissions: [...SUBMISSIONS.values()].map(publicSubmission) },
      null,
      2,
    ),
  );
}

let loaded = false;
let operations: Promise<unknown> = Promise.resolve();

/** Serialize the entire read/mutate/write transaction, including initial loading. */
function withStore<T>(operation: () => Promise<T> | T): Promise<T> {
  assertPrototypePersistenceAllowed();
  const result = operations.then(async () => {
    assertPrototypePersistenceAllowed();
    if (!loaded) {
      await loadStore();
      loaded = true;
    }
    const previous = new Map(SUBMISSIONS);
    try {
      return await operation();
    } catch (error) {
      SUBMISSIONS.clear();
      for (const [id, record] of previous) SUBMISSIONS.set(id, record);
      throw error;
    }
  });
  operations = result.catch(() => undefined);
  return result;
}

export const prototypePersistence: PersistencePort = {
  async saveDraft(draft) {
    assertPrototypePersistenceAllowed();
    const draftId = draft.draftId || newId("draft");
    DRAFTS.set(draftId, withoutSecrets({ ...draft, draftId }));
    return { draftId };
  },

  async loadDraft(draftId) {
    assertPrototypePersistenceAllowed();
    return DRAFTS.get(draftId) ?? null;
  },

  async submitImplementation(record) {
    return withStore(async () => {
      const key = fingerprint(record);
      const recent = RECENT_SUBMITS.get(key);
      if (recent && Date.now() - recent.at < 8000) {
        return { submissionId: recent.submissionId };
      }

      const submissionId = record.submission_id || newId("BMX");
      const stored = publicSubmission({
        ...record,
        submission_id: submissionId,
        status:
          record.status && SUBMISSION_STATUSES.includes(record.status)
            ? record.status
            : "Submitted",
      });
      SUBMISSIONS.set(submissionId, stored);
      await saveStore();
      RECENT_SUBMITS.set(key, { submissionId, at: Date.now() });
      return { submissionId };
    });
  },

  async submitCredentials(draftId, payload) {
    return withStore(async () => {
      if (
        !payload.clientId.trim() ||
        !payload.clientSecret.trim() ||
        !payload.applicationKey.trim()
      ) {
        throw new Error("All credential fields are required together.");
      }

      const submission = [...SUBMISSIONS.values()].find(
        (item) => item.submission_id === draftId,
      );
      if (submission) {
        SUBMISSIONS.set(draftId, {
          ...submission,
          credentials_status: "received",
          updated_at: submission.updated_at,
        });
        await saveStore();
      }

      CREDENTIAL_RECEIPTS.set(draftId, true);
      const draft = DRAFTS.get(draftId);

      if (draft) {
        DRAFTS.set(draftId, { ...draft, credentialsStatus: "received" });
      }

      return { credentialsStatus: "received" as const };
    });
  },
};

export async function listPrototypeSubmissions(): Promise<SubmissionRecord[]> {
  return withStore(() => {
    return [...SUBMISSIONS.values()]
      .map(publicSubmission)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  });
}

export async function getPrototypeSubmission(
  id: string,
): Promise<SubmissionRecord | undefined> {
  return withStore(() => {
    const record = SUBMISSIONS.get(id);
    return record ? publicSubmission(record) : undefined;
  });
}

export async function updatePrototypeSubmissionStatus(
  id: string,
  status: SubmissionStatus,
): Promise<SubmissionRecord | undefined> {
  return withStore(async () => {
    const current = SUBMISSIONS.get(id);
    if (!current) {
      return undefined;
    }

    const updated: SubmissionRecord = {
      ...current,
      status,
      updated_at: new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
    SUBMISSIONS.set(id, updated);
    await saveStore();
    return publicSubmission(updated);
  });
}

export function credentialsWereReceived(draftId: string): boolean {
  assertPrototypePersistenceAllowed();
  return CREDENTIAL_RECEIPTS.has(draftId);
}
