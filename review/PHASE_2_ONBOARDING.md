# Phase 2 — Customer Onboarding Reliability Review

| Field | Value |
| --- | --- |
| Repository | `poconnell10/bookmax_setup` |
| Reviewer role | Senior Full-Stack Engineer (code review) |
| Scope | Customer onboarding reliability only |
| Reviewed commit | `e5347e6cdc25242f64d5edcbb5a25996d54b74aa` |
| Review branch | `cursor/phase-2-onboarding-review-0dcd` |
| Review date | 29 Oct 2026, 2:10 PM EDT (America/New_York) |
| Amended | 29 Oct 2026, 2:15 PM EDT (America/New_York) — follow-up verification of parallel review passes |
| Method | Static analysis of invitation + `/setup` flows, APIs, stores, migrations, tests |
| Code modified | None (this document only) |

**Classification**

| Severity | Meaning |
| --- | --- |
| **P1** | Broken happy path, durable data loss/corruption, false “saved/submitted” state, duplicate or stuck submission, server accepts invalid completion |
| **P2** | Degraded recovery, UX integrity, partial writes, or missing defense-in-depth without total happy-path blocker |

Only **confirmed** defects from code/tests. Speculation is under **Unverified**.

---

## Executive verdict

**NOT READY for end-to-end onboarding acceptance** on the **invitation** workflow (Invitation → OTP → Property → Contacts → PMS → Review → Submit).

The newer **`/setup`** path (Access OTP → Property → PMS → Connect → Review → Submit) is materially stronger (server-side `submitBlockers`, API-gated step saves, resume helpers) but has a **P1** completeness hole after Admin-started property (ONB-14), plus non-transactional multi-write steps and no server-side stage deep-link enforcement.

Two parallel customer onboarding systems coexist. Product readiness must pick a primary path; the invitation path currently fails several reliability acceptance bars.

---

## Workflow map (as implemented)

### A — Invitation path (requested sequence)

| Step | Entry | Auth / gate | Persistence |
| --- | --- | --- | --- |
| Invitation | `GET /implementation/invite/[token]` | Raw token → hash lookup | Sets `bookmax.invitation` cookie; `markOpened` |
| Email OTP | `/implementation` + `/api/implementation/otp/*` | Invitation cookie; `shouldCreateUser: true` | Bind `auth_user_id`; HMAC `bookmax.invitation_claim` |
| Property | `/implementation/property` | `requireCustomerInvitationAccess` via `(customer)/layout` | Client draft → `POST /api/implementation/draft` |
| Contacts | `/implementation/contacts` | Same | Same |
| PMS | `/implementation/pms` | Same | Same (connect details folded into PMS screen) |
| Review / Submit | `/implementation/review` → `POST /api/implementation/submit` | Same | `implementation_submission` + invitation `submitted` |
| Thanks | `/implementation/thanks` | Same | — |

Stage list: `lib/stages.ts` (`IMPLEMENTATION_STAGES`). Client reachability: `canReachStage` in `lib/implementation/selectors.ts`. **No server redirect** if a later stage URL is opened early.

### B — `/setup` path (provisioned customer)

| Step | Entry | Notes |
| --- | --- | --- |
| Access OTP | `/access` → `/api/access/otp/*` | `shouldCreateUser: false`; `resolveAuthorization` |
| Property (+ contacts) | `/setup/property` | People/PMS contact on same step; Admin scope optional |
| PMS | `/setup/pms` | `POST /api/setup/intake` `step: "pms"` |
| Connect | `/setup/connect` | Intake + optional encrypted credentials |
| Review / Submit | `/setup/review` → `POST /api/setup/submit` | Server `submitBlockers` |
| Resume | `/setup/(customer)/complete` | `getSetupResumePath` |

---

## Confirmed defects

### ONB-01 — P1 — Invitation submit has no server-side completeness validation

**Area:** Workflow transitions / server-side validation

**Evidence**

Client Review checks `submitBlockers` (`components/setup/ReviewScreen.tsx`).  
Server submit only requires a JSON `record` object; it does **not** call `submitBlockers` / `canReachStage`:

```11:30:app/api/implementation/submit/route.ts
export async function POST(request: NextRequest) {
  try {
    const { principal, invitation, attachAuthCookies } = await requireCustomerInvitationApi(request);

    const body = (await request.json()) as { record?: Record<string, unknown> };
    if (!body.record || typeof body.record !== "object") {
      return NextResponse.json({ error: "Missing record" }, { status: 400 });
    }

    const record = {
      ...stripClientAuthorizationFields(body.record),
      invitation_id: invitation.id,
      organisation: invitation.hotelGroupOrBrand || body.record.organisation || "",
      properties: [invitation.propertyName],
      primary_contact: invitation.contactName,
      primary_contact_email: invitation.invitedEmail,
    };

    const submission = await getInvitationService().submitFinal(invitation.id, principal, record);
```

