# Phase 1 — Security & Access Control Review

| Field | Value |
| --- | --- |
| Repository | `poconnell10/bookmax_setup` |
| Reviewer role | Principal Security Engineer (code review) |
| Scope | Security and access control only |
| Reviewed commit | `e5347e6cdc25242f64d5edcbb5a25996d54b74aa` |
| Review branch | `cursor/phase-1-security-review-0dcd` |
| Review date | 29 Oct 2026, 2:02 PM EDT (America/New_York) |
| Amended | 29 Oct 2026, 2:10 PM EDT (America/New_York) — follow-up from parallel review passes |
| Method | Static analysis of application TypeScript and `supabase/migrations/*.sql` |
| Code modified | None (this document only) |

**Classification used**

| Severity | Meaning |
| --- | --- |
| **P0** | Confirmed exploitable path to auth bypass, privilege escalation to Admin, cross-tenant data access, or secret/key exposure |
| **P1** | Confirmed security-control failure with realistic abuse impact (privileged surface without auth, disable bypass, broken secret handoff) |
| **P2** | Confirmed defense-in-depth failure or weaker-than-stated control; exploit not demonstrated from code alone |

Only **confirmed** defects are listed. Theoretical risks without code evidence are under **Unverified**, not as defects.

---

## Executive verdict

**NOT READY for production security acceptance.**

Strong patterns exist (OTP ≠ authorization, Admin-gated Users APIs, last-Admin DB trigger, credential AES-GCM on the `/setup` path, SECURITY DEFINER RPCs with `search_path = ''` and execute limited to `service_role`). Four **P1** defects remain open. No **P0** was confirmed from this review.

---

## Confirmed defects

### SEC-01 — P1 — Unauthenticated service-role database write via connection-test API

**Control area:** API authorization / secret-backed privileged client misuse

**Evidence**

`POST /api/supabase/connection-test` performs no session or role check. It constructs a service-role client and runs a write/read probe:

```7:16:app/api/supabase/connection-test/route.ts
export async function POST() {
  try {
    const client = createServiceClient();
    const result = await runPrivilegedConnectionTest(
      client as unknown as Parameters<typeof runPrivilegedConnectionTest>[0],
    );

    return Response.json(result, {
      status: result.ok ? 200 : 503,
    });
```

```35:63:lib/supabase/connection-test.ts
export async function runPrivilegedConnectionTest(
  client: ConnectionTestClient,
): Promise<PrivilegedConnectionResult> {
  const testValue = `m0-connectivity-${Date.now()}`;

  const inserted = await client
    .from(CONNECTION_TEST_TABLE)
    .insert({ test_value: testValue })
    .select("id, created_at")
    .single();
  // ...
```

`createServiceClient()` uses `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/service.ts`, `lib/supabase/env.ts`).

**Impact**

Any unauthenticated caller who can reach the deployment can exercise the service-role credential path to insert (and read back) rows in `bookmax_connection_test`, without bound rate limiting in this route. This is not customer-data exfiltration by itself, but it is a live privileged write surface and an abuse/DoS vector against that table.

**Required remediation**

1. Remove the route from production deployments, **or**
2. Require an authenticated Admin (or a dedicated machine credential with explicit allowlist), **and**
3. Add request throttling / fail closed when `VERCEL_ENV === 'production'` unless explicitly enabled.

**Acceptance criteria**

- Unauthenticated `POST` returns `401`/`403`/`404` and performs **zero** database writes.
- Automated test asserts absence of anonymous privileged write.
- Production config review confirms the probe is disabled or Admin-only.

---

### SEC-02 — P1 — Disabled accounts retain invitation-flow API access

**Control area:** Disabled accounts / authorization consistency

**Evidence**

Canonical authorization treats disabled membership/staff as `kind: "disabled"`:

```65:92:lib/access/authorization.ts
  const staff = await getStaffStore().findByUserId(input.userId);
  if (staff) {
    if (staff.status === "active") {
      return {
        kind: "internal",
        // ...
      };
    }
    return {
      kind: "disabled",
      // ...
    };
  }

  const membership = await getCustomerStore().findMembershipByUserId(input.userId);
  if (membership) {
    if (membership.status === "disabled") {
      return {
        kind: "disabled",
        // ...
      };
    }
```

