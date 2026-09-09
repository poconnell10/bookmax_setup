# BOOKMAX — ENGINEER ACCESS QA EVIDENCE

Scope: Engineer/Admin access for existing Customer identities. No redesign, no flow change, no Production change.

CANDIDATE SHA: `1fb5a80e37e384053d7848d25acb3979a2100fed`
CANDIDATE BRANCH: `cursor/bookmax-admin-account-type`
APPLICATION CODE: byte-identical to `ee0f522` (`git diff ee0f522 -- app lib components` is empty)
PRODUCTION SHA: `9f53192` — UNCHANGED
PRODUCTION DEPLOYMENT: `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S` — UNCHANGED

---

## 1. IDENTITY RECONCILIATION (PRODUCTION, READ-ONLY)

Both Andy Sena identities are pre-existing, provisioned, active Customers. Neither has an `internal_staff` row.

### `asena@in-gauge.io`

| Field | Value |
|---|---|
| `auth.users.id` | `5d743da8-3879-4a96-aace-d0490df914a5` |
| `auth.users` exists | YES |
| Identity created | `2026-09-04 12:23:12.691354+00` |
| Last sign-in | `2026-09-09 12:38:28.867310+00` |
| `implementation_users.id` | `649b1fde-1ded-4e3d-a497-0c2ceefb4934` |
| `implementation_users.implementation_id` | `cdf25ab3-5ba3-450f-bac7-589db678afdf` |
| Implementation name | Disney's Coranado Springs (spelled thus in Production) |
| `implementation_users.role` | `customer` |
| `implementation_users.status` | `active` |
| Membership created | `2026-09-04 12:23:33.138969+00` |
| `internal_staff` row | **NONE** |
| Account type | Customer |
| Role | Customer |
| Status | Active |

### `asenanewton@frontlinepg.com`

| Field | Value |
|---|---|
| `auth.users.id` | `b226f240-4486-47c8-8864-13437c7aa897` |
| `auth.users` exists | YES |
| Identity created | `2026-09-04 02:32:09.321464+00` (Sep 3, 22:32 Eastern) |
| Last sign-in | `2026-09-04 02:32:35.926169+00` (Sep 3, 22:32 Eastern) |
| `implementation_users.id` | `240c9ac6-f8ef-494a-8124-c60483cd5db2` |
| `implementation_users.implementation_id` | `8d2b4f74-ed5a-493d-9666-130661ca48f9` |
| Implementation name | Grand Floridian |
| `implementation_users.role` | `customer` |
| `implementation_users.status` | `active` |
| Membership created | `2026-09-04 02:32:36.289395+00` |
| `internal_staff` row | **NONE** |
| Account type | Customer |
| Role | Customer |
| Status | Active |

Both are on internal-eligible domains per `INTERNAL_ELIGIBLE_DOMAINS = ["frontlinepg.com", "in-gauge.io"]` (`lib/access/internal-eligibility.ts:7`).

### Why Manage is displayed for both

`toView` (`lib/implementation/access/service.ts:65–96`) finds no staff row, falls through to the membership branch, and returns `accountType='customer'`, `role='customer'`, `status='active'`, `implementationId` set.

- The drawer's Identity line reads "Provisioned" whenever `user.role` is non-null (`components/access/UsersAccessScreen.tsx:186`).
- The row action is `row.status === "pending" ? Provision : Manage` (`:532`, `:564–571`).

An active Customer therefore always renders as Identity = Provisioned with a Manage action. This is correct behaviour, not a defect.

### Why the previous investigation returned zero rows

Exact cause: the earlier query filtered on the literal address `andy@in-gauge.io`, which is the address named in the task specification. That address does not exist in QA or Production, so `select … where lower(u.email)='andy@in-gauge.io'` correctly returned zero rows. Two compounding errors followed:

1. "This address has no identity" was wrongly generalised to "this person requires initial provisioning."
2. The broader enumeration filtered `email like '%in-gauge.io'`, which excluded `asenanewton@frontlinepg.com` from the result set entirely.

The `in-gauge.io` enumeration did report both rows as `has_membership: true, membership_status: active, staff_role: null` — the data was correct and visible; it was never associated with Andy. The conclusion was an identification error, not a data or schema problem.

Side effect to note: a QA `auth.users` row `79032aa0-ddef-4ca5-82c9-b6014e307419` was created for the non-existent address `andy@in-gauge.io` under explicit authorization. It is being reused as the QA conversion fixture (section 5).

---

## 2. CONVERSION SEMANTICS (CTO DECISION)

Ruling: **Internal access replaces Customer authorization.** On conversion the `implementation_users` row is retained for history but set to `status='disabled'`; it is never deleted.

This reverses an intermediate commit. `7df24b6` had removed the disable in response to an earlier instruction that dual membership must be preserved; that instruction is superseded. `1fb5a80` restores the original behaviour, so the candidate's application code equals `ee0f522`.

Implementation: `lib/implementation/access/service.ts:307–309`

```ts
if (membership) {
  await deps.customers.updateMembership(userId, { status: "disabled" });
}
```

Effective authorization flips to Internal regardless, because `resolveAuthorization` (`lib/access/authorization.ts:55`) reads `internal_staff` before `implementation_users`. The disable is what additionally revokes data-API reach, since policy `implementation_users_select_own` requires `status='active'`.