Contrast `/setup` submit, which validates via `submitBlockers` in `lib/implementation/customer/service.ts` (`submitSetup`).

**Reproduction (from code)**

1. Complete OTP bind for an invitation (valid session + cookies).
2. `POST /api/implementation/submit` with `{ "record": {} }`.
3. Expectation for a reliable onboarding API: `400` with completeness errors.  
   Actual: proceeds to `submitFinal` → `200` with `submissionId` (authorization permitting).

Covered indirectly by `tests/invitation-phase3.test.ts` (“does not let user A submit as invitation B”) which posts a sparse `record` and expects `200`.

**Remediation**

- Run the same completeness rules server-side before `insertSubmission` (reuse or share `submitBlockers` / connection completeness from draft payload).
- Reject incomplete payloads with stable error codes.

**Acceptance criteria**

- Incomplete invitation submit returns `400` with a specific blocker message.
- Test matrix: missing PMS, missing contacts, missing connection details → fail; complete draft → pass.

---

### ONB-02 — P1 — Customer property corrections are discarded on invitation submit

**Area:** Data persistence / ownership of submitted record

**Evidence**

UI allows unlocking and editing property name/country/brand (`PropertyScreen` “Something incorrect?”). Edits persist into the draft via `saveDraft`.

Final submit **forces** invitation seed fields for property identity:

```20:27:app/api/implementation/submit/route.ts
    const record = {
      ...stripClientAuthorizationFields(body.record),
      invitation_id: invitation.id,
      organisation: invitation.hotelGroupOrBrand || body.record.organisation || "",
      properties: [invitation.propertyName],
      primary_contact: invitation.contactName,
      primary_contact_email: invitation.invitedEmail,
    };
```

`properties` is always `[invitation.propertyName]`, not the draft’s corrected `properties[0]`.

**Reproduction**

1. Open invitation, complete OTP.
2. Unlock property; change name; continue (draft may store new name).
3. Complete contacts/PMS; submit from Review (Review shows draft name via `reviewSnapshot`).
4. Stored submission `record.properties` equals original invitation `property_name`, not the edited value (same overwrite proven in `tests/invitation-phase3.test.ts` lines asserting `properties: ["Hotel A"]` from invitation).

**Remediation**

- Decide product rule: invitation identity is immutable **or** customer corrections are authoritative.
- If corrections allowed: persist corrected property fields into invitation row or accept draft values on submit; keep Review and stored record identical.
- If immutable: remove unlock/edit UI and show invitation fields as read-only.

**Acceptance criteria**

- Review display and `implementation_submission.record` property fields match.
- Automated test for “Something incorrect?” → submit preserves (or explicitly rejects) corrections per chosen rule.

---

### ONB-03 — P1 — Draft save failures are ignored; navigation continues; “Saved” is false-positive

**Area:** Session recovery / error handling / incomplete submissions

**Evidence**

Property / Contacts / PMS continue even when `saveDraft` throws:

```20:30:components/setup/PropertyScreen.tsx
  async function onContinue() {
    if (!ready) {
      setError(true);
      return;
    }
    try {
      await saveDraft();
    } catch {
      // draft persistence is best-effort in the POC
    }
    router.push(fromReview ? "/implementation/review" : "/implementation/contacts");
  }
```

Same pattern: `ContactsScreen.tsx` (best-effort catch), `PmsScreen.tsx` (best-effort catch).

`CustomerDraftHydrator` always sets `draftId` to `invitation.id`. `CustomerShell` shows **“Saved — you can finish later”** whenever `state.draftId` is set — i.e. after bind, **before** any successful draft upsert.

`IntakeProvider.postJson` throws a generic `Error("Request failed")` with no server message and no retry.

**Impact**

Customer can advance through the wizard with only in-memory React state. Refresh or another device loses progress while UI claimed it was saved. Incomplete server draft + later submit of client-only state (or empty server draft) produces wrong or empty operational records (compounded by ONB-01).

**Remediation**

- Fail closed: block navigation on draft save failure; surface API error.
- Show “Saved” only after successful `POST /api/implementation/draft`.
- Propagate server error body in `postJson`; optional single automatic retry on `503`.