Setup/customer APIs use that decision (`requireCustomerSession` rejects non-`customer`).  
Invitation APIs do **not**. `requireCustomerInvitationApi` only checks Supabase JWT + invitation ownership:

```24:60:lib/implementation/invitation/customer-auth.ts
export async function requireCustomerInvitationApi(
  request: NextRequest,
  options?: { allowSubmitted?: boolean },
): Promise<CustomerAuthContext> {
  // ... getUser() ...
  // ... invitation cookie + getOwnedInvitation ...
  // no resolveAuthorization(); no staff/membership status check
  return { principal, invitation, attachAuthCookies };
}
```

Routes still gated only by that helper include draft, submit, and credentials:

- `app/api/implementation/draft/route.ts`
- `app/api/implementation/submit/route.ts`
- `app/api/implementation/credentials/route.ts`

RLS for the modern customer tables was explicitly tightened so disabled customers lose PostgREST access (`supabase/migrations/20260908191157_disabled_customer_active_membership_rls.sql`). Invitation draft policies authorize solely via `implementation_invitation.auth_user_id = auth.uid()` and do **not** consult `implementation_users.status` (`supabase/migrations/20260831220000_implementation_invitation.sql`).

**Impact**

An Admin “Disable access” transition that sets `implementation_users.status = 'disabled'` (or disables staff) does **not** cut off a user who remains bound to an invitation. With a valid JWT + invitation cookies, that user can continue draft/submit on the invitation path. Disable is therefore not a complete access revocation control for all customer surfaces in this codebase.

**Required remediation**

1. Call `resolveAuthorization` inside `requireCustomerInvitationApi` (and page/proxy invitation gates).
2. Reject `disabled`, `pending` (as appropriate), and non-matching principals.
3. Optionally revoke/expire invitation bind or clear invitation cookies on disable.
4. Align invitation RLS with active membership (or revoke authenticated draft grants if all access is service-role-only).

**Acceptance criteria**

- Disabled customer with bound invitation receives `403` on draft/submit/credentials.
- Regression test: provision → bind invitation → disable → invitation APIs fail; `/setup` APIs fail.
- Documented revoke behavior on disable.

---

### SEC-03 — P1 — Invitation credential handoff claims secure storage but discards secrets

**Control area:** Secret handling / credential vault integrity

**Evidence**

UI promises secure storage after handoff:

```220:226:components/intake/IntakeProvider.tsx
      await postJson("/api/implementation/credentials", { draftId, ...payload });
      setState((current) => ({
        ...current,
        draftId,
        credentialsStatus: "received",
      }));
      notify("Credentials received — stored securely, not shown again");
```

Server accepts `clientId` / `clientSecret` / `applicationKey`, then persists **only** `credentialsStatus: "received"` into the draft JSON. Secrets are never passed to `encryptCredentialSecrets` or `implementation_credentials`:

```9:33:app/api/implementation/credentials/route.ts
export async function POST(request: NextRequest) {
  try {
    const { principal, invitation, attachAuthCookies } = await requireCustomerInvitationApi(request);
    const body = (await request.json()) as {
      draftId?: string;
      clientId?: string;
      clientSecret?: string;
      applicationKey?: string;
    };

    if (!body.clientId?.trim() || !body.clientSecret?.trim() || !body.applicationKey?.trim()) {
      return NextResponse.json({ error: "Incomplete credentials" }, { status: 400 });
    }

    const existing = await getInvitationService().getDraft(invitation.id, principal);
    const identity = intakePatchFromInvitation(invitation);
    await getInvitationService().saveDraft(invitation.id, principal, {
      ...(existing?.payload || {}),
      ...identity,
      draftId: invitation.id,
      credentialsStatus: "received",
    });

    return attachAuthCookies(NextResponse.json({ credentialsStatus: "received" }));
```

Contrast with the `/setup` path, which encrypts and upserts envelopes (`lib/setup/credentials/service.ts`, `lib/setup/credentials/encrypt.ts`, table RLS closed to `service_role` only in `20260903195326_implementation_credentials.sql`).

**Impact**

Operators and customers are told credentials were stored securely; the invitation path does not vault them. Credentials may be lost, re-collected over insecure channels, or never available to the audited engineer reveal workflow (`/api/implementation/submissions/[id]/credentials`).