Consequence accepted by this ruling: a converted Customer loses read access to the implementation they previously owned (Grand Floridian, Disney's Coranado Springs). The membership row and its `implementation_id` are preserved, so the conversion is reversible via Manage → Change account type → Customer, which reactivates the same row (`service.ts:336–340`).

---

## 3. CAPABILITY BY SHA

| Layer | `9f53192` (Production) | `1fb5a80` (candidate) |
|---|---|---|
| `service.ts` handles `action === "accountType"` | 0 occurrences | present |
| `app/api/implementation/users/route.ts` accepts `accountType` action | NO — only `role`, `disable`, `reactivate`, `assign` | YES (`route.ts:94–101`) |
| Manage drawer exposes conversion (`onConvertInternal`) | 0 occurrences | 4 occurrences (`UsersAccessScreen.tsx:916–934`) |
| Manage drawer sections | Access now · Change role (internal only) · Implementation · Access history | adds Change account type |
| Engineer role offered on conversion | NO | YES |
| Admin role offered on conversion | NO | YES |
| `ACCOUNT_TYPE_CHANGED` audit event | NO | YES (`service.ts:310–316`) |

The "Account type" heading present at `9f53192:742` is inside `ProvisionBody`, not `ManageBody` — it is the provision-time choice, not a conversion control.

Capability introduced by `dd55dc8` ("feat: let Admins convert account type between Customer and Internal"), which landed after Production shipped `9f53192`. This is the confirmed Production gap.

---

## 4. AUTOMATED TEST EVIDENCE

`npx vitest run` — **218 passed / 0 failed** (25 files). `npx tsc --noEmit` — clean.

The vitest fixtures already begin in the same authorization state as the two Production accounts: both are seeded via `customer.ensureForUser` + `saveProperty`, giving Customer / Active with an implementation on an internal-eligible domain.

| Fixture | Email | Mirrors |
|---|---|---|
| `gauge-1` | `asena@in-gauge.io` | Identity 1 (Disney's Coronado Springs) |
| `fpg-customer` | `alex@frontlinepg.com` | Identity 2's domain and state (frontlinepg.com, Customer/Active) |

Coverage added in `1fb5a80` (`tests/users-access.test.ts`):

1. `admin can convert an existing customer to Internal / Engineer` — asserts `accountType='internal'`, `role='engineer'`, `status='active'`; `implementation_users.status='disabled'` with `implementation_id` retained; `landingPath` = `/implementation/submissions`; submissions API 200; users API 403; setup context 403.
2. `admin can convert an active frontlinepg.com customer to Internal / Engineer` — new test, same assertions against `fpg-customer`.
3. `admin can convert an eligible customer to Internal / Admin` — asserts `accountType='internal'`, `role='admin'`, `status='active'`; `implementation_users.status='disabled'` with `implementation_id` retained; `landingPath` = `/implementation/users`.

Before `1fb5a80` no test asserted the membership outcome of a conversion at all, in either direction. The semantics are now pinned.

---

## 5. QA DEPLOYMENT EVIDENCE

| Item | Value |
|---|---|
| Preview deployment ID | `dpl_EUbTLaVFS3EzAp6addxnssJ8Pk7r` |
| Preview SHA | `1fb5a80` |
| Preview branch | `cursor/bookmax-admin-account-type` |
| Ready state | READY |
| Branch URL | `https://bookmax-setup-git-cursor-bookmax-admin-account-type-fpg1.vercel.app` |
| Deployment URL | `https://bookmax-setup-52qvgx8e7-fpg1.vercel.app` |
| Production alias added | NO |
| `origin/main` | `9f53192` — UNCHANGED |
| Superseded previews | `dpl_E4HW1EPg3CYR5cwN84SBaeQuMJV1` (`7df24b6`), `dpl_7PGiMhC8cuQ6NVkcoaapXduKw1gk` (`ee0f522`) |

### QA Supabase binding (Gate 1) — PASS

Two independent proofs that the preview talks only to QA (`rnnlceroqzmxovsynzni`), never Production (`coovxqyommehcteisoqy`):

1. `GET {preview}/api/supabase/health` at `2026-09-09T13:36:30Z` returned `{"ok":true,"clientInitialized":true,"projectReachable":true}`. The QA project's `edge_logs` show the matching probe pair: `GET /auth/v1/health` → 200 at `13:36:30.786`, `GET /rest/v1/_bookmax_connectivity_check` → 404 at `13:36:30.926`.
2. `POST {preview}/api/access/otp/send` returned `Set-Cookie` names namespaced `sb-rnnlceroqzmxovsynzni-auth-token-*`.

### QA conversion fixture

QA holds no eligible-domain Customer/Active identity, so one must be built. Approved approach: reuse `79032aa0-ddef-4ca5-82c9-b6014e307419` (`andy@in-gauge.io`, currently pending).

| Item | Value |
|---|---|
| Request | `POST {preview}/api/access/otp/send` `{"email":"andy@in-gauge.io"}` |
| Sent at | `2026-09-09T13:37:27Z` |
| HTTP status | 200, `{"ok":true,"throttled":false}` |
| QA `auth.users` row | `79032aa0-ddef-4ca5-82c9-b6014e307419` |
| `confirmation_sent_at` | `2026-09-09 13:37:28.339686+00` |
| `email_confirmed_at` | null |
| Inbox receipt | **NOT PROVEN** — engineering cannot read the recipient inbox |

Provisioning that row as a Customer is fixture setup, not the capability under test. The capability under test is Manage → Change account type.

Because that row is a brand-new identity, Auth used the **Confirm signup** template rather than Magic Link. Whether the QA Confirm-signup template carries a 6-digit `{{ .Token }}` was not verifiable this session (no Supabase management token available).

Other QA identities: `poconnell@frontlinepg.com` (`ed596ee2`, admin, active, also holds an active membership), `bookmaxg6a@yopmail.com` (`8212f5b9`, engineer, active, no membership), one `ieggroup.net` and two `yopmail.com` customers — none on an eligible domain, so none can be offered Internal.

---

## 6. PRODUCTION MIGRATION GAP (BLOCKS RELEASE)

Conversion writes audit event `ACCOUNT_TYPE_CHANGED` (`service.ts:311`), permitted only by `supabase/migrations/20260909003254_access_account_type_changed.sql`.

| Environment | Latest applied migration | `access_account_type_changed` |
|---|---|---|
| QA `rnnlceroqzmxovsynzni` | `20260909004154 access_account_type_changed` | PRESENT |
| Production `coovxqyommehcteisoqy` | `20260908195737 disabled_customer_active_membership_rls` | **MISSING** |

Any conversion attempted on Production before this migration is applied will fail the audit check constraint. This is a Production database change requiring approval separate from the application release.

The QA copy was applied out-of-band as version `20260909004154` while the repository file is `20260909003254`, so a `supabase db push` against Production will apply `20260909003254`.

---

## 7. AUDIT / DATA SAFETY (GATE 9)

Production was read-only throughout. Neither Andy Production account was converted or modified. Counts after all work:

| Table | Production count |
|---|---|
| `auth.users` | 43 |
| `internal_staff` | 1 |
| `implementation_users` | 18 |
| `implementations` | 18 |
| `access_audit_events` | 0 |

No Production writes, no Production deployment, no Production alias, no DNS change, no Auth configuration change, no environment variable change, no merge or push to `main`. No service-role or admin token was used to mint or verify an OTP. No credentials or OTP values appear in this report.

---

## 8. FINAL QA UAT

### Phase 1 — Source / deployment integrity: **PASS**

| Check | Value |
|---|---|
| Branch | `cursor/bookmax-admin-account-type` |
| HEAD | `1fb5a80e37e384053d7848d25acb3979a2100fed` |
| Tracked working tree | clean (`git status --porcelain --untracked-files=no` empty) |
| Untracked | evidence `.md` files, `.cursor/rules/…`, `supabase/.temp/cli-latest` — no source files |
| `origin/main` | `9f53192cd8af32924021a2cd1bea541ec098ad2c` |
| Candidate preview | `dpl_EUbTLaVFS3EzAp6addxnssJ8Pk7r`, target ≠ production, READY |
| Candidate preview SHA | `1fb5a80e37e384053d7848d25acb3979a2100fed` |
| Candidate preview aliases | `bookmax-setup-git-cursor-bookmax-admin-account-type-fpg1.vercel.app` only |
| Production alias on candidate | **NONE** |
| Production deployment | `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S`, target `production`, READY |
| Production SHA | `9f53192cd8af32924021a2cd1bea541ec098ad2c`, branch `main` |
| Production aliases | `bookmax-setup-fpg1.vercel.app`, `bookmax-setup-git-main-fpg1.vercel.app` |

Alias resolution via the Vercel API confirms hostname ownership rather than inferring it:

- `GET /v13/deployments/implementation.bookmax.ai` → `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S`, target `production`, SHA `9f53192`.
- `GET /v13/deployments/bookmax-setup-git-cursor-bookmax-admin-account-type-fpg1.vercel.app` → `dpl_EUbTLaVFS3EzAp6addxnssJ8Pk7r`, target not production, SHA `1fb5a80`.

The two hostnames resolve to different deployments. The candidate cannot serve Production traffic.

### Phase 2 — QA isolation: **PASS**

Runtime evidence for the `1fb5a80` deployment specifically, not configuration inspection.

Probe: `GET {branch alias}/api/supabase/health` at marker `2026-09-09T14:11:03Z` → `200 {"ok":true,"clientInitialized":true,"projectReachable":true}`.

Positive correlation in QA project `rnnlceroqzmxovsynzni` `edge_logs`:

| Timestamp | Path | Status | Proves |
|---|---|---|---|
| `14:11:04.570` | `GET /auth/v1/health` | 200 | Preview → QA Auth (GoTrue) |
| `14:11:09.721` | `GET /rest/v1/_bookmax_connectivity_check` | 404 | Preview → QA PostgREST → QA Postgres schema cache |

Negative correlation in Production project `coovxqyommehcteisoqy` `edge_logs`, identical query and window (`14:05:00Z` onward): **zero rows**. No probe from the candidate reached Production Supabase.

Supporting evidence from the same preview environment scope: the OTP send at `13:37:27Z` returned `Set-Cookie` names namespaced `sb-rnnlceroqzmxovsynzni-auth-token-*`.

Chain proven: Preview → QA Auth → QA Postgres. Chain disproven: Preview → Production Supabase.

### Phase 3 — QA Admin authentication: **BLOCKED**

Blocked solely because human OTP entry is required. No Admin session exists and none can be created by engineering:

- The QA Admin is `poconnell@frontlinepg.com` (`ed596ee2`, `internal_staff.role='admin'`, `status='active'`).
- Authentication requires a 6-digit code delivered to that inbox, then entry at `/access/verify`.
- Control Gate 4 forbids `admin generateLink`, service-role generated OTP, and manually inserted tokens as proof.
- Control Gate 10 states this cannot be passed by engineering on behalf of the CTO.

No OTP was already available, and no additional OTP was sent during this phase.

### Phase 4 — Customer fixture: **FAIL (not built)**

Starting state recorded read-only for `79032aa0-ddef-4ca5-82c9-b6014e307419`:

| Field | Value |
|---|---|
| Email | `andy@in-gauge.io` |
| Created | `2026-09-09 13:37:28.325376+00` |
| `email_confirmed_at` | null |
| `last_sign_in_at` | null |
| `implementation_users` | **no row** |
| `internal_staff` | **no row** |
| Effective state | pending / unprovisioned |

The fixture does not yet match Andy's Production starting state. It needs `implementation_users` with `role='customer'`, `status='active'` and an assigned implementation. Building it requires an authenticated Admin using the Provision flow, which is blocked by Phase 3. Direct SQL insertion was deliberately not used: Phase 6 forbids manual DB manipulation to force a test, and it would invalidate the UAT.

No other QA identity is a valid substitute. QA holds one `ieggroup.net` and two `yopmail.com` customers, none on an internal-eligible domain, so none can be offered Internal; the only `frontlinepg.com` identity is the Admin itself.

### Phase 5 — Live QA Customer → Engineer: **BLOCKED**

Cannot be executed. Depends on Phase 3 (Admin session) and Phase 4 (fixture). No UI journey, request capture, database transition, authorization check, or audit record was produced. Deliberately not simulated at service level, per the phase instruction.

### Phase 6 — Safe fixture reset: **NOT REQUIRED**

No conversion occurred, so no reset is needed. Reversibility is implemented (`service.ts:320–358`: staff row removed via `deps.staff.remove`, membership reactivated in place with `status='active'` and the retained `implementation_id`, `ACCOUNT_TYPE_CHANGED` written) and is covered by the test `admin can convert Internal / Engineer back to Customer with an implementation`. It is not yet proven live.

### Phase 7 — Live QA Customer → Admin: **BLOCKED**

Same dependency chain as Phase 5.

### Phase 8 — Regression / negative tests: **FAIL**

Counts: **218 passed / 0 failed**, 25 files. `npx tsc --noEmit` clean. This matches the expected baseline exactly.

Test count moved from 217 to 218 because `1fb5a80` adds one test, `admin can convert an active frontlinepg.com customer to Internal / Engineer`, mirroring the `asenanewton@frontlinepg.com` Production state. Three existing conversion tests also gained membership-outcome assertions. No test was removed or weakened.

Requirement-by-requirement:

| Required scenario | Status | Evidence |
|---|---|---|
| Customer cannot promote self | COVERED | `19-20. role and user_id spoofing cannot grant admin APIs`; `9-12. only a real admin can list users`; `requireAdmin` (`internal/auth.ts:52`) |
| Customer cannot access internal pages | COVERED | `1. unauthenticated internal access is denied`; `22-25. submissions stay role-scoped` |
| Engineer cannot perform Admin-only action | COVERED | Both Engineer conversion tests assert `/api/implementation/users` → 403; `26. viewer cannot reveal credentials` |
| Invalid role rejected | COVERED | `isRole` guard (`app/api/implementation/users/route.ts:9–11`); `enforces Internal domain eligibility on provision and conversion` asserts 400 |
| Invalid account type rejected | COVERED | Action parser returns null → 400 (`route.ts:94–107`); same test asserts 400 for an ineligible-domain conversion |
| Dual active Customer + Internal prevented | COVERED | All three conversion tests assert `implementation_users.status === 'disabled'`; `8. internal membership wins over customer mapping` |
| Failed conversion cannot leave partial state | **NOT MET** | See below |
| Duplicate internal membership handled | PARTIAL | `internal_staff` PK is `user_id` and writes go through `upsert`, making repeat conversion idempotent; exercised indirectly by `16-18. admin can promote, disable, and reactivate`, with no dedicated test |
| Disable access still works | COVERED | `16-18. admin can promote, disable, and reactivate` |
| Implementation reassignment still works | **NOT COVERED** | `action: "assign"` is implemented (`service.ts:362–374`) but has no test in any suite. Unchanged since `9f53192`, so this is a pre-existing coverage gap, not a regression. |
| Existing Customer access unaffected | COVERED | `3. customer OTP resumes the customer setup path` |
| Existing Admin access unaffected | COVERED | `6. admin OTP routes to Users & Access`; `21. the last active Admin cannot be disabled or downgraded` |
| Audit required for account conversion | COVERED | `tests/users-access.test.ts:673–674` asserts an `ACCOUNT_TYPE_CHANGED` event on the converted user's audit feed |

#### Partial-state defect (why Gate 8 is FAIL)

The internal-conversion branch performs three sequential writes with no transaction, and the audit write is last (`lib/implementation/access/service.ts:301–316`):

1. `deps.staff.upsert(...)` → creates/activates `internal_staff`
2. `deps.customers.updateMembership(userId, { status: "disabled" })` → disables the customer membership
3. `deps.audit.insert({ eventType: "ACCOUNT_TYPE_CHANGED", ... })` → governance record

These are three separate PostgREST calls, so no cross-statement transaction is possible in the current design. If step 3 fails, steps 1 and 2 have already committed: the user is converted and their customer membership is disabled, with no audit record, and the API returns 500.

This is not hypothetical on Production today. The Production `access_audit_events_event_type_check` constraint does not permit `ACCOUNT_TYPE_CHANGED`, so a conversion attempted against Production before the migration is applied would produce exactly this partial state.

Mitigation already in the release plan: the migration is applied strictly before the application deploy, after which step 3 succeeds and the window closes for this cause. The general non-atomicity remains for other step-3 failures (connectivity, timeout). No schema or code change is proposed here — that would exceed the approved scope and require its own review.

---

## 9. MIGRATION SAFETY

File: `supabase/migrations/20260909003254_access_account_type_changed.sql`

Full content is two statements:

```sql
alter table public.access_audit_events
  drop constraint if exists access_audit_events_event_type_check;

alter table public.access_audit_events
  add constraint access_audit_events_event_type_check check (
    event_type in (
      'USER_PROVISIONED',
      'ROLE_CHANGED',
      'ACCESS_DISABLED',
      'ACCESS_REACTIVATED',
      'CUSTOMER_ASSIGNMENT_CHANGED',
      'ACCOUNT_TYPE_CHANGED'
    )
  );
```

**1. Exact object changed.** One CHECK constraint, `public.access_audit_events.access_audit_events_event_type_check`. No other object.

**2. Exact change.** The allowed `event_type` set widens from five values to six by appending `ACCOUNT_TYPE_CHANGED`. Verified against both live databases:

| Environment | Live constraint definition |
|---|---|
| Production `coovxqyommehcteisoqy` | `CHECK ((event_type = ANY (ARRAY['USER_PROVISIONED','ROLE_CHANGED','ACCESS_DISABLED','ACCESS_REACTIVATED','CUSTOMER_ASSIGNMENT_CHANGED'])))` |
| QA `rnnlceroqzmxovsynzni` | `CHECK ((event_type = ANY (ARRAY['USER_PROVISIONED','ROLE_CHANGED','ACCESS_DISABLED','ACCESS_REACTIVATED','CUSTOMER_ASSIGNMENT_CHANGED','ACCOUNT_TYPE_CHANGED'])))` |

The QA definition is the Production definition plus one element, in the same order. This is a pure widening.

Production's other constraints on the table are untouched and remain: `access_audit_events_pkey`, `access_audit_events_new_object`, `access_audit_events_previous_object`.

**3. No destructive table drop.** No `drop table`, no `truncate`. The only `drop` is `drop constraint if exists` on the constraint being immediately replaced.

**4. No column loss.** No `drop column`, no `alter column`, no type change.

**5. No data rewrite.** No `update`, `delete` or `insert`. Adding a widened CHECK validates existing rows; every row that satisfied the five-value constraint satisfies the six-value constraint, so validation cannot fail. Production `access_audit_events` currently holds 0 rows, so validation is trivially satisfied regardless.

**6. `9f53192` remains compatible after the migration.** `9f53192` writes only `USER_PROVISIONED`, `ROLE_CHANGED`, `ACCESS_DISABLED`, `ACCESS_REACTIVATED` and `CUSTOMER_ASSIGNMENT_CHANGED` — all still permitted. It has no code path that writes `ACCOUNT_TYPE_CHANGED` (zero occurrences of `action === "accountType"` in `9f53192:lib/implementation/access/service.ts`), and it never reads the constraint definition.

**7. `1fb5a80` requires the migration.** `service.ts:311` writes `eventType: "ACCOUNT_TYPE_CHANGED"` on every internal conversion. Without the migration that insert violates the constraint, producing the partial state described in section 8.

**8. Safe to apply before the application deploy.** Yes, and it must be. Because the change is a widening and `9f53192` never emits the new value, the migration is a no-op for the currently deployed application. Applying it first eliminates the partial-state window that would otherwise exist between deploy and migration.

**9. Rollback implications.** Rolling the application back to `9f53192` while leaving the widened constraint in place is safe and requires no database action — the constraint permits a superset of what `9f53192` writes. Reverting the migration itself (re-narrowing to five values) would only succeed while no `ACCOUNT_TYPE_CHANGED` rows exist; once a conversion has been recorded, re-narrowing would fail constraint validation. Production currently has 0 rows in `access_audit_events`, so the migration is reversible today and becomes effectively irreversible after the first Production conversion. Recommendation: treat the migration as forward-only and roll back the application independently if needed.

MIGRATION BACKWARD COMPATIBLE WITH 9f53192: **YES**
MIGRATION REQUIRED BEFORE 1fb5a80: **YES**
MIGRATION DESTRUCTIVE: **NO**

GATE 9 — MIGRATION SAFETY: **PASS**

---

## 10. ROLLBACK PLAN

| Item | Value |
|---|---|
| Current Production deployment | `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S` (SHA `9f53192`, branch `main`) |
| Rollback target SHA | `9f53192cd8af32924021a2cd1bea541ec098ad2c` |
| Preceding `main` commits | `9068467` ("Match Submissions to the approved HTML…"), `e7edfb3` ("Stack Manage Access identity labels…") |
| Application rollback process | Vercel → promote `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S` back to Production (instant alias repoint, no rebuild) |
| Application rollback compatible with the new migration | **YES** — proven in section 9, item 6 |
| Database rollback required on application rollback | **NO** |
| Migration rollback | Possible only while `access_audit_events` has no `ACCOUNT_TYPE_CHANGED` rows; treat as forward-only |
| Data-loss risk | None identified — the migration neither drops nor rewrites data |

Release design satisfies the preferred pattern: the migration is additive and backward compatible, so the application can roll back independently.

---

## 11. CTO RELEASE GATE

| Gate | Status | Evidence |
|---|---|---|
| Source integrity | PASS | HEAD `1fb5a80`, tracked tree clean, `origin/main` `9f53192`, candidate preview has no Production alias (section 8, Phase 1) |
| QA isolation | PASS | `1fb5a80` probe correlated in QA `edge_logs` at `14:11:04.570`/`14:11:09.721`; zero rows in Production logs for the same window (section 8, Phase 2) |
| Admin authentication | BLOCKED | Requires human OTP entry for `poconnell@frontlinepg.com`; Control Gates 4 and 10 forbid engineering substitutes |
| Customer fixture | FAIL | `79032aa0` is still pending — no `implementation_users`, no `internal_staff`; building it needs the blocked Admin session |
| Customer → Engineer | BLOCKED | Depends on Admin authentication and fixture |
| Engineer authorization | BLOCKED live / PASS unit | Tests assert submissions 200, users 403, setup context 403; not exercised on the deployed preview |
| Engineer audit | BLOCKED live / PASS unit | `ACCOUNT_TYPE_CHANGED` asserted at `tests/users-access.test.ts:673–674`; no live record |
| Customer → Admin | BLOCKED | Depends on Admin authentication and fixture |
| Admin authorization | BLOCKED live / PASS unit | `6. admin OTP routes to Users & Access`; `landingPath` → `/implementation/users`; not exercised live |
| Admin audit | BLOCKED live / PASS unit | Same as Engineer audit |
| Negative tests | FAIL | "Failed conversion cannot leave partial state" is not met (non-transactional conversion, audit write last); implementation reassignment untested (section 8, Phase 8) |
| Regression tests | PASS | 218 passed / 0 failed, 25 files; `tsc --noEmit` clean |
| Migration safety | PASS | Section 9; widening-only CHECK change, backward compatible, non-destructive |
| Production unchanged | PASS | `implementation.bookmax.ai` resolves to `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S` at SHA `9f53192`; Production migration still absent; Production counts unchanged (section 7) |

READY FOR CTO PRODUCTION APPROVAL: **NO**

---

## 12. PRODUCTION RELEASE

**NOT EXECUTED.** No migration applied, no merge, no deploy, no alias change, no Production modification. Phase 12 requires explicit CTO approval that has not been given, and three gates are not PASS.

---

## 13. PRODUCTION SMOKE TEST

**NOT EXECUTED.** Blocked by section 12.

---

## 14. FIRST CONVERSION EVIDENCE

**NOT EXECUTED.** Blocked by section 12. Neither `asena@in-gauge.io` nor `asenanewton@frontlinepg.com` was modified at any point; both remain Customer / Active with their original memberships (section 1).

---

## 15. ATOMIC ACCOUNT CONVERSION RCA + FIX

Candidate advanced from `1fb5a80` to **`93eeeba`** on the same branch. `origin/main` is unchanged at `9f53192`.

### 15.1 Root cause

`lib/implementation/access/service.ts` executed the conversion as three independent PostgREST statements, each committing on its own, with the governance record written last:

1. `deps.staff.upsert(...)` — create/activate `internal_staff`
2. `deps.customers.updateMembership(userId, { status: "disabled" })` — disable the customer membership
3. `deps.audit.insert({ eventType: "ACCOUNT_TYPE_CHANGED", ... })` — write the audit event

A failure on step 3 could not undo steps 1 and 2. The caller received a 500 while the identity was already converted, its customer membership already disabled, and no governance record existed. This is reachable on Production today because its `access_audit_events_event_type_check` constraint does not yet permit `ACCOUNT_TYPE_CHANGED`.

### 15.2 Proof of the defect, against real Postgres

Run on QA (`rnnlceroqzmxovsynzni`) with the audit constraint temporarily narrowed to the six-value Production form, using fixture `5d211dce-4804-4afe-86c3-d803efd5c6e9` (Customer / Active on implementation `6950075e-df22-41ad-b52f-c393ee0fa78f`) and actor `ed596ee2-…` (Admin / Active).

Emulating the old three-write sequence:

| Observation | Result |
|---|---|
| Audit insert | raised `23514` check-constraint violation |
| `internal_staff` after | `engineer/active` — **committed** |
| `implementation_users` after | `disabled` — **committed** |
| `access_audit_events` rows | `0` |

That is the partial state: internal authorization live, customer access revoked, no governance record. The emulated writes were undone in the same transaction; nothing persisted in QA.

### 15.3 Fix

New migration `supabase/migrations/20260909143000_atomic_account_type_change.sql` creates `public.access_change_account_type(p_actor_user_id, p_target_user_id, p_account_type, p_role, p_implementation_id)`. It is a single `plpgsql` statement, so the membership transition and the audit event commit together or not at all. It:

- validates the account type and role, and that the target identity exists;
- re-checks caller authorization directly against `internal_staff` (`role='admin'` and `status='active'`), independent of the API layer and the UI;
- for Customer → Internal: upserts `internal_staff` active with the selected role, then sets the existing `implementation_users` row to `disabled` while keeping its `implementation_id`;
- for Internal → Customer: deletes the `internal_staff` row and reactivates or creates the membership;
- writes `ACCOUNT_TYPE_CHANGED` with the before/after snapshot;
- raises on any failure, rolling the whole transition back.

Security: `SECURITY INVOKER` (not definer). ACL verified as `postgres=X/postgres | service_role=X/postgres` — `public`, `anon`, and `authenticated` hold no `EXECUTE`, so the function is not reachable from the Data API. The `internal_staff_last_admin` trigger remains the backstop for last-admin protection and now fires inside the same transaction.

Application: `lib/implementation/access/transition-store.ts` defines the `AccessTransitionStore` port; `supabase-transition-store.ts` calls the RPC and maps `forbidden:` / `not_found:` / `invalid_input:` to the existing `InternalError` codes. `service.ts` now makes exactly one call per conversion instead of three writes. Email-domain eligibility stays in the application layer, unchanged and unduplicated in SQL.

### 15.4 Proof of the fix, against real Postgres

**Provenance.** The function body deployed in QA is byte-identical to the migration file: `md5(prosrc) = 71407283f929ab2a9f7ac0ea2e152852`, length `4217`, matching the file's body exactly. `prosecdef = false`, `proacl = postgres=X/postgres | service_role=X/postgres`. An earlier apply differed by inline comments only; it was replaced verbatim from the file and every result below was re-run against the matching version.

Same fixture, same narrowed constraint, calling the real function:

| Observation | Result |
|---|---|
| Call | raised `23514` on the audit insert |
| `internal_staff` after | **NO ROW** |
| `implementation_users` after | **`active`**, `impl=6950075e-…` |
| `access_audit_events` rows | `0` |

Nothing persisted and the original Customer authorization survived intact — requirement B.

With the constraint restored, on the same fixture:

| Case | Result |
|---|---|
| Non-Admin (Engineer) actor | refused `42501`, no state change |
| Customer promoting self | refused `42501`, no state change |
| Invalid role `superuser` | refused `22023` |
| Invalid account type `partner` | refused `22023` |
| Unknown target identity | refused `P0002` |
| State after all rejections | no `internal_staff` row; membership still `active` |
| Customer → Internal / Engineer | `internal_staff` `engineer/active`; membership `disabled` with `impl` retained; audit `{customer, active, impl}` → `{internal, engineer, active}` |
| Internal → Customer | `internal_staff` removed; membership `active` with same `impl`; second audit row |
| Dual active membership | never observed; staff active and customer active are mutually exclusive at commit |

QA was returned to baseline and verified: `access_audit_events_event_type_check` present, `convalidated = true`, six values including `ACCOUNT_TYPE_CHANGED`; fixture `5d211dce-…` back to Customer / Active on implementation `6950075e-…` with no `internal_staff` row; `to_regclass('public._atomicity_probe')` returns null. The `ACCOUNT_TYPE_CHANGED` rows from the round trips were retained deliberately — audit history is not deleted.

The constraint narrowing was done inside single transactions using `NOT VALID`, so existing audit rows were never revalidated and the narrowing could not outlive the probe. One earlier attempt without `NOT VALID` failed on those existing rows and rolled the entire block back, which independently demonstrates that the probe could not leave QA in a narrowed state.

### 15.5 Reverse path

Internal → Customer was also multi-write (staff delete, membership reactivate/insert, audit insert) and carried the same defect. It routes through the same function and is covered by the same guarantee, proven above.

### 15.6 Test coverage

`225 passed / 0 failed` (was 218). Seven added, none removed or weakened:

- three parameterized cases forcing failure at the staff, membership, and audit stages — each asserts no `internal_staff` row, membership still `active` with its implementation, no `ACCOUNT_TYPE_CHANGED` event, and that `resolveAuthorization` still returns `customer`;
- reverse-conversion failure leaves `internal_staff` `engineer/active` and no membership;
- no commit leaves both Customer and Internal active, for Engineer and Admin;
- the service performs a conversion as exactly one transition call and writes nothing itself, guarding against regression to independent writes;
- non-Admin conversion attempts (self-promotion, Engineer, Viewer) are refused 403 with no state change.

The in-memory double raises injected failures before applying any mutation, so a partial state is unrepresentable in it. It tests the service contract, not Postgres. The transactional guarantee itself is evidenced by 15.4 against the live QA database.

### 15.7 Migration ordering and compatibility

`20260909003254_access_account_type_changed.sql` stays separate and must be applied first. The new migration only creates a function, so it applies cleanly in any order, but a conversion attempted before the constraint is widened will raise and roll back rather than corrupt state — the safe failure, now proven.

Both migrations are backward compatible with `9f53192`: one widens a CHECK constraint to accept an additional value, the other adds a function that `9f53192` never calls. Neither drops or rewrites anything. Application rollback to `9f53192` remains safe with both applied.

### 15.8 Known residual — other multi-write paths, scoped out

The fix covers account-type conversion in both directions, which is what was ruled a release blocker. The same non-transactional shape still exists elsewhere in `lib/implementation/access/service.ts` and was deliberately left alone under the "smallest safe change" instruction:

| Path | Writes | Audit event |
|---|---|---|
| `disable` (lines 243–254) | `staff.upsert` + `customers.updateMembership` + `audit.insert` | `ACCESS_DISABLED` |
| `reactivate` (lines 266–277) | `staff.upsert` + `customers.updateMembership` + `audit.insert` | `ACCESS_REACTIVATED` |
| `provision` (lines 153–184) | membership or staff write + `audit.insert` | `USER_PROVISIONED` |
| `role` (lines 219–225) | `staff.upsert` + `audit.insert` | `ROLE_CHANGED` |
| `assign` (lines 329–330) | `customers.updateMembership` + `audit.insert` | `CUSTOMER_ASSIGNMENT_CHANGED` |

`disable` and `reactivate` have the identical three-write shape with the audit insert last, so a failure there can still leave an access change applied without a governance record.

The material difference is exposure. The conversion defect was reachable on Production today, because the audit constraint rejects `ACCOUNT_TYPE_CHANGED` and every conversion would have hit it. These five events are already permitted by the Production constraint, so the equivalent failure requires an unrelated fault — a lost connection or a database error mid-sequence. Lower likelihood, same consequence.

This is a decision for the CTO: accept the residual for this release, or extend the same pattern to `disable` and `reactivate` before Production. It is not fixed in `93eeeba`.

---

## 16. ATOMIC DISABLE + REACTIVATE

Candidate advanced from `93eeeba` to **`79f8f7d`** on the same branch. `origin/main` unchanged at `9f53192`.

### 16.1 Correction to section 15.8

Section 15.8 reported Disable and Reactivate as three writes. That was wrong, and the count matters for the RCA. Reading `lib/implementation/access/service.ts` at `93eeeba`, the staff and membership writes are the two arms of an `if / else if`, so exactly one authorization write executes, followed by the audit insert. Both paths are **two** writes, not three. Non-atomic either way; the corrected trace is below.

### 16.2 Disable — old path at `93eeeba`

```text
DISABLE CURRENT WRITE 1:
if (staff)      deps.staff.upsert({ userId, role: staff.role, status: "disabled", provisionedBy: actor.userId })
else            deps.customers.updateMembership(userId, { status: "disabled" })
                (service.ts:242-253 — mutually exclusive branches, one write executes)

DISABLE CURRENT WRITE 2:
deps.audit.insert({ eventType: "ACCESS_DISABLED", ... })   (service.ts:254-260)

DISABLE CURRENT WRITE 3:
none

AUDIT POSITION:
last, as a separate PostgREST request

ATOMIC:
NO

PARTIAL STATE POSSIBLE:
YES
```

Partial state if the audit write fails: the target's authorization is already `disabled` — internal staff cannot reach `/implementation/*`, or the customer cannot reach `/setup/*` — while no `ACCESS_DISABLED` record exists and the API returns 503. Access is revoked with no governance trail.

### 16.3 Reactivate — old path at `93eeeba`

```text
REACTIVATE CURRENT WRITE 1:
if (staff)      deps.staff.upsert({ userId, role: staff.role, status: "active", provisionedBy: actor.userId })
else            deps.customers.updateMembership(userId, { status: "active" })
                (service.ts:265-276)

REACTIVATE CURRENT WRITE 2:
deps.audit.insert({ eventType: "ACCESS_REACTIVATED", ... })   (service.ts:277-283)

REACTIVATE CURRENT WRITE 3:
none

AUDIT POSITION:
last, as a separate PostgREST request

ATOMIC:
NO

PARTIAL STATE POSSIBLE:
YES
```

Partial state if the audit write fails: access is restored and the identity can sign in again, with no `ACCESS_REACTIVATED` record and a 503 to the caller. This is the more serious direction — access is granted with no governance trail.

### 16.4 Existing semantics, preserved not redefined

`resolveAuthorization` (`lib/access/authorization.ts:64-98`) treats **any** `internal_staff` row as authoritative and only falls through to `implementation_users` when no staff row exists. A disabled staff row therefore shadows a customer membership entirely. Both service branches follow the same precedence, so the rule is consistent and was carried into SQL unchanged.

| Account Type | Operation | Before | After | Role Preserved | Implementation Preserved | Audit Event |
|---|---|---|---|---|---|---|
| Customer | Disable | `implementation_users.status='active'` | `='disabled'` | n/a (`role='customer'` fixed) | YES — `implementation_id` untouched | `ACCESS_DISABLED` |
| Customer | Reactivate | `='disabled'` | `='active'` | n/a | YES | `ACCESS_REACTIVATED` |
| Engineer | Disable | `internal_staff.status='active'` | `='disabled'` | YES — `role='engineer'` kept | YES — any membership row untouched | `ACCESS_DISABLED` |
| Engineer | Reactivate | `='disabled'` | `='active'` | YES | Membership retained, forced `disabled` | `ACCESS_REACTIVATED` |
| Admin | Disable | `internal_staff.status='active'` | `='disabled'`, blocked if last active Admin | YES — `role='admin'` kept | YES | `ACCESS_DISABLED` |
| Admin | Reactivate | `='disabled'` | `='active'` | YES | Membership retained, forced `disabled` | `ACCESS_REACTIVATED` |

Authoritative table is `internal_staff` when a staff row exists, otherwise `implementation_users`. The `auth.users` identity is never touched and no row is ever deleted, so history survives in both directions. Audit payload shapes are unchanged from the application, including that `previous_state.status` is written as the literal `'active'` on Disable and `'disabled'` on Reactivate regardless of the actual prior value — a pre-existing inaccuracy deliberately preserved rather than silently corrected.

### 16.5 Two behaviours that required a decision

**Repeat operations stay permitted.** At `93eeeba`, Reactivate does not check that the target is currently disabled, and Disable does not check that it is currently active; both are effectively idempotent and write an audit row each time. Instruction §10.3 asked the new Reactivate to "prove the target is currently disabled". Implementing that would have made already-active reactivation fail, contradicting §6 (preserve existing semantics) and §18.8 (already-active behaviour must match the existing rule). Existing behaviour was preserved and proven live (16.9, probes 11 and 12). **This is a deliberate deviation from §10.3 and needs a CTO ruling** before it is treated as final.

**Self-action stays permitted.** No rule at `93eeeba` prevents an Admin disabling their own account; the only constraint is the last-active-Admin guard. No new self-action rule was introduced. Proven live: with exactly one active Admin in QA, self-disable was refused `P0001` by the `internal_staff_last_admin` trigger (16.9, probe 09).

### 16.6 Fix

New migration `supabase/migrations/20260909160000_atomic_access_disable_reactivate.sql` adds `public.access_disable(uuid, uuid)` and `public.access_reactivate(uuid, uuid)`. Each is a single `plpgsql` statement, so the status change and its audit event commit together or not at all. Each validates the actor against `internal_staff` (`role='admin'`, `status='active'`), validates that the target identity exists, and raises `invalid_input` when the target has no access to change. `SECURITY INVOKER`; `EXECUTE` revoked from `public`, `anon`, `authenticated` and granted only to `service_role`.

The one addition beyond the old behaviour is in `access_reactivate`: when a staff row is activated and a membership row is also present, the membership is set to `disabled`. This is required by §11. Without it, reactivating a disabled staff row for an identity whose membership had since been re-provisioned would leave both rows active. That state is reachable at `93eeeba`, because `provision` only refuses when a row is *already active* and will happily create an active membership alongside a disabled staff row.

Application: `AccessTransitionStore` gained `disable` and `reactivate`; `supabase-transition-store.ts` calls the two RPCs and maps `forbidden:` / `not_found:` / `invalid_input:` to the existing `InternalError` codes. `service.ts` now performs one transition call per operation and no longer writes authorization state or audit rows itself.

Function provenance — all three deployed QA bodies match their migration files byte-for-byte:

| Function | `md5(prosrc)` | Length | `prosecdef` | ACL |
|---|---|---|---|---|
| `access_change_account_type` | `71407283f929ab2a9f7ac0ea2e152852` | 4217 | false | `postgres=X/postgres \| service_role=X/postgres` |
| `access_disable` | `d8590485970c290213d7ae64bb77e080` | 1778 | false | `postgres=X/postgres \| service_role=X/postgres` |
| `access_reactivate` | `9f605f81c1389548ca4b8551d06a5383` | 2101 | false | `postgres=X/postgres \| service_role=X/postgres` |

### 16.7 Failure-injection method

The audit constraint on QA was narrowed to exclude `ACCESS_DISABLED` and `ACCESS_REACTIVATED`, then restored, entirely inside single transactions. `NOT VALID` was used so existing audit rows were never revalidated. Because DDL is transactional in Postgres, an unexpected error anywhere in a probe rolls the narrowing back with it, so the narrowed constraint cannot outlive the probe. This was demonstrated accidentally but usefully during the conversion work: one attempt without `NOT VALID` failed on pre-existing rows and rolled the whole block back.

### 16.8 Real Postgres proof — old defect and new behaviour

Fixture `5d211dce-4804-4afe-86c3-d803efd5c6e9` (`alt.yo-boumg1qm@yopmail.com`), starting state Customer / Active on implementation `6950075e-df22-41ad-b52f-c393ee0fa78f`, no staff row. Actor `ed596ee2-…` (Admin / Active).

Customer path:

| Step | Fault | Result |
|---|---|---|
| §13 old two-write sequence | audit rejected | raised `23514`; membership left **`disabled`**; audit delta `0` — **partial state confirmed** |
| §14 new `access_disable` | audit rejected | raised `23514`; membership still **`active`** with `impl=6950075e-…`; audit delta `0` |
| §15 `access_disable` | none | membership `disabled`, `impl` retained, no staff row; audit `ACCESS_DISABLED`, actor matches, `prev={role:customer,status:active}`, `new={status:disabled}` |
| §16 new `access_reactivate` | audit rejected | raised `23514`; membership still **`disabled`** |
| §17 `access_reactivate` | none | membership `active`, `impl` retained; audit `ACCESS_REACTIVATED`, `prev={status:disabled}`, `new={role:customer,status:active}` |

Internal path, after converting the same fixture to Internal / Engineer:

| Step | Fault | Result |
|---|---|---|
| Disable | audit rejected | raised `23514`; staff still `engineer/active`; membership unchanged |
| Disable | none | staff `engineer/disabled`; membership `disabled` with `impl` retained; role preserved |
| Reactivate | audit rejected | raised `23514`; staff still `engineer/disabled` |
| Reactivate | none | staff `engineer/active`; membership still `disabled` with `impl` retained; **dual-active row count for the fixture = 0** |
| Reverse conversion | none | staff row removed; membership `active` — fixture restored |

Both audit rows were then read back directly and carry the exact expected payloads. Their `created_at` values are identical because `now()` is transaction-scoped and the probe ran in one transaction; in production each RPC is its own transaction.

### 16.9 Authorization negative probes

QA had exactly **one** active Admin during these probes, so the last-Admin path was genuinely exercised.

| # | Probe | Result |
|---|---|---|
| 1 | Engineer actor disables another identity | refused `42501` |
| 2 | Engineer actor reactivates another identity | refused `42501` |
| 3 | Customer actor disables another identity | refused `42501` |
| 4 | Customer actor reactivates another identity | refused `42501` |
| 5 | Target has no access — disable | refused `22023` |
| 6 | Target has no access — reactivate | refused `22023` |
| 7 | Unknown identity — disable | refused `P0002` |
| 8 | Unknown identity — reactivate | refused `P0002` |
| 9 | Admin self-disable as last active Admin | refused `P0001` "Cannot disable or downgrade the last active Admin" |
| 10 | State and audit after all rejections | audit delta `0`; customer `active`, engineer `engineer/active`, admin `admin/active` — all unchanged |
| 11 | Disable an already-disabled target | succeeded — idempotent, matching `93eeeba` |
| 12 | Reactivate an already-active target | succeeded — idempotent, matching `93eeeba` |

Privilege escalation: neither function reads or writes `role`, so no path through Disable or Reactivate can change a role. Confirmed by probes — the fixture's role was `engineer` before and after both operations, and the reverse conversion returned it to Customer with no staff row.

### 16.10 Pre-existing dual-active identity — NOT introduced by this work

`select count(*) from internal_staff s join implementation_users m using (user_id) where s.status='active' and m.status='active'` returns **1 on QA and 1 on Production**.

QA: `ed596ee2-…` / `poconnell@frontlinepg.com`, `admin/active` with an active membership on implementation `04365d4b-…`. The membership row was created `2026-09-05 00:09:07Z`; the staff row `2026-09-05 16:34:03Z`, sixteen hours later. The membership came from the historical `ensureForUser` auto-provisioning and the staff row from the QA admin bootstrap, which bypasses Users & Access. Production shows the same single-identity shape for its one `internal_staff` row.

This is pre-existing data drift, not reachable through the current Users & Access surface, and not caused by these changes. It has a release consequence worth flagging: **after `79f8f7d` deploys, running Reactivate on that Production admin would disable its customer membership**, because `access_reactivate` now enforces the single-active-path invariant. The admin would not lose access — the staff row still resolves as internal — but their customer membership would flip to `disabled`. Nothing in this release changes that row unless someone explicitly reactivates it.

### 16.11 Automated tests

`237 passed / 0 failed`, up from 225. Twelve added, none removed or weakened:

- Disable failure at the status and audit stages leaves the staff row byte-identical, `active`, with no `ACCESS_DISABLED` event, and `resolveAuthorization` still `internal`.
- Reactivate failure at the status and audit stages leaves the staff row `disabled`, no `ACCESS_REACTIVATED` event, and `landingPath` still `/access/denied`.
- Customer disable failure leaves the membership `active` with its implementation.
- Customer disable then reactivate round trip: implementation preserved, `resolveAuthorization` moves `customer` → `disabled` → `customer`, and both audit rows carry the exact expected actor and payloads.
- Reactivating a converted Engineer never leaves both paths active.
- Disable and Reactivate rejected `400` for an identity with no access, with no audit written.
- Disable and Reactivate rejected `404` for an unknown target.
- Non-Admin callers — customer, converted customer, engineer, viewer — rejected `403` for both operations, with the staff row unchanged and no audit rows.
- The single-transition guard now covers conversion, disable and reactivate: each performs exactly one transition call and the service writes nothing itself.

The in-memory double raises injected failures before applying any mutation, so a partial state is unrepresentable in it. It tests the service contract; the transactional guarantee is evidenced by 16.8 against live QA Postgres.

### 16.12 Migration safety

```text
ACCOUNT TYPE AUDIT MIGRATION:
20260909003254_access_account_type_changed.sql

ATOMIC ACCOUNT CONVERSION MIGRATION:
20260909143000_atomic_account_type_change.sql

ATOMIC DISABLE/REACTIVATE MIGRATION:
20260909160000_atomic_access_disable_reactivate.sql
```

Disable and Reactivate were given their own migration rather than being folded into `20260909143000`. That migration has already been applied to QA and is under review as part of the approved conversion fix; editing it in place would invalidate the fingerprints in 15.4 and rewrite applied history. A separate file also keeps the dependency honest — the conversion migration needs the audit constraint widened, whereas Disable and Reactivate do not.

| Migration | Purpose | Object | Depends on | Additive | Compatible with `9f53192` | Safe before app deploy |
|---|---|---|---|---|---|---|
| `20260909003254` | permit `ACCOUNT_TYPE_CHANGED` | `access_audit_events_event_type_check` | none | YES — widens a CHECK | YES | YES |
| `20260909143000` | atomic conversion | `access_change_account_type` | `20260909003254` at call time | YES — creates a function | YES | YES |
| `20260909160000` | atomic disable/reactivate | `access_disable`, `access_reactivate` | none | YES — creates two functions | YES | YES |

None drops a table, drops a column, or rewrites a row. `20260909160000` is independent of the constraint widening because Production's constraint already permits `ACCESS_DISABLED` and `ACCESS_REACTIVATED` — verified read-only on Production, where the constraint carries five values and none of the three functions exist.

Compatibility with the deployed `9f53192` is proven by what `9f53192` does: it performs its own inline writes and never references any of the three functions, so adding them is inert to it. A widened CHECK accepts a superset of what it accepted before, so nothing `9f53192` writes can be rejected. Production may therefore run all three migrations and keep serving `9f53192` unchanged.

### 16.13 Final Production migration order

```text
1. 20260909003254_access_account_type_changed.sql
2. 20260909143000_atomic_account_type_change.sql
3. 20260909160000_atomic_access_disable_reactivate.sql
4. verify Production still healthy on 9f53192 — portal loads, Admin signs in, Users & Access renders
5. deploy exact approved application SHA 79f8f7d
```

Steps 1–3 are order-independent at apply time, since 2's dependency on 1 is only exercised at call time and `9f53192` never calls it. The listed order is still the safe one because it never leaves a window where a function exists whose audit value would be rejected.

### 16.14 Rollback

```text
APPLICATION ROLLBACK FROM NEW CANDIDATE TO 9f53192 AFTER MIGRATIONS:
SAFE
```

`9f53192` does not call `access_change_account_type`, `access_disable`, or `access_reactivate`, and performs the equivalent work with inline writes that the migrations leave untouched. The widened CHECK accepts everything `9f53192` writes. So the application can be rolled back independently, with the migrations left in place, and no schema change has to be reversed.

The forward-only warning from section 15.7 still stands and is now empirically confirmed. Once real `ACCOUNT_TYPE_CHANGED` rows exist, re-narrowing the constraint fails with `23514` against those rows — observed in QA when a narrowing attempt without `NOT VALID` aborted for exactly this reason. The migration is effectively forward-only after first use. That does not affect application rollback, which never requires re-narrowing.

### 16.15 QA cleanup verification

```text
audit_constraint         CHECK (event_type = ANY (ARRAY['USER_PROVISIONED','ROLE_CHANGED',
                         'ACCESS_DISABLED','ACCESS_REACTIVATED','CUSTOMER_ASSIGNMENT_CHANGED',
                         'ACCOUNT_TYPE_CHANGED'])) validated=true
leftover_scratch_tables  NONE
fixture_5d211dce         active impl=6950075e-df22-41ad-b52f-c393ee0fa78f staff=NONE
engineer_8212f5b9        engineer/active
admin_ed596ee2           admin/active
pending_79032aa0         no staff, no membership
test_only_roles          admin, engineer
```

Six-value constraint restored and validated, no temporary narrowing left, no scratch tables (probes used session-scoped temp tables), fixture back to its exact starting state, the QA engineer and admin fixtures untouched, and the `79032aa0` identity reserved for CTO UAT still pending with no membership. `test_only_roles` shows only the two legitimate roles — no test-only role was introduced. Audit rows written by the probes were retained; audit history is not deleted.

### 16.16 Deployment and QA isolation

| Item | Value |
|---|---|
| Preview deployment | `dpl_3kLsVFgYvZhX4JeLv7ZX5ZdnUyun` |
| Preview SHA | `79f8f7dd8083c5a1f2f5ccd17b8c46b5963a2e09` |
| Preview branch | `cursor/bookmax-admin-account-type` |
| Preview state | `READY`, `target=None` (Preview) |
| Preview aliases | `bookmax-setup-git-cursor-bookmax-admin-account-type-fpg1.vercel.app` only |
| Production alias present on Preview | **No** |
| `implementation.bookmax.ai` resolves to | `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S`, SHA `9f53192`, `target=production` — unchanged |

Isolation was proven by runtime log correlation, not by reading configuration. Three `GET /api/supabase/health` requests were issued to the Preview between `14:58:36Z` and `14:58:38Z`. Querying the identical window in both projects:

- QA `rnnlceroqzmxovsynzni`: 6 `edge_logs` + 2 `pgbouncer_logs`. The edge entries are three `GET /auth/v1/health` → 200 and three `GET /rest/v1/_bookmax_connectivity_check` → 404, at `14:58:36.852`, `14:58:37.684` and `14:58:38.225` — one pair per probe, matching the request timestamps.
- Production `coovxqyommehcteisoqy`: **zero events**.

No OTP was sent to establish this.

---

## 17. REMAINING WORK FOR CTO

On the branch preview for SHA `79f8f7d` (`dpl_3kLsVFgYvZhX4JeLv7ZX5ZdnUyun`):

1. Sign in at `/access` as `poconnell@frontlinepg.com`, enter the emailed 6-digit code, and confirm landing on `/implementation/users`. Unblocks Phase 3.
2. Confirm the send at `13:37:27Z` produced a usable 6-digit code for `andy@in-gauge.io`. If a link arrived instead, stop — that is a QA Confirm-signup template issue, separate from Engineer access.
3. Provision `79032aa0` as a **Customer** against an implementation, matching Andy's Production starting state. Unblocks Phase 4.
4. Manage → Change account type → **Internal / Engineer**. Verify `internal_staff.role='engineer'` and `status='active'`; `implementation_users.status='disabled'` with `implementation_id` retained; an `ACCOUNT_TYPE_CHANGED` row naming actor and subject.
5. Sign in as that identity and confirm `/implementation/submissions` loads and `/implementation/users` is refused.
6. Reverse it via Manage → Change account type → Customer, then repeat step 4 with **Internal / Admin** and confirm the landing path is `/implementation/users`.
7. Live **Disable** on a QA fixture, then confirm the identity is refused and lands on `/access/denied`, and that an `ACCESS_DISABLED` row names actor and subject.
8. Live **Reactivate** on the same fixture, then confirm access is restored with the role intact and an `ACCESS_REACTIVATED` row present.
9. Rule on the section 16.5 deviation: Reactivate still permits an already-active target, preserving `93eeeba` behaviour instead of adding the §10.3 disabled-only check.
10. Note the section 16.10 consequence: reactivating the Production admin after release would disable its customer membership. Decide whether to normalize that row separately.
11. Rule on the section 16.17 residual: `provision`, `role` and `assign` remain non-transactional.
12. Approve or reject the three Production migrations and SHA `79f8f7d`.

The Gate 8 partial-state finding is now closed for account-type conversion (section 15), Disable and Reactivate (section 16). It remains open, at lower exposure, for the paths listed in 16.17.

---

## 16.17 Known residual — remaining multi-write paths

Three paths in `lib/implementation/access/service.ts` still write authorization state and audit separately, and were left alone as outside the approved scope:

| Path | Writes | Audit event |
|---|---|---|
| `provision` | membership insert/update **or** staff upsert, then `audit.insert` | `USER_PROVISIONED` |
| `role` | `staff.upsert`, then `audit.insert` | `ROLE_CHANGED` |
| `assign` | `customers.updateMembership`, then `audit.insert` | `CUSTOMER_ASSIGNMENT_CHANGED` |

Each can leave an access change committed with no governance record if its audit write fails. All three event types are already permitted by the Production constraint, so the failure needs an unrelated fault — a dropped connection or database error between the two requests — rather than being guaranteed the way the conversion defect was. Same consequence, lower likelihood. The same pattern would extend to them directly if required.

---

STARTING CANDIDATE:
93eeeba

NEW CANDIDATE:
79f8f7d

BRANCH:
cursor/bookmax-admin-account-type

ORIGIN/MAIN:
9f53192

PRODUCTION SHA:
9f53192


DISABLE OLD PATH NON-ATOMIC:
CONFIRMED — two writes, audit last; old sequence reproduced live and left the membership `disabled` with zero audit rows (16.2, 16.8)

REACTIVATE OLD PATH NON-ATOMIC:
CONFIRMED — same two-write shape (16.3)


ATOMIC ACCOUNT CONVERSION:
PASS

ATOMIC DISABLE:
PASS

ATOMIC REACTIVATE:
PASS


DISABLE AUDIT FAILURE ROLLS BACK ACCESS:
PASS — `23514` raised; customer membership still `active` with its implementation, internal staff still `engineer/active`, zero audit rows

REACTIVATE AUDIT FAILURE ROLLS BACK ACCESS:
PASS — `23514` raised; target remained `disabled` on both the customer and internal paths, zero audit rows


DISABLE SUCCESS REAL POSTGRES:
PASS

REACTIVATE SUCCESS REAL POSTGRES:
PASS


SERVER-SIDE DISABLE AUTHORIZATION:
PASS — Engineer, Viewer and Customer actors refused `42501`; no-access target `22023`; unknown target `P0002`; last active Admin `P0001`

SERVER-SIDE REACTIVATE AUTHORIZATION:
PASS — same rejections, zero audit delta and no state change across all of them


DUAL ACTIVE MEMBERSHIP PREVENTED:
PASS for every operation in this release. Separately, one pre-existing dual-active identity exists on both QA and Production; it predates this work, is unreachable through Users & Access, and is documented in 16.10.


TESTS:
237 passed / 0 failed

TYPECHECK:
PASS

LINT:
PASS — `eslint`, exit 0, no findings

BUILD:
PASS — `next build` completed, all routes emitted


ACCOUNT TYPE AUDIT MIGRATION:
20260909003254_access_account_type_changed.sql

ATOMIC ACCOUNT CONVERSION MIGRATION:
20260909143000_atomic_account_type_change.sql

ATOMIC DISABLE/REACTIVATE MIGRATION:
20260909160000_atomic_access_disable_reactivate.sql


FINAL PRODUCTION MIGRATION ORDER:
1. 20260909003254_access_account_type_changed.sql
2. 20260909143000_atomic_account_type_change.sql
3. 20260909160000_atomic_access_disable_reactivate.sql
4. verify Production still healthy on 9f53192
5. deploy exact approved application SHA 79f8f7d


ALL MIGRATIONS BACKWARD COMPATIBLE WITH 9f53192:
YES


APPLICATION ROLLBACK TO 9f53192 AFTER MIGRATIONS:
SAFE — `9f53192` never calls the three functions and performs the equivalent work with inline writes; the widened CHECK accepts a superset of what it already wrote, so no schema change has to be reversed.


QA CLEANUP:
PASS

QA PREVIEW:
dpl_3kLsVFgYvZhX4JeLv7ZX5ZdnUyun

QA PREVIEW SHA:
79f8f7dd8083c5a1f2f5ccd17b8c46b5963a2e09

QA ISOLATION:
PASS — three Preview probes produced six matching QA edge-log entries and zero Production log events in the identical window


PRODUCTION CHANGED:
NO — read-only verification shows Production's audit constraint still carries five values without `ACCOUNT_TYPE_CHANGED`, none of the three functions exist, the production alias still resolves to `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S` at SHA `9f53192`, and `origin/main` is still `9f53192`


LIVE QA UAT:
NOT RUN — CTO OTP REQUIRED


READY FOR LIVE QA UAT:
YES


READY FOR CTO PRODUCTION APPROVAL:
NO


REMAINING BLOCKERS:
1. Live QA UAT of the Engineer, Admin, Disable and Reactivate journeys through the deployed Preview — requires CTO OTP entry.
2. CTO ruling on the section 16.5 deviation (Reactivate still permits an already-active target, preserving `93eeeba` behaviour rather than adding the §10.3 disabled-only check) and on the section 16.17 residual (`provision`, `role`, `assign` remain non-transactional).
3. Explicit CTO approval of the three Production migrations and SHA `79f8f7d`.

APPLICATION CHANGES:
`79f8f7d` moves Disable and Reactivate behind one transactional RPC each. Changed: `lib/implementation/access/service.ts`, `transition-store.ts`, `supabase-transition-store.ts`; added the migration and twelve tests. No change to OTP, customer authorization, routing, or onboarding.

QA CHANGES:
Migration `20260909160000` applied to QA. Disable/reactivate probes on fixture `5d211dce-…`, returned to Customer / Active on its original implementation. The audit constraint was narrowed with `NOT VALID` and restored inside single transactions, verified back to six validated values. Probe audit rows retained. No OTP sent. QA Auth untouched.

PRODUCTION CHANGES:
NONE.

STOP.

---

# PRODUCTION RELEASE — 9 Sep 2026

CTO authorised the release of the approved candidate, the Andy conversion, and a subsequent code freeze.

## Pre-release verification

| Check | Expected | Observed | Result |
|---|---|---|---|
| Approved SHA | `79f8f7d` | `79f8f7dd8083c5a1f2f5ccd17b8c46b5963a2e09` | PASS |
| Branch | `cursor/bookmax-admin-account-type` | same | PASS |
| `origin/main` before release | `9f53192` | `9f53192cd8af32924021a2cd1bea541ec098ad2c` | PASS |
| Production before release | `9f53192` | `dpl_75e1K9NToE8T26HPtNPNEmZEcF3S` | PASS |
| Working tree | clean | clean (tracked) | PASS |
| Fast-forward possible | yes | `9f53192` is an ancestor of `79f8f7d` | PASS |

No Production drift was detected.

## Production migrations

Production Supabase is `coovxqyommehcteisoqy` (`bookmax_setup`). The last applied migration before this release was `20260908195737_disabled_customer_active_membership_rls`; all three required migrations were absent.

Applied in dependency order:

1. `20260909003254_access_account_type_changed.sql` — widens `access_audit_events_event_type_check` to six values, adding `ACCOUNT_TYPE_CHANGED`. Additive.
2. `20260909143000_atomic_account_type_change.sql` — creates `public.access_change_account_type`. Depends on 1 for the audit value.
3. `20260909160000_atomic_access_disable_reactivate.sql` — creates `public.access_disable` and `public.access_reactivate`.

Post-migration verification, with QA as the reference:

| Function | QA `md5(prosrc)` | Production `md5(prosrc)` | Execute grants |
|---|---|---|---|
| `access_change_account_type` | `71407283f929ab2a9f7ac0ea2e152852` | identical | `service_role` only |
| `access_disable` | `d8590485970c290213d7ae64bb77e080` | identical | `service_role` only |
| `access_reactivate` | `9f605f81c1389548ca4b8551d06a5383` | identical | `service_role` only |

The first application of migrations 2 and 3 was submitted without the in-body comments, which produced a checksum divergence from QA on two functions. The logic was identical, but the functions were replaced with the exact repository source so that Production, QA and the repository now agree byte for byte. `anon` and `authenticated` hold no execute privilege on any of the three.

The audit constraint reads:

```text
CHECK (event_type = ANY (ARRAY['USER_PROVISIONED','ROLE_CHANGED','ACCESS_DISABLED',
  'ACCESS_REACTIVATED','CUSTOMER_ASSIGNMENT_CHANGED','ACCOUNT_TYPE_CHANGED']))
```

With the migrations applied and the application still on `9f53192`, `/`, `/access`, `/implementation` and `/implementation/submissions` all returned 200, confirming the migrations are backward compatible with the previously deployed application.

## Deployment

`79f8f7d` was published by fast-forwarding `main`; no merge commit and no code after the approved SHA.

| Item | Value |
|---|---|
| Production deployment | `dpl_J6ZeaqtSqKZM6dxjHNvPvpkydtjB` |
| Deployment URL | `bookmax-setup-jvh737khs-fpg1.vercel.app` |
| Deployed SHA | `79f8f7d` (GitHub Production deployment record, 2026-09-09T18:51:16Z) |
| Created | 2026-09-09 14:50:51 ET |
| Alias | `implementation.bookmax.ai` |

The custom domain was pinned to the previous deployment and did not follow the new Production build automatically, so the new deployment was promoted explicitly. `vercel inspect implementation.bookmax.ai` now resolves to `dpl_J6ZeaqtSqKZM6dxjHNvPvpkydtjB`.

## Smoke test

Unauthenticated checks against `implementation.bookmax.ai` after promotion: `/`, `/access`, `/implementation`, `/implementation/users` and `/implementation/submissions` all returned 200. The deployment's runtime log contains 18 request entries and zero 5xx or error-level entries.

The remaining smoke items — Admin login, Users & Access rendering, Manage drawer, and the Account Type and Internal Role controls — require an authenticated Production Admin session. There is exactly one active Production Admin, `poconnell@frontlinepg.com`, and completing its OTP is a CTO action. These items are therefore NOT VERIFIED rather than PASS.

## Andy — read-only pre-state

| Field | `asena@in-gauge.io` |
|---|---|
| `auth.users.id` | `5d743da8-3879-4a96-aace-d0490df914a5` |
| Account type | Customer |
| Role | customer |
| Status | active |
| Implementation | `cdf25ab3-5ba3-450f-bac7-589db678afdf` |
| `internal_staff` row | none |
| Internal-eligible | yes (`in-gauge.io`) |

This matches the expected pre-state exactly, and the conversion control will render for this identity.

The conversion was not performed. Section 4 of the release instruction requires the smoke test to pass before Andy is changed, and the Admin-authenticated portion of that smoke test cannot be completed without the CTO. Performing the conversion by calling the RPC directly would bypass the Production Admin workflow the instruction specifies and would be exactly the kind of direct Production change the code freeze prohibits.

`asenanewton@frontlinepg.com` was read only and remains Customer / customer / active, unchanged.

## Governance follow-up register

These are recorded, not fixed. Each needs a Traqra ID, owner and acceptance criteria before any work starts.

| # | Item | Origin |
|---|---|---|
| 1 | `provision` transactional hardening | non-transactional multi-write, same class as the conversion defect |
| 2 | `role` transactional hardening | non-transactional multi-write |
| 3 | `assign` transactional hardening | non-transactional multi-write |
| 4 | Reactivate already-active semantics | §16.5 deviation; current behaviour permits reactivating an active target |
| 5 | Disabled explanation for ineligible domains | control is hidden silently, which was misread as a defect during UAT |
| 6 | `.env.local` points at Production Supabase | `coovxqyommehcteisoqy` in a local dev file |
| 7 | Approved QA fixture creation path | raw SQL inserts into `auth.users` leave NULL GoTrue token columns and break `admin.listUsers` |
| 8 | Access-management code review standards | code freeze entry criteria |
| 9 | Production release controls | domain alias did not follow the Production build |
| 10 | Migration review requirements | checksum parity between environments as a release gate |
| 11 | Authorization regression suite ownership | 237 tests need a named owner |

---

# PRIVILEGE BOUNDARY DEFECT AND FIX — 9 Sep 2026

## Incident

Every conversion attempted through the Production UI returned 503 with "The service is temporarily unavailable." Eight `PATCH /api/implementation/users` attempts failed between 19:05Z and 19:11Z. The Users & Access page itself was healthy throughout, and `auth.admin.listUsers()` was never implicated.

## Root cause

The three access RPCs were `SECURITY INVOKER` and each reads `auth.users` for the target existence check. The application calls them through PostgREST as `service_role`, and `service_role` holds no `SELECT` on `auth.users`. Postgres raised 42501 "permission denied for table users" inside the function body, the transaction rolled back, and `raise()` in `supabase-transition-store.ts:24` mapped the unrecognised message to `unavailable` → HTTP 503.

Confirmed in both environments: `has_table_privilege('service_role','auth.users','select')` is false, while the same check for `postgres` is true.

## Why QA did not catch it

Every earlier "real Postgres" proof ran through the Supabase MCP connection, which executes as `postgres`. That role can read `auth.users`, so the privilege boundary the application actually crosses was never exercised. The QA UAT "PASS" for Customer → Engineer covered control visibility, not a committed conversion; no UI-driven `ACCOUNT_TYPE_CHANGED` row existed in QA either.

## Fix

`20260909193000_access_rpc_security_definer.sql` (commit `d79307c`) alters the three functions to `SECURITY DEFINER`, owned by `postgres`, with `search_path` pinned to empty. The function bodies are untouched — `md5(prosrc)` is unchanged for all three.

Granting `service_role` general `SELECT` on `auth.users` was rejected as it would widen access far beyond these three call sites.

Safety properties, all verified after the change:

| Property | Evidence |
|---|---|
| Internal Admin check still enforced | a Customer actor is rejected with `forbidden: only an active Admin can disable access` |
| Not reachable from the Data API | `anon` and `authenticated` both get `permission denied for function` |
| Execute restricted | `has_function_privilege` returns `service_role` only |
| No schema shadowing | `proconfig = search_path=""`, all references fully qualified |
| Atomicity preserved | forced audit failure still rolls back completely |

## Validation as service_role

Run under `set local role service_role`, which reproduces the exact privilege context that failed, with each probe wrapped in a transaction and rolled back.

| # | Case | Result |
|---|---|---|
| 1 | Customer → Internal / Admin | commits; staff admin active, membership disabled |
| 2 | Customer → Internal / Engineer | commits; staff engineer active, membership disabled |
| 3 | Disable | commits |
| 4 | Reactivate | commits |
| 5 | Unauthorized actor | rejected, 42501 `forbidden:` |
| 6 | `anon` execute | rejected, permission denied for function |
| 7 | `authenticated` execute | rejected, permission denied for function |
| 8 | Dual active access | 0 rows |
| 9 | Audit rows | `ACCOUNT_TYPE_CHANGED,ACCESS_DISABLED,ACCESS_REACTIVATED` |
| 10 | Forced audit failure | 23514, staff rows 0, membership still active, audit rows 0 |

QA was returned to baseline: the six-value audit constraint is validated, and the fixture is unchanged.

Tests 237 passed / 0 failed. Typecheck PASS.

## Production release of the fix

| Item | Value |
|---|---|
| Fix commit | `d79307c` |
| Production deployment | `dpl_2Q5pMsan8UE6msMWxJa1XXDuVVc6` |
| Migration | `20260909193000_access_rpc_security_definer.sql` |

The custom domain again failed to follow the new Production build and required an explicit promote, the second occurrence of governance item 9.

Post-fix, five conversion `PATCH` calls returned 200 and zero 5xx or error-level entries appear in the deployment log.

## Andy conversions

Both approved identities were converted through the Admin UI.

| Field | `asena@in-gauge.io` | `asenanewton@frontlinepg.com` |
|---|---|---|
| Auth UUID | `5d743da8-…` unchanged | `b226f240-…` unchanged |
| `internal_staff` | admin / active | admin / active |
| `implementation_users` | retained, disabled | retained, disabled |
| Implementation reference | `cdf25ab3-…` retained | `8d2b4f74-…` retained |
| `ACCOUNT_TYPE_CHANGED` | 1 row, 19:46:08Z | 1 row, 19:47:08Z |
| Dual active | no | no |

The recorded transition for the first is `{"accountType":"customer","role":"customer","status":"active","implementationId":"cdf25ab3-…"}` → `{"accountType":"internal","role":"admin","status":"active"}`.

## Two deviations from the release plan

Four identities were converted to Internal / Admin, not two. Beyond the approved pair, `vsamsonovych@in-gauge.io` (19:46:22Z) and `afernandez@frontlinepg.com` (19:49:36Z) were also converted. All four executed correctly and atomically; this is noted because the plan specified two and an expected Admin count of 3. The actual active Admin count is 5.

One dual-active identity exists: `poconnell@frontlinepg.com` holds an active `internal_staff` row and an active `implementation_users` row. This is pre-existing, dating to 2026-09-08, and was previously flagged. It was not produced by today's conversions — all four correctly disabled their memberships. It needs a governed cleanup decision.

## Release status

BOOKMAX ACCESS MANAGEMENT CODE FREEZE — ACTIVE.

Both approved conversions passed and the privilege defect is fixed and verified. Further changes to this subsystem require a Traqra item, owner, requirement, acceptance criteria, code review, QA evidence and CTO release approval.

Governance register additions from this incident:

| # | Item |
|---|---|
| 12 | Verify database functions through the application's own role, never a superuser connection |
| 13 | Resolve the pre-existing dual-active identity `poconnell@frontlinepg.com` |
| 14 | Reconcile the four Production Admins against intended access |