**Acceptance criteria**

- Forced draft `503` → user remains on step with error; no route change.
- “Saved” badge absent until a successful draft write in the session.
- Refresh after successful save restores last step fields from server draft.

---

### ONB-04 — P1 — Invitation credential handoff marks received without storing secrets

**Area:** Persistence / incomplete handoff (functional)

**Evidence**

`POST /api/implementation/credentials` validates secret fields then writes only `credentialsStatus: "received"` into the draft; never encrypts or upserts `implementation_credentials` (`app/api/implementation/credentials/route.ts`). UI notifies “stored securely” (`IntakeProvider.submitCredentials`).

**Impact**

Onboarding reports credentials complete; engineers cannot reveal vaulted secrets for invitation-originated work. Operational follow-up breaks.

**Remediation**

Wire to the same encrypt + store path as `/api/setup/credentials`, or remove the invitation credential UI until wired. Never set `received` without an envelope row.

**Acceptance criteria**

- After handoff, `implementation_credentials` row exists; reveal API works; draft/submission JSON contain no plaintext secrets.

---

### ONB-05 — P2 — Invitation submit is not one database transaction

**Area:** Database transaction consistency

**Evidence**

```204:218:lib/implementation/invitation/service.ts
      const submission = await store.insertSubmission({
        invitationId,
        record: {
          ...record,
          invitation_id: invitationId,
        },
        submittedAt: nowIso(now),
      });

      await store.updateInvitation(invitationId, {
        status: "submitted",
        submittedAt: submission.submittedAt,
        updatedAt: nowIso(now),
      });
```

Two independent PostgREST calls. Unique `(invitation_id)` on `implementation_submission` prevents duplicate rows (`20260831220000_implementation_invitation.sql`).

If insert succeeds and status update fails: submission exists while invitation `status` remains non-`submitted`. Then:

- `saveDraft` only hard-stops when `invitation.status === "submitted"` → drafts may still update.
- Draft route short-circuits only on `invitation.status === "submitted"`.
- `submitFinal` duplicate check also looks up submission → second submit blocked.

**Impact**

Stuck hybrid state: submitted data exists, invitation not marked submitted, UI may still treat flow as editable depending on which signal is read (`loadCustomerIntakeState` ORs both flags — good for read; write path still inconsistent).

**Remediation**

Single SQL/RPC transaction: insert submission + set invitation `submitted` (or status trigger on submission insert). On read/write, treat existing submission as authoritative submitted.

**Acceptance criteria**

- Injected failure after insert cannot leave invitation non-submitted without compensation.
- With existing submission, draft POST is no-op/410 and UI routes to thanks.

---

### ONB-06 — P2 — `/setup` property save and submit are multi-write without a transaction

**Area:** Transaction consistency (`/setup`)

**Evidence**

`saveProperty`: `upsertProperty` → `upsertIntake` → `updateImplementationStatus` (`lib/implementation/customer/service.ts`).  
`submitSetup`: `insertSubmission` → `updateImplementationStatus(..., "submitted")`.

Unique submission per implementation limits duplicates; partial failure can leave property without intake, or submission without `implementations.status = 'submitted'`.

**Remediation**

DB functions wrapping each multi-step transition; or compensating retries with idempotent upserts and status derived from submission presence (resume already uses submission row — align status updates).

**Acceptance criteria**

- Failure mid-`saveProperty` leaves a defined recoverable state documented in tests.
- Resume path and status field never disagree about “submitted”.

---

### ONB-07 — P2 — No server-side stage gating on invitation (or `/setup`) deep links

**Area:** Workflow transitions

**Evidence**

Invitation stage buttons use client `canReachStage`; pages under `(customer)/` only require invitation auth, not stage completeness.  
`/setup` shell uses `canReachSetupStage` client-side; page layouts call `requireCustomerSetupPage` only (auth), not resume-stage enforcement (except `/setup/complete` redirect helper).

**Impact**

User can open `/implementation/review` or `/setup/review` early. Invitation submit may still succeed incomplete (ONB-01). `/setup` submit is protected by server blockers (better).

**Remediation**

Server-side redirect to `resumePath` / first incomplete stage on each step page; optional API checks on draft save for monotonic progress.

**Acceptance criteria**

- Opening a future stage URL without prerequisites redirects to the correct resume step.
- Test coverage for deep-link enforcement.

---

### ONB-08 — P2 — Duplicate invitations for the same email are allowed

**Area:** Duplicate invitations

**Evidence**