**Required remediation**

1. Route invitation credential POST through the same encrypt + `implementation_credentials` store as `/api/setup/credentials`, keyed to a resolvable implementation id, **or**
2. Remove/disable the invitation credential endpoint and UI until that wiring exists.
3. Never set `credentialsStatus: "received"` unless an envelope row exists.
4. Fix the user-facing copy to match actual storage.

**Acceptance criteria**

- After invitation credential submit, a row exists in `implementation_credentials` with AES-256-GCM envelope fields only (no plaintext columns).
- Engineer reveal works for that submission and writes `credential_opened` audit.
- Test proves plaintext secrets are absent from draft/submission JSON.

---

### SEC-04 — P2 — Internal role changes lack database-level actor authorization

**Control area:** Privilege escalation defense-in-depth / SECURITY DEFINER consistency

**Evidence**

Disable, reactivate, account-type, provision, and assignment transitions call SECURITY DEFINER RPCs that re-check `internal_staff` for an **active Admin** actor (`access_disable`, `access_change_account_type`, etc.).

Role-only changes do **not**. `manage()` uses direct `staff.upsert` after application `assertAdmin`:

```267:291:lib/implementation/access/service.ts
    if (input.action === "role") {
      if (!staff) {
        throw new InternalError("invalid_input", "Only internal users have an internal role.");
      }
      // ... last-admin application check ...
      const previous = staff.role;
      await deps.staff.upsert({
        userId,
        role: input.role,
        status: staff.status,
        provisionedBy: actor.userId,
      });
      await deps.audit.insert({
        eventType: "ROLE_CHANGED",
        // ...
      });
```

`createSupabaseStaffStore.upsert` writes `internal_staff` via the service-role client with **no** RPC actor check (`lib/implementation/internal/supabase-staff-store.ts`). The `prevent_last_admin_loss` trigger still blocks last-Admin loss (`supabase/migrations/20260908120000_bookmax_users_access.sql`) but does not verify the caller is an Admin.

**Impact**

If the application authorization layer is bypassed or a future service-role caller forgets `requireAdmin`, role escalation/downgrade is not re-validated inside the database the way disable/account-type are. This is a confirmed control inconsistency, not a demonstrated anonymous exploit (Users APIs today call `requireAdmin`).

**Required remediation**

Add `access_change_role(actor, target, role)` SECURITY DEFINER function (Admin check + last-Admin trigger + atomic `ROLE_CHANGED` audit), grant execute only to `service_role`, and route `action: "role"` through it.

**Acceptance criteria**

- Role change fails inside the DB when `p_actor_user_id` is not an active Admin.
- Partial role write without audit cannot commit.
- Existing Users & Access tests still pass.

---

### SEC-05 — P1 — Account-type → Customer can place a second customer on an occupied implementation

**Control area:** RLS / customer–tenant isolation

**Evidence**

`access_set_customer_implementation` enforces exclusive membership (refuses any implementation that already has a member):

```109:112:supabase/migrations/20261010120000_access_set_customer_implementation.sql
  if exists (select 1 from public.implementation_users where implementation_id = p_implementation_id) then
    raise exception 'implementation_taken: that implementation already belongs to a customer'
      using errcode = '23505';
  end if;
```

`access_change_account_type` does **not**. Converting to Customer with a supplied `p_implementation_id` assigns that id with no occupancy check:

```258:276:supabase/migrations/20261002184037_customer_onboarding_provision.sql
    if v_membership_id is not null then
      v_target_implementation := coalesce(p_implementation_id, v_membership_implementation);
      update public.implementation_users
        set implementation_id = v_target_implementation,
            status = 'active'
      where id = v_membership_id;
    else
      -- ...
      insert into public.implementation_users (implementation_id, user_id, role, status)
      values (v_target_implementation, p_target_user_id, 'customer', 'active');
```

Schema uniqueness is only on `implementation_users.user_id`, not `implementation_id` (`20260903140000_customer_implementation_m1.sql`).  
`listImplementationOptions` returns **all** implementations (including attached); the Users API accepts Admin-supplied `implementationId` on account-type change. Test `admin can convert Internal / Engineer back to Customer with an implementation` (`tests/users-access.test.ts`) attaches onto `implementations[0]` from that full list.

**Impact**

An Admin account-type conversion can co-locate two active customers on one implementation. Both then satisfy membership-scoped RLS and `assertOwnsImplementation` for the same property/intake/credentials/submission rows — breaking the exclusive-tenant invariant enforced on the attach path.

**Required remediation**

1. Add the same occupancy guard to `access_change_account_type` as `access_set_customer_implementation` (or refuse `p_implementation_id` that already has any membership).
2. Restrict the account-type UI/API to attachable (unoccupied) implementations only — reuse `listAttachableImplementations`.
3. Add a regression test that converting onto an occupied implementation fails.

**Acceptance criteria**

- Converting a user to Customer onto an implementation that already has any `implementation_users` row fails inside the DB.
- No two active memberships share an `implementation_id` after any Admin Users & Access mutation.
- Attach and account-type paths share one occupancy rule.

---

### SEC-06 — P2 — Customer can UPDATE properties via PostgREST after submission

**Control area:** RLS vs application authorization

**Evidence**

Application service blocks post-submit property writes:

```112:114:lib/implementation/customer/service.ts
    if (context.submission) {
      throw new CustomerError("invalid_input", "This implementation was already submitted.");
    }
```

RLS `properties_update_own` only requires active membership (`20260908191157_disabled_customer_active_membership_rls.sql`). Authenticated role has `GRANT UPDATE` on `properties` (`20260903140000_customer_implementation_m1.sql`). A customer JWT calling PostgREST directly can therefore update property rows after submission even though the Next.js API refuses.

**Impact**

Submitted property identity fields can be altered outside the application workflow. Not an anonymous exploit; requires a valid active customer session and Data API access with the publishable key.

**Required remediation**

Tighten `properties_update_own` (and related update policies if any) to require no row in `implementation_submissions` for that implementation (or revoke authenticated UPDATE and keep updates service-role-only after app checks).

**Acceptance criteria**

- Direct authenticated UPDATE on a submitted implementation’s property row is denied by RLS.
- Pre-submit customer UPDATE via app still succeeds.

---

### SEC-07 — P2 — OTP verify routes have no application-layer attempt throttle

**Control area:** Authentication / token security

**Evidence**

OTP **send** routes use in-process 20s maps. OTP **verify** routes (`app/api/access/otp/verify/route.ts`, `app/api/implementation/otp/verify/route.ts`) call `verifyOtp` with no attempt counter, lockout, or backoff in application code.

**Impact**

Confirmed absence of an app-layer verify throttle on a 6-digit code. Whether online guessing is practical depends on Supabase Auth project limits, which are **unverified** in this review. Filed as P2 (control gap), not P0/P1 exploitation.

**Required remediation**

Add per-email / per-invitation verify attempt limits (shared store, not process-local Maps) and/or confirm and document Supabase Auth lockout settings as an accepted compensating control.

**Acceptance criteria**

- After N failed verifies, further attempts are rejected by the app or by documented platform policy with evidence.
- Limits hold across multiple serverless instances.

---

### SEC-08 — P2 — Logout does not clear invitation / pending-email cookies

**Control area:** Session management

**Evidence**

```6:9:app/api/access/logout/route.ts
export async function POST(request: NextRequest) {
  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  await supabase.auth.signOut();
  return attachAuthCookies(NextResponse.json({ ok: true }));
}
```

Does not clear `bookmax.invitation`, `bookmax.invitation_claim`, or `bookmax.pending_email`.

**Impact**

Incomplete logout hygiene. Proxy/API still require matching `auth.uid()` for invitation claims, so this is not a demonstrated cross-user privilege bypass by itself.

**Required remediation**

Clear all BookMax auth-adjacent cookies on logout (maxAge 0) in addition to Supabase `signOut`.

**Acceptance criteria**

- After logout response, invitation, claim, and pending-email cookies are absent.

---

## Security controls — verified vs unverified

### Verified present (with evidence)