`implementation_invitation` uniqueness is on `token_hash` only; index on `lower(invited_email)` is non-unique (`20260831220000_implementation_invitation.sql`).  
`createInvitation` always inserts a new row (`lib/implementation/invitation/service.ts`).

**Impact**

Multiple active invites / binds for one mailbox → ambiguous recovery and support load. Not automatically a double-submit of one invite (per-invite submission unique).

**Remediation**

Policy: revoke prior open invites on re-issue; or partial unique on active statuses; Admin UI lists conflicts.

**Acceptance criteria**

- Documented rule enforced in service + test (e.g. creating a second active invite expires/revokes the first).

---

### ONB-09 — P2 — Generic client errors and no retry on invitation draft/submit

**Area:** Error handling / retries

**Evidence**

`IntakeProvider.postJson` — any non-OK → `throw new Error("Request failed")`. Review maps all failures to a single connection message. No idempotent retry on `503`/`unavailable`.

`/setup` screens generally surface `payload.error` (stronger).

**Remediation**

Parse `{ error, code }`; retry once on `503`; keep submit button double-submit guard (already present via `submitting` ref).

**Acceptance criteria**

- User sees server-provided message for `400`/`410`/`503`.
- Documented retry behavior for transient failures.

---

### ONB-10 — P1 — Stale `bookmax.submitted` blocks a new invitation in the same browser

**Area:** Session recovery / duplicate invitations

**Evidence**

After submit, client persists full intake under `localStorage["bookmax.submitted"]` (`IntakeProvider.tsx`). On `/implementation` (no `initialState`), provider rehydrates from that key. `ImplementationSignIn` then treats `state.submitted` as terminal and `router.replace("/implementation/thanks")` (`ImplementationSignIn.tsx:41-45`, `:166-171`).

Opening a **new** invite only sets `bookmax.invitation` (`invite/[token]/route.ts`); it does not clear `bookmax.submitted` or rotate `bookmax.invitation_claim`. Mismatched claim vs cookie fails `proxy.ts` / `gate.ts` → redirect to `/implementation` → submitted local state → thanks again.

**Reproduction**

1. Complete invitation A through submit (localStorage written).
2. Open invitation B link in the same browser.
3. Observe: cannot complete OTP for B; lands on thanks / redirect loop instead of fresh sign-in.

**Remediation**

- Clear `bookmax.submitted` (and claim) when resolving a new invitation token.
- Prefer server invitation status over localStorage for “already submitted.”
- On sign-in, if invitation cookie ≠ stored submission’s invitation id, ignore local submitted state.

**Acceptance criteria**

- After completing A, invite B shows OTP for B’s email and allows a new flow.
- Automated test covering localStorage submitted + new invitation cookie.

---

### ONB-11 — P1 — “Set up another property” cannot complete on the same invitation

**Area:** Multi-property / recovery UX

**Evidence**

`SuccessScreen.restart` clears client storage and pushes `/implementation/property` without issuing a new invitation (`SuccessScreen.tsx:13-22`). Draft POST on a submitted invitation returns success without writing (`draft/route.ts:58-60`). `submitFinal` throws `duplicate_submission` (`service.ts:197-201`). Review maps that to a generic save error (`ReviewScreen.tsx:49-52`).

**Reproduction**

1. Finish invitation flow → Thanks.
2. Click “Set up another property.”
3. Fill steps → Start implementation → error; no second submission possible.

**Remediation**

- Remove the button, **or** require a new invitation / Admin provision before restart.
- If multi-property is a product goal, create a new implementation/invitation server-side on restart.

**Acceptance criteria**

- Button either absent or starts a server-backed new onboarding record; second submit succeeds only against that new record.

---

### ONB-12 — P1 — Lost submit response leaves Review stuck despite server success

**Area:** Error handling / retries / incomplete submissions

**Evidence**

`submitSetup` only short-circuits when **local** `state.submitted && state.submissionId` (`IntakeProvider.tsx:165-167`). `postJson` throws on any non-OK, including `duplicate_submission`, discarding the body. After server insert succeeds but the browser loses the response (or draft follow-up fails), retry hits unique/duplicate and shows “could not save” while a submission row already exists.

**Remediation**

- On `duplicate_submission` / 400 with that code, fetch owned submission id and treat as success → thanks.
- Make submit API idempotent: return existing `submissionId` when already submitted.
- Prefer atomic submit (ONB-05) so status and row never diverge.

**Acceptance criteria**