| Control | Evidence |
| --- | --- |
| OTP proves identity only; authorization from DB membership/staff | `lib/access/authorization.ts` comment + `resolveAuthorization`; internal auth module ignores email domain / client role claims |
| Access OTP does not create identities | `shouldCreateUser: false` in `app/api/access/otp/send/route.ts` |
| Access OTP does not reveal whether email exists | Indistinguishable success on `otp_disabled` / signups-not-allowed |
| Invitation tokens hashed at rest; raw token ≥ 32 bytes | `lib/implementation/invitation/token.ts`; store persists hash |
| Invitation claim cookie HMAC + timing-safe compare; httpOnly | `lib/implementation/invitation/session-cookie.ts`; proxy checks claim ↔ cookie ↔ `auth.uid()` |
| Invitation bind requires email match; no rebind to other user | `assertCanBindAuthUser` |
| Admin/Engineer/Viewer enforced on internal APIs/pages | `requireAdmin` / `requireEngineer` / `requireInternalStaff` + page variants |
| Customer setup APIs require customer decision + ownership asserts | `requireCustomerSession`, `assertOwnsImplementation` / `assertOwnsProperty` |
| Admin acting on customer property requires matching customer+implementation scope | `authorizeAdminScope` in `lib/implementation/customer/auth.ts` |
| Last active Admin protected in app + DB trigger | `countActiveAdmins` checks; `prevent_last_admin_loss` |
| Disable/reactivate/account-type/provision/assign are atomic RPCs with in-function Admin checks | Migrations `20260909143000`, `20260909160000`, `20261002184037`, `20261009200000`, `20261010120000` |
| SECURITY DEFINER RPCs: empty `search_path`, execute revoked from `anon`/`authenticated`, granted to `service_role` | e.g. `20260909193000_access_rpc_security_definer.sql` |
| `implementation_credentials` RLS on; no grants to `anon`/`authenticated` | `20260903195326_implementation_credentials.sql` |
| Setup credential encryption AES-256-GCM; rejects `NEXT_PUBLIC_` key | `lib/setup/credentials/encrypt.ts`, `env.ts` |
| Server secret env rejects `NEXT_PUBLIC_SUPABASE_SECRET_KEY` / `SERVICE_ROLE` | `lib/supabase/env.ts` (+ tests in `tests/supabase-env.test.ts`) |
| Internal staff / access audit tables closed to Data API (service_role only) | `20260904181449_internal_submissions_access.sql`, `20260908120000_bookmax_users_access.sql` |
| Disabled customers blocked on modern customer RLS policies | `20260908191157_disabled_customer_active_membership_rls.sql` |
| Credential reveal limited to engineer/admin; audited; no-store headers | `canMutateSubmissions`; `revealCredentials`; credentials route |
| Client authorization fields stripped on invitation draft/submit | `stripClientAuthorizationFields` |
| Invitation store runtime uses Supabase service client (not file store) | `lib/implementation/invitation/runtime.ts` |
| Internal submissions runtime uses Supabase queue (not `prototypePersistence`) | `lib/implementation/internal/runtime.ts`; tests assert pages/APIs avoid prototype list helpers |

### Verified absent / broken (see defects)

| Control | Status |
| --- | --- |
| AuthN on connection-test privileged probe | **Broken — SEC-01** |
| Disable revokes all customer surfaces including invitation APIs | **Broken — SEC-02** |
| Invitation credential vaulting matches `/setup` | **Broken — SEC-03** |
| DB actor authorization for role-only changes | **Missing — SEC-04** |
| Exclusive one-customer-per-implementation on account-type conversion | **Broken — SEC-05** |
| Post-submit property immutability enforced in RLS | **Missing — SEC-06** |
| App-layer OTP verify throttle | **Missing — SEC-07** |
| Logout clears all BookMax auth cookies | **Missing — SEC-08** |

### Unverified (not confirmed defects)

| Item | Why unverified |
| --- | --- |
| QA vs production project isolation | Migrations comment QA project id and “do not apply to Production without CTO approval,” but this review did not inspect live Supabase/Vercel project linkage, shared keys, or applied-migration drift |
| Whether invitation flow is still customer-facing in production | Routes and UI exist in-repo; traffic/feature-flag state not observed |
| Supabase Auth OTP verify lockout / rate limits | App verify throttle absent (SEC-07); platform-side limits not verified |
| OTP send throttle effectiveness under multi-instance deploy | In-process `Map` only; not elevated beyond residual without proving platform gap |
| Session cookie flags from `@supabase/ssr` in deployed HTTPS | Code uses library defaults; live response headers not captured |
| Whether `CREDENTIAL_ENCRYPTION_KEY` is set and rotated in each environment | `.env.example` documents it; runtime secrets not inspected |
| Cross-tenant isolation under concurrent Admin attach races | SQL comments describe locking; not dynamically proven here |
| Historical prototype file store / `data/poc-submissions.json` in any deployed filesystem | Live submission paths reviewed no longer call `prototypePersistence`; residual file risk not proven on current request paths |
| Invitation claim HMAC independent expiry | Claim has no `exp` in payload; mitigated by cookie maxAge + matching session — residual only |

---

## Findings by review area

### 1. Supabase authentication, email OTP, session, tokens

- Access OTP: identity-only, no user creation, no email oracle on missing identity — **sound**.
- Invitation OTP: `shouldCreateUser: true` after resolvable invitation — **intentional** for first bind; bind rules enforce email match.
- Invitation bearer: random 32+ bytes, SHA-256 at rest — **sound**.
- Invitation claim: HMAC with server secret, timing-safe verify — **sound**; no independent claim expiry — residual (see Unverified).
- Pending-email cookie httpOnly — **sound**.
- App-layer verify throttle missing — **SEC-07**; logout cookie cleanup incomplete — **SEC-08**.

### 2. Customer / Engineer / Admin authorization

- Server decision matrix in `resolveAuthorization` is the intended source of truth for `/access` and `/setup`.
- Users & Access mutations require Admin at HTTP and service layers.
- Engineer/Admin can mutate submissions and reveal credentials; viewer cannot mutate/reveal — **verified**.
- Proxy (`proxy.ts`) for `/implementation/users` and submissions only checks **any** authenticated user; **page** guards enforce role. Residual gap mitigated for HTML/RSC; not elevated to a confirmed exploit.

### 3. RLS and tenant isolation

- Modern customer tables: membership-scoped policies; disabled status enforced on those policies — **verified in SQL**.
- Credentials table: no authenticated policies — **verified**.
- Invitation tables: own-bind policies; authenticated can write own drafts — **verified**; does not participate in disable status — contributes to **SEC-02**.
- Exclusive occupancy enforced on attach RPC but not on account-type conversion — **SEC-05**.
- Post-submit property immutability app-only, not RLS — **SEC-06**.
- Application service-role path must enforce ownership; setup APIs do via `assertOwns*` — **verified in code**. Live PostgREST abuse testing not performed.

### 4. Privilege escalation, role changes, disable, last Admin

- Last-Admin: application checks + DB trigger — **verified**.
- Disable/reactivate: atomic RPC + Admin actor check + trigger — **verified**.
- Disable incomplete across invitation surface — **SEC-02**.
- Role-only change weaker at DB — **SEC-04**.

### 5. SECURITY DEFINER, API authorization, secrets

- DEFINER functions reviewed pin `search_path`, check Admin actor, limit execute to `service_role` — **verified for access RPCs**.
- Actor id is a parameter trusted from service-role callers; safety depends on app passing JWT user id (Users routes do via `requireAdmin`) — **verified for those routes**.
- Secret key prefix guards — **verified**.
- Unauthenticated service-role probe — **SEC-01**.
- Invitation credential discard — **SEC-03**.

### 6. QA / production environment isolation

- **Unverified.** Repository contains procedural comments only; no enforceable app gate separating QA and production data planes was found. Treat as release governance gap until platform evidence is attached.

---

## Security readiness verdict

| Question | Answer |
| --- | --- |
| P0 confirmed? | **No** |
| P1 confirmed? | **Yes — SEC-01, SEC-02, SEC-03, SEC-05** |
| P2 confirmed? | **Yes — SEC-04, SEC-06, SEC-07, SEC-08** |
| Production security acceptance? | **NO — not ready** |
| Minimum to re-review toward acceptance | Fix SEC-01, SEC-02, SEC-03, SEC-05 with tests; track or fix P2s; attach proof of QA/prod project and secret isolation |

**Cursor cannot approve its own work.** An independent engineer must verify remediations against the acceptance criteria above using reproducible evidence (HTTP traces, SQL policy dumps, tests), not model assertions alone.