- Second click after a successful server submit navigates to thanks with the existing id.
- Test: mock first client failure after server insert; second attempt succeeds idempotently.

---

### ONB-13 — P2 — PMS continue persists stale `connectionDetailsStatus`

**Area:** Data persistence

**Evidence**

`PmsScreen` calls `patch({ connectionDetailsStatus: "complete" })` then immediately `saveDraft()`, which closes over pre-patch `state` (`PmsScreen.tsx:53-55`, `IntakeProvider.tsx:139-147`). Draft can retain `not_started`. Refresh before submit can produce submission records with `connection_details_status: "not_started"` (`selectors.ts` defaults / `toSubmissionRecord`).

**Remediation**

- Pass the next state into `saveDraft(next)` or `await` state flush; or set status inside the save payload explicitly.

**Acceptance criteria**

- After PMS Continue, server draft has `connectionDetailsStatus: "complete"`.

---

### ONB-14 — P1 — Admin-started `/setup` property can be submitted without a PMS access contact

**Area:** Server-side validation / incomplete submissions (`/setup`)

**Evidence**

Admin may save property with only name + contact name (no people payload) — intentional UI copy that customer will finish later (`PropertySetupScreen`; `tests/users-access.test.ts:1760-1792`). Resume with any property row goes to `/setup/pms` (`lib/setup/resume.ts:17-21`), never back to Property for PMS contact.

`submitBlockers` does **not** require technical contact when `sameAsPrimaryContact` is false and tech fields are empty — it only validates email **format if non-empty** (`lib/setup/intake.ts:157-179`). Default intake has `sameAsPrimaryContact: false` and empty tech fields. Thanks still promises contact via `ownerName(...)`, which is empty.

**Reproduction**

1. Admin saves property name + primary contact only.
2. Customer OTP → resumes `/setup/pms` → selects PMS → Connect → Review → Submit.
3. Submission succeeds with empty PMS access contact.

**Remediation**

- Require PMS contact (or `sameAsPrimaryContact: true`) in `submitBlockers` and/or force resume to Property until people complete.
- Optionally require people on customer (non-admin) property POST.

**Acceptance criteria**

- Submit blocked until PMS access contact is complete or explicitly “same as primary.”
- Admin partial save → customer resume returns to Property when people incomplete.
- Regression test for Admin partial → full funnel → submit must fail or force Property.

---

### ONB-15 — P2 — `/setup` Property step lacks post-submit redirect

**Area:** Workflow transitions

**Evidence**

PMS / Connect / Review / Thanks redirect when `submission` exists. `PropertySetupScreen` load effect does not check submission (`PropertySetupScreen.tsx:44-90`); writes later fail with “already submitted.”

**Remediation**

Redirect to `/setup/thanks` (or resume) when submission present, consistent with sibling steps.

**Acceptance criteria**

- Opening `/setup/property` after submit lands on thanks.

---

### ONB-16 — P2 — Invalid/expired invitation query param is never shown

**Area:** Error handling

**Evidence**

Invite route sets `?invite=<code>` on failure (`invite/[token]/route.ts:33-37`). Sign-in UI never reads it; without a cookie it falls back toward `KNOWN_CUSTOMER` email display (`ImplementationSignIn.tsx:39`).

**Remediation**

Render invite error states for `expired` / `revoked` / `invalid` / `not_found`.

**Acceptance criteria**

- Expired link shows a clear message; no fake prefilled demo email.

---

## Multi-property onboarding & ownership

| Claim / expectation | Reality in code |
| --- | --- |
| Multiple properties per customer in one wizard | **Not supported.** Invitation has single `property_name`. `/setup` `properties` table has `unique(implementation_id)`. |
| One customer ↔ one implementation | **Yes** for membership: `implementation_users.user_id` unique. |
| Customer owns only their implementation | **Yes** on `/setup` via `assertOwnsImplementation` / membership. Invitation path owns by `auth_user_id` on invitation, not `implementation_users`. |
| Admin attach/create additional implementations | Access-directory Admin flows can move/create implementations; still one active membership per user. |

**Missing control:** There is no multi-property onboarding product path to validate. Treat “multi-property onboarding” as **out of scope / unimplemented**, not a latent feature.

---

## Controls verified (positive)

| Control | Evidence |
| --- | --- |
| Invite token hashed; raw not stored | `token.ts`, migration comments, phase3 tests |
| OTP bind email match; no rebind to other user | `assertCanBindAuthUser` |
| Invitation page/API ownership gate | `gate.ts`, `requireCustomerInvitationApi` |
| Client cannot spoof invitation id on submit | Submit overwrites `invitation_id`; phase3 cross-invite test |
| One submission per invitation (DB unique + service check) | Migration unique; `submitFinal`; memory/file stores; phase1/3 tests |
| One submission per `/setup` implementation | Unique + `SUBMIT-002` in `tests/m2-api.test.ts` |
| `/setup` server completeness on submit | `submitSetup` + `submitBlockers` (incomplete for PMS contact — ONB-14) |
| `/setup` resume path from rows | `getSetupResumePath` / `/setup/complete` |
| Draft upsert one row per invitation | `unique(invitation_id)` on draft |
| Invitation runtime uses Supabase store | `invitation/runtime.ts`; phase3 wiring test |
| Admin can save property with name + contact only | Intentionally allowed; creates ONB-14 unless customer is forced back |

---

## Missing validation & integrity controls (summary)

| Gap | Severity |
| --- | --- |
| Server completeness on invitation submit | P1 — ONB-01 |
| Submitted property identity vs customer edits | P1 — ONB-02 |
| Fail-closed draft persistence + honest Saved indicator | P1 — ONB-03 |
| Invitation credential vault integrity | P1 — ONB-04 |
| Atomic submit (invitation + `/setup`) | P2 — ONB-05/06 |
| Server stage gating | P2 — ONB-07 |
| Duplicate active invitations policy | P2 — ONB-08 |
| Structured errors / retry | P2 — ONB-09 |
| New invite after prior submit (localStorage) | P1 — ONB-10 |
| “Set up another property” without new invite | P1 — ONB-11 |
| Idempotent submit / lost response recovery | P1 — ONB-12 |
| PMS draft `connectionDetailsStatus` stale save | P2 — ONB-13 |
| `/setup` submit without PMS access contact | P1 — ONB-14 |
| `/setup` property post-submit redirect | P2 — ONB-15 |
| Invite error query param unused | P2 — ONB-16 |

---

## Automated tests — present vs critical gaps

### Present (useful)

- Invitation phase1–3: token hash, bind rules, draft strip of client auth fields, duplicate submission mapping, cross-invitation submit isolation.
- `/setup` m1/m2 API: property/PMS/connect/submit; duplicate submit rejection.
- poc-flow / stage-nav: client navigation UX for invitation stages.
- users-access: Admin property provisioning interactions with setup (including admin partial property → resume `/setup/pms`).

### Critical missing tests

1. Invitation `POST /submit` rejects incomplete records (PMS/contacts/connection).
2. “Something incorrect?” property edit appears in submission record (or is rejected) — locks ONB-02.
3. Draft `503` prevents step navigation; Saved badge false-positive regression.
4. Refresh mid-flow restores server draft (invitation) and `/setup` intake.
5. Partial failure: submission inserted, invitation status update fails → defined recovery.
6. Deep-link to review/pms without prerequisites → redirect.
7. Credential invitation path creates envelope (or endpoint removed).
8. Re-issue invitation for same email — policy assertion.
9. End-to-end invitation browser test against API (not only in-memory service), including OTP verify mocked.
10. `bookmax.submitted` + new invitation cookie → OTP for B, not thanks loop (ONB-10).
11. “Set up another property” blocked or creates new server record (ONB-11).
12. Idempotent submit after lost response / `duplicate_submission` (ONB-12).
13. Admin partial property → customer funnel → submit must require PMS contact (ONB-14).
14. PMS continue persists `connectionDetailsStatus: "complete"` (ONB-13).

---

## End-to-end onboarding readiness verdict

| Path | Verdict |
| --- | --- |
| Invitation → … → Submit | **NOT READY** — P1 gaps ONB-01–04, ONB-10–12 |
| `/setup` provisioned customer | **NOT READY** for Admin-assisted funnel until ONB-14 fixed; otherwise stronger than invitation but still ONB-06/07/15 |
| Overall product onboarding | **NOT READY** until invitation P1s fixed or path retired, and ONB-14 closed on `/setup` |

**Minimum bar to re-review toward acceptance**

1. Fix invitation P1s: ONB-01, ONB-02, ONB-03, ONB-04, ONB-10, ONB-11, ONB-12.  
2. Fix `/setup` ONB-14 (PMS contact required or resume forced to Property).  
3. Add critical tests listed above.  
4. Decide and document primary onboarding path; remove or freeze the other to avoid dual-behavior drift.

Cursor cannot approve its own work. An engineer must verify fixes with failing-then-passing tests and a manual refresh/recovery script, not model claims alone.
