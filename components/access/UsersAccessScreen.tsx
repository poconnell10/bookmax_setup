"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TraqraSelect } from "@/components/setup/TraqraSelect";
import { isInternalEligibleEmail } from "@/lib/access/internal-eligibility";
import type {
  AccessAuditView,
  AccessUserView,
  AttachableImplementation,
  AttachableImplementations,
  ImplementationOption,
} from "@/lib/implementation/access/types";
import type { InternalRole } from "@/lib/implementation/internal/types";

type FilterKey = "" | "pending" | "customers" | "internal" | "engineers" | "admins" | "viewer";
type DrawerMode = "closed" | "provision" | "manage";
type ConfirmAction =
  | { kind: "role"; role: InternalRole }
  | { kind: "promote"; role: "admin" }
  | { kind: "disable" }
  | { kind: "enable" }
  | { kind: "convertInternal"; role: InternalRole }
  | { kind: "convertCustomer"; implementationId: string | null };

type AuditRow = AccessAuditView & {
  actorUserId?: string;
  previousState?: Record<string, string | number | boolean | null>;
  newState?: Record<string, string | number | boolean | null>;
};

const ROLEDEF = {
  admin: {
    l: "Admin",
    tone: "adm",
    type: "Internal",
    can: ["Users & Access", "Submissions and detail", "Change submission status", "Reveal credentials"],
    cant: [] as string[],
  },
  engineer: {
    l: "Engineer",
    tone: "info",
    type: "Internal",
    can: ["Submissions and detail", "Change submission status", "Approved credential workflow"],
    cant: ["Users & Access"],
  },
  viewer: {
    l: "Viewer",
    tone: "mut",
    type: "Internal",
    can: ["Submissions and detail, read-only"],
    cant: ["Change submission status", "Reveal credentials", "Users & Access"],
  },
  customer: {
    l: "Customer",
    tone: "ok",
    type: "Customer",
    can: ["Their own BookMax Setup"],
    cant: ["Submissions", "Users & Access", "Any other customer"],
  },
} as const;

const AULABEL: Record<string, string> = {
  USER_PROVISIONED: "Access granted",
  ROLE_CHANGED: "Role changed",
  ACCESS_DISABLED: "Access disabled",
  ACCESS_REACTIVATED: "Access reactivated",
  CUSTOMER_ASSIGNMENT_CHANGED: "Implementation changed",
  ACCOUNT_TYPE_CHANGED: "Account type changed",
  CUSTOMER_PROPERTY_SAVED: "Property saved by Admin",
};

const ASSIGNMENT_MODE: Record<string, string> = {
  attached: "attached to an existing property",
  created: "new implementation started",
};

function propertySetupHref(userId: string, implementationId: string) {
  return `/setup/property?${new URLSearchParams({ customer: userId, implementation: implementationId })}`;
}

const ACCOUNT_OPTIONS = [
  { v: "", label: "All account types" },
  { v: "pending", label: "Pending", desc: "Authenticated, not yet provisioned" },
  { v: "customers", label: "Customers" },
  { v: "internal", label: "Internal" },
  { v: "admins", label: "Admin" },
  { v: "engineers", label: "Engineer" },
  { v: "viewer", label: "Viewer" },
];

const STATUS_OPTIONS = [
  { v: "", label: "Any status" },
  { v: "pending", label: "Pending" },
  { v: "active", label: "Active" },
  { v: "disabled", label: "Disabled" },
];

function roleLabel(role: AccessUserView["role"]) {
  if (!role) {
    return null;
  }
  return ROLEDEF[role].l;
}

function roleTone(role: AccessUserView["role"]) {
  if (!role) {
    return "mut";
  }
  return ROLEDEF[role].tone;
}

function accountLabel(type: AccessUserView["accountType"]) {
  if (type === "internal") return "Internal";
  if (type === "customer") return "Customer";
  return "Unassigned";
}

function statusBadge(status: AccessUserView["status"]) {
  if (status === "pending") return { label: "Pending", tone: "pend" };
  if (status === "disabled") return { label: "Disabled", tone: "off" };
  return { label: "Active", tone: "ok" };
}

function formatWhen(value: string | null) {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatAuditWhen(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function CanIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Capabilities({ role }: { role: keyof typeof ROLEDEF }) {
  const def = ROLEDEF[role];
  return (
    <span className="caps">
      {def.can.length ? (
        <span className="capg">
          <span className="capk">Can</span>
          {def.can.map((item) => (
            <span key={item} className="cap y">
              <CanIcon ok />
              {item}
            </span>
          ))}
        </span>
      ) : null}
      {def.cant.length ? (
        <span className="capg">
          <span className="capk">Cannot</span>
          {def.cant.map((item) => (
            <span key={item} className="cap n">
              <CanIcon ok={false} />
              {item}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function IdentityCard({
  user,
  provisionedBy,
}: {
  user: AccessUserView;
  provisionedBy: string | null;
}) {
  return (
    <div className="idcard">
      {user.name ? <div className="nm2">{user.name}</div> : null}
      <div className="em">{user.email}</div>
      <div className="idmeta">
        <span className="kv">
          <span className="kk">Identity</span>
          <span className="kd">{user.role ? "Provisioned" : "Verified, not provisioned"}</span>
        </span>
        <span className="kv">
          <span className="kk">First sign-in</span>
          <span className="kd">{formatWhen(user.firstSignInAt)}</span>
        </span>
        <span className="kv">
          <span className="kk">Last sign-in</span>
          <span className="kd">{formatWhen(user.lastSignInAt)}</span>
        </span>
        {provisionedBy ? (
          <span className="kv">
            <span className="kk">Provisioned by</span>
            <span className="kd">{provisionedBy}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function UsersAccessScreen({
  initialUsers,
  initialImplementations,
  initialAttachable = { options: [], hiddenCount: 0 },
  initialManageUserId = null,
}: {
  initialUsers: AccessUserView[];
  initialImplementations: ImplementationOption[];
  initialAttachable?: AttachableImplementations;
  initialManageUserId?: string | null;
}) {
  const router = useRouter();
  const initialManageRow = initialManageUserId
    ? (initialUsers.find((item) => item.userId === initialManageUserId) ?? null)
    : null;
  const [users, setUsers] = useState<AccessUserView[]>(initialUsers);
  const [implementations, setImplementations] = useState<ImplementationOption[]>(initialImplementations);
  const [attachable, setAttachable] = useState<AttachableImplementations>(initialAttachable);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<AccessUserView | null>(initialManageRow);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [mode, setMode] = useState<DrawerMode>(initialManageRow ? "manage" : "closed");
  const [accountType, setAccountType] = useState<"internal" | "customer" | null>(null);
  const [role, setRole] = useState<InternalRole | null>(null);
  const [propertyName, setPropertyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [implementationId, setImplementationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMode("closed");
        setConfirm(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function load() {
    const response = await fetch("/api/implementation/users");
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      users?: AccessUserView[];
      implementations?: ImplementationOption[];
      attachable?: AttachableImplementations;
    };
    if (!response.ok || !payload.ok) {
      setError(payload.error || "Users & Access could not be loaded.");
      return users;
    }
    const next = payload.users ?? [];
    setUsers(next);
    setImplementations(payload.implementations ?? []);
    setAttachable(payload.attachable ?? { options: [], hiddenCount: 0 });
    setError("");
    return next;
  }

  const counts = useMemo(
    () => ({
      all: users.length,
      pending: users.filter((row) => row.status === "pending").length,
      customers: users.filter((row) => row.accountType === "customer").length,
      engineers: users.filter((row) => row.role === "engineer").length,
      admins: users.filter((row) => row.role === "admin").length,
    }),
    [users],
  );

  const filtered = users.filter((row) => {
    const haystack = `${row.name ?? ""} ${row.email} ${roleLabel(row.role) ?? ""}`.toLowerCase();
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) {
      return false;
    }
    if (filter === "pending" && row.status !== "pending") return false;
    if (filter === "customers" && row.accountType !== "customer") return false;
    if (filter === "internal" && row.accountType !== "internal") return false;
    if (filter === "engineers" && row.role !== "engineer") return false;
    if (filter === "admins" && row.role !== "admin") return false;
    if (filter === "viewer" && row.role !== "viewer") return false;
    if (statusFilter && row.status !== statusFilter) return false;
    return true;
  });

  function actorLabel(userId: string | null | undefined) {
    if (!userId) {
      return null;
    }
    const row = users.find((item) => item.userId === userId);
    return row?.name || row?.emailMasked || null;
  }

  function lastAdmin(row: AccessUserView) {
    return (
      row.role === "admin" &&
      row.status === "active" &&
      users.filter((item) => item.role === "admin" && item.status === "active").length === 1
    );
  }

  async function openManage(row: AccessUserView) {
    setSelected(row);
    setMode("manage");
    setConfirm(null);
    setRole(row.role === "admin" || row.role === "engineer" || row.role === "viewer" ? row.role : "engineer");
    setImplementationId(row.implementationId ?? implementations[0]?.id ?? "");
    const response = await fetch(`/api/implementation/users/${row.userId}`);
    const payload = (await response.json()) as {
      ok?: boolean;
      audit?: AuditRow[];
      user?: AccessUserView;
    };
    if (response.ok && payload.ok) {
      setAudit(payload.audit ?? []);
      if (payload.user) {
        setSelected(payload.user);
        setImplementationId(payload.user.implementationId ?? implementations[0]?.id ?? "");
      }
    }
  }

  // Returning from /setup/property reopens this person's drawer with fresh history.
  const linkedUserId = useRef(initialManageRow?.userId ?? null);
  useEffect(() => {
    const userId = linkedUserId.current;
    if (!userId) {
      return;
    }
    linkedUserId.current = null;
    void (async () => {
      const response = await fetch(`/api/implementation/users/${userId}`);
      const payload = (await response.json()) as { ok?: boolean; audit?: AuditRow[] };
      if (response.ok && payload.ok) {
        setAudit(payload.audit ?? []);
      }
    })();
  }, []);

  async function changeImplementation(implementationId: string | null) {
    if (!selected || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/implementation/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          implementationId
            ? { userId: selected.userId, action: "assign", implementationId }
            : { userId: selected.userId, action: "newImplementation" },
        ),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; user?: AccessUserView };
      if (!response.ok || !payload.ok || !payload.user) {
        setError(payload.error || "That access change could not be saved.");
        return;
      }
      if (!implementationId) {
        if (payload.user.implementationId) {
          router.push(propertySetupHref(payload.user.userId, payload.user.implementationId));
        }
        return;
      }
      const next = await load();
      const updated = next.find((row) => row.userId === selected.userId) ?? payload.user;
      await openManage(updated);
      setToast("Property attached");
    } finally {
      setBusy(false);
    }
  }

  function openProvision(row?: AccessUserView) {
    const target = row ?? users.find((item) => item.status === "pending") ?? null;
    setSelected(target);
    setMode("provision");
    setAccountType(null);
    setRole(null);
    setPropertyName("");
    setContactName("");
    setAudit([]);
    setConfirm(null);
  }

  function closeDrawer() {
    setMode("closed");
    setConfirm(null);
  }

  async function provision() {
    if (!selected || busy || !accountType) {
      return;
    }
    if (accountType === "internal" && !role) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/implementation/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          accountType === "customer"
            ? {
                userId: selected.userId,
                accountType,
                property: propertyName.trim() ? { name: propertyName, contactName } : null,
              }
            : { userId: selected.userId, accountType, role },
        ),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "Access could not be granted.");
        return;
      }
      closeDrawer();
      await load();
      setToast(`${accountType === "customer" ? "Customer" : ROLEDEF[role!].l} access granted`);
    } finally {
      setBusy(false);
    }
  }

  async function commit(action: ConfirmAction) {
    if (!selected || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body =
        action.kind === "role" || action.kind === "promote"
          ? { userId: selected.userId, action: "role", role: action.role }
          : action.kind === "disable"
            ? { userId: selected.userId, action: "disable" }
            : action.kind === "enable"
              ? { userId: selected.userId, action: "reactivate" }
              : action.kind === "convertInternal"
                ? {
                    userId: selected.userId,
                    action: "accountType",
                    accountType: "internal",
                    role: action.role,
                  }
                : action.kind === "convertCustomer"
                  ? {
                      userId: selected.userId,
                      action: "accountType",
                      accountType: "customer",
                      implementationId: action.implementationId,
                    }
                  : null;
      if (!body) {
        return;
      }
      const response = await fetch("/api/implementation/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "That access change could not be saved.");
        setConfirm(null);
        return;
      }
      const next = await load();
      const updated = next.find((row) => row.userId === selected.userId) ?? selected;
      setConfirm(null);
      setSelected(updated);
      await openManage(updated);
      if (action.kind === "disable") setToast("Access disabled");
      else if (action.kind === "enable") setToast("Access reactivated");
      else if (action.kind === "convertCustomer") setToast("Changed to Customer");
      else if (action.kind === "convertInternal") setToast(`Changed to Internal / ${ROLEDEF[action.role].l}`);
      else setToast(`Role changed to ${ROLEDEF[action.role].l}`);
    } finally {
      setBusy(false);
    }
  }

  const propertyComplete = Boolean(propertyName.trim()) === Boolean(contactName.trim());
  const provisionReady =
    accountType === "internal" ? Boolean(role) : accountType === "customer" && propertyComplete;

  const chipOn = (key: FilterKey) => filter === key && !statusFilter;

  return (
    <>
    <div className="ua">
      <div className="phead">
        <div>
          <h1>Users &amp; Access</h1>
          <p className="lede">Manage who can access BookMax and what they are authorized to do.</p>
        </div>
        <button className="btn pri" type="button" onClick={() => openProvision()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Provision user
        </button>
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sums">
        {(
          [
            ["", "All users", counts.all, false],
            ["pending", "Pending", counts.pending, true],
            ["customers", "Customers", counts.customers, false],
            ["engineers", "Engineers", counts.engineers, false],
            ["admins", "Admins", counts.admins, false],
          ] as const
        ).map(([key, label, value, alert]) => (
          <button
            key={label}
            type="button"
            className={`sm2${chipOn(key) ? " on" : ""}${alert && value ? " alert" : ""}`}
            onClick={() => {
              setFilter(key);
              setStatusFilter("");
            }}
          >
            <span className="k">{label}</span>
            <span className="v">{value}</span>
          </button>
        ))}
      </div>
      <div className="filters">
        <div className="srch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
          />
        </div>
        <TraqraSelect
          id="frole"
          value={filter}
          searchable={false}
          ariaLabel="Account type"
          placeholder="All account types"
          options={ACCOUNT_OPTIONS.map((item) => ({ value: item.v, label: item.label, desc: item.desc }))}
          onChange={(value) => setFilter(value as FilterKey)}
        />
        <TraqraSelect
          id="fstat"
          value={statusFilter}
          searchable={false}
          ariaLabel="Status"
          placeholder="Any status"
          options={STATUS_OPTIONS.map((item) => ({ value: item.v, label: item.label }))}
          onChange={setStatusFilter}
        />
        <span className="count">
          {filtered.length} of {users.length}
        </span>
      </div>
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <b>No users match these filters.</b>
            <br />
            Clear the search or filters to see everyone.
          </div>
        ) : (
          filtered.map((row) => {
            const pending = row.status === "pending";
            const status = statusBadge(row.status);
            return (
              <article key={row.userId} className={`row${pending ? " pend" : ""}`}>
                <div>
                  <span className="fk">User</span>
                  <span className={`fv${row.name ? "" : " na"}`}>
                    {row.name || "Not provided yet"}
                    <span className="sub2">{row.emailMasked}</span>
                  </span>
                </div>
                <div>
                  <span className="fk">Account type</span>
                  <span className={`fv acct${pending ? " na" : ""}`}>{accountLabel(row.accountType)}</span>
                </div>
                <div>
                  <span className="fk">Role</span>
                  {row.role ? (
                    <span className={`bd ${roleTone(row.role)}`}>{roleLabel(row.role)}</span>
                  ) : (
                    <span className="fv na">—</span>
                  )}
                </div>
                <div>
                  <span className="fk">Status</span>
                  <span className={`bd ${status.tone}`}>{status.label}</span>
                </div>
                <div>
                  <span className="fk">Last sign-in</span>
                  <span className="fv signin">{formatWhen(row.lastSignInAt)}</span>
                </div>
                <div className="ract">
                  {pending ? (
                    <button type="button" className="btn sm pri" onClick={() => openProvision(row)}>
                      Provision
                    </button>
                  ) : (
                    <button type="button" className="btn sm" onClick={() => void openManage(row)}>
                      Manage
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>

      {mode !== "closed" ? (
        <>
          <div className="scrim on" role="presentation" onClick={closeDrawer} />
          <aside className="drw on" aria-label={mode === "provision" ? "Provision user" : "Manage access"}>
            <div className="dhd">
              <div>
                <div className="t">{mode === "provision" ? "Provision user" : "Manage access"}</div>
                <div className="s">
                  {mode === "provision"
                    ? selected
                      ? "This person has verified their email but has no BookMax access yet."
                      : "A person can only be provisioned after they have verified their email at least once."
                    : "Changes take effect on this person’s next request and are recorded."}
                </div>
              </div>
              <button type="button" className="x" onClick={closeDrawer} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="dbd">
              {mode === "provision" ? (
                <ProvisionBody
                  selected={selected}
                  accountType={accountType}
                  role={role}
                  pendingCount={counts.pending}
                  internalEligible={Boolean(selected && isInternalEligibleEmail(selected.email))}
                  onAccountType={(value) => {
                    setAccountType(value);
                    setRole(null);
                  }}
                  onRole={setRole}
                  propertyName={propertyName}
                  contactName={contactName}
                  onPropertyName={setPropertyName}
                  onContactName={setContactName}
                />
              ) : selected && confirm ? (
                <ConfirmBody user={selected} action={confirm} />
              ) : selected ? (
                <ManageBody
                  user={selected}
                  audit={audit}
                  implementations={implementations}
                  implementationId={implementationId}
                  blocked={lastAdmin(selected)}
                  provisionedBy={actorLabel(selected.provisionedBy)}
                  onRole={(next) => setConfirm(next === "admin" && selected.role !== "admin" ? { kind: "promote", role: "admin" } : { kind: "role", role: next })}
                  attachable={attachable.options}
                  hiddenCount={attachable.hiddenCount}
                  busy={busy}
                  actorLabel={actorLabel}
                  onAttach={(id) => void changeImplementation(id)}
                  onCreate={() => void changeImplementation(null)}
                  onContinue={() => {
                    if (selected.implementationId) {
                      router.push(propertySetupHref(selected.userId, selected.implementationId));
                    }
                  }}
                  onConvertInternal={(next) =>
                    setConfirm(next === "admin" ? { kind: "convertInternal", role: "admin" } : { kind: "convertInternal", role: next })
                  }
                  onConvertCustomer={(id) => {
                    setImplementationId(id ?? "");
                    setConfirm({ kind: "convertCustomer", implementationId: id });
                  }}
                  onPickImplementation={setImplementationId}
                />
              ) : null}
            </div>
            <div className="dft">
              {mode === "provision" ? (
                selected ? (
                  <>
                    <span className="count">{accountType ? "" : "Choose an account type"}</span>
                    <div className="r">
                      <button type="button" className="btn" onClick={closeDrawer}>
                        Cancel
                      </button>
                      <button type="button" className="btn pri" disabled={busy || !provisionReady} onClick={() => void provision()}>
                        Grant access
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="count">Pending: {counts.pending}</span>
                    <div className="r">
                      <button type="button" className="btn" onClick={closeDrawer}>
                        Close
                      </button>
                    </div>
                  </>
                )
              ) : confirm && selected ? (
                <>
                  <span />
                  <div className="r">
                    <button type="button" className="btn" onClick={() => setConfirm(null)}>
                      Back
                    </button>
                    <button
                      type="button"
                      className={`btn ${confirm.kind === "disable" ? "dgr" : "pri"}`}
                      disabled={busy}
                      onClick={() => void commit(confirm)}
                    >
                      {confirm.kind === "promote" || (confirm.kind === "convertInternal" && confirm.role === "admin")
                        ? "Promote to Admin"
                        : confirm.kind === "convertInternal"
                          ? `Change to ${ROLEDEF[confirm.role].l}`
                          : confirm.kind === "convertCustomer"
                            ? "Change to Customer"
                            : confirm.kind === "disable"
                              ? "Disable access"
                              : confirm.kind === "enable"
                                ? "Reactivate"
                                : "Confirm change"}
                    </button>
                  </div>
                </>
              ) : selected ? (
                <>
                  <span />
                  <div className="r">
                    <button type="button" className="btn" onClick={closeDrawer}>
                      Close
                    </button>
                    {selected.status === "disabled" ? (
                      <button type="button" className="btn pri" disabled={busy} onClick={() => setConfirm({ kind: "enable" })}>
                        Reactivate access
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn dgr"
                        disabled={busy || lastAdmin(selected)}
                        onClick={() => setConfirm({ kind: "disable" })}
                      >
                        Disable access
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {toast ? (
        <div className="toast on" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{toast}</span>
        </div>
      ) : null}
    </>
  );
}

function ProvisionBody({
  selected,
  accountType,
  role,
  pendingCount,
  internalEligible,
  onAccountType,
  onRole,
  propertyName,
  contactName,
  onPropertyName,
  onContactName,
}: {
  selected: AccessUserView | null;
  accountType: "internal" | "customer" | null;
  role: InternalRole | null;
  pendingCount: number;
  internalEligible: boolean;
  onAccountType: (value: "internal" | "customer") => void;
  onRole: (value: InternalRole) => void;
  propertyName: string;
  contactName: string;
  onPropertyName: (value: string) => void;
  onContactName: (value: string) => void;
}) {
  if (!selected) {
    return (
      <div className="empty" style={{ padding: "30px 20px" }}>
        <b>Nobody is waiting to be provisioned.</b>
        <br />
        Access is granted to an identity that already exists. Ask the person to sign in at the BookMax URL and verify
        their email — they will then appear here as Pending.
        {pendingCount ? <div className="count" style={{ marginTop: 12 }}>Pending: {pendingCount}</div> : null}
      </div>
    );
  }

  return (
    <>
      <IdentityCard user={selected} provisionedBy={null} />
      <div className="sq">Account type</div>
      <div className="opts">
        <button
          type="button"
          className={`opt${accountType === "customer" ? " on" : ""}`}
          onClick={() => onAccountType("customer")}
        >
          <span className="rd" />
          <span>
            <span className="ol">Customer</span>
            <span className="od">Can complete their own BookMax Setup and nothing else.</span>
          </span>
        </button>
        {internalEligible ? (
          <button
            type="button"
            className={`opt${accountType === "internal" ? " on" : ""}`}
            onClick={() => onAccountType("internal")}
          >
            <span className="rd" />
            <span>
              <span className="ol">Internal</span>
              <span className="od">A member of the implementation team.</span>
            </span>
          </button>
        ) : null}
      </div>
      {accountType === "internal" && internalEligible ? (
        <>
          <div className="sq">Role</div>
          <div className="opts">
            {(["engineer", "viewer", "admin"] as const).map((next) => (
              <button
                key={next}
                type="button"
                className={`opt${role === next ? " on" : ""}`}
                onClick={() => onRole(next)}
              >
                <span className="rd" />
                <span>
                  <span className="ol">{ROLEDEF[next].l}</span>
                  {role === next ? <Capabilities role={next} /> : <span className="od">{ROLEDEF[next].can[0]}</span>}
                </span>
              </button>
            ))}
          </div>
          {role === "admin" ? (
            <div className="warn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span>
                <b>Admins can grant and remove access, including yours.</b> Only provision an Admin when that person
                needs to manage users themselves.
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      {accountType === "customer" ? (
        <>
          <div className="sq">What this creates</div>
          <div className="idcard">
            <div className="kd">
              A new BookMax implementation is created for this person and they are its only member.{" "}
              {propertyName.trim()
                ? "Their property is created now, and they start at the PMS step."
                : "They start at their own property step and add their property themselves."}
            </div>
            <div className="hint">
              Customer access is scoped to that one implementation. They will never see another customer&apos;s setup.
            </div>
          </div>
          <div className="sq">Property · optional</div>
          <div className="f">
            <label htmlFor="prov-pname">Property name</label>
            <input
              id="prov-pname"
              placeholder="e.g. The Gritti Palace"
              value={propertyName}
              onChange={(event) => onPropertyName(event.target.value)}
            />
          </div>
          <div className="f" style={{ marginTop: 10 }}>
            <label htmlFor="prov-cname">Contact name</label>
            <input
              id="prov-cname"
              placeholder="e.g. Maria Rossi"
              value={contactName}
              onChange={(event) => onContactName(event.target.value)}
            />
            <div className="hint">
              Leave both empty to let the customer add their property. PMS and POS are connected by the customer.
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function ManageBody({
  user,
  audit,
  implementations,
  implementationId,
  blocked,
  provisionedBy,
  attachable,
  hiddenCount,
  busy,
  actorLabel,
  onRole,
  onAttach,
  onCreate,
  onContinue,
  onConvertInternal,
  onConvertCustomer,
  onPickImplementation,
}: {
  user: AccessUserView;
  audit: AuditRow[];
  implementations: ImplementationOption[];
  implementationId: string;
  blocked: boolean;
  provisionedBy: string | null;
  attachable: AttachableImplementation[];
  hiddenCount: number;
  busy: boolean;
  actorLabel: (userId: string | null | undefined) => string | null;
  onRole: (role: InternalRole) => void;
  onAttach: (id: string) => void;
  onCreate: () => void;
  onContinue: () => void;
  onConvertInternal: (role: InternalRole) => void;
  onConvertCustomer: (id: string | null) => void;
  onPickImplementation: (id: string) => void;
}) {
  const def = user.role ? ROLEDEF[user.role] : null;
  const internal = user.accountType === "internal" && user.status === "active";
  const customer = user.accountType === "customer" && user.status === "active";
  const internalEligible = isInternalEligibleEmail(user.email);
  const status = statusBadge(user.status);

  return (
    <>
      <IdentityCard user={user} provisionedBy={provisionedBy} />
      <div className="sq">Access now</div>
      <div className="idcard access-now">
        <div className="access-now-badges">
          {def ? <span className={`bd ${def.tone}`}>{def.l}</span> : null}
          <span className={`bd ${status.tone}`}>{status.label}</span>
          {user.implementationName ? <span className="kd impl-name">{user.implementationName}</span> : null}
        </div>
        {user.role ? <Capabilities role={user.role} /> : null}
      </div>
      {user.status === "disabled" ? (
        <div className="lock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            <b>Access is disabled.</b> They can still verify their email, but every protected request is refused. Their
            history is kept.
          </span>
        </div>
      ) : null}
      {customer && internalEligible ? (
        <>
          <div className="sq">Change account type</div>
          <div className="opts">
            {(["engineer", "admin"] as const).map((next) => (
              <button key={next} type="button" className="opt" onClick={() => onConvertInternal(next)}>
                <span className="rd" />
                <span>
                  <span className="ol">{next === "admin" ? "Internal / Admin" : "Internal / Engineer"}</span>
                  <span className="od">
                    {next === "admin"
                      ? "Can manage Users & Access, including this conversion."
                      : "Can work Submissions. Cannot open Users & Access."}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      {internal ? (
        <>
          <div className="sq">Change role</div>
          <div className="opts">
            {(["engineer", "viewer", "admin"] as const)
              .filter((next) => next !== user.role)
              .map((next) => {
                const lock = blocked && next !== "admin";
                return (
                  <button
                    key={next}
                    type="button"
                    className="opt"
                    disabled={lock}
                    onClick={() => onRole(next)}
                  >
                    <span className="rd" />
                    <span>
                      <span className="ol">{next === "admin" ? "Promote to Admin" : `Change to ${ROLEDEF[next].l}`}</span>
                      <span className="od">
                        {lock
                          ? "Not available — this is the last active Admin."
                          : ROLEDEF[next].can.join(" · ")}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
          {blocked ? null : (
            <>
              <div className="sq">Change account type</div>
              <div className="opts">
                <button
                  type="button"
                  className="opt"
                  onClick={() => onConvertCustomer(implementationId || null)}
                >
                  <span className="rd" />
                  <span>
                    <span className="ol">Customer</span>
                    <span className="od">Can complete their own BookMax Setup and nothing else.</span>
                  </span>
                </button>
              </div>
              <div className="f" style={{ marginTop: 0 }}>
                <TraqraSelect
                  id="cimpl"
                  value={implementationId}
                  searchable
                  placeholder="Select the implementation"
                  ariaLabel="Customer implementation"
                  options={implementations.map((option) => ({
                    value: option.id,
                    label: option.name,
                    desc: option.id,
                  }))}
                  onChange={onPickImplementation}
                />
                <div className="hint">
                  Choosing an implementation moves them into that existing setup. With none chosen, a new BookMax
                  implementation is created for them. Email domain does not grant this.
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
      {customer ? (
        <>
          <div className="sq">Implementation</div>
          <ImplementationSection
            key={user.implementationId ?? "none"}
            user={user}
            audit={audit}
            attachable={attachable}
            hiddenCount={hiddenCount}
            busy={busy}
            actorLabel={actorLabel}
            onAttach={onAttach}
            onCreate={onCreate}
            onContinue={onContinue}
          />
        </>
      ) : null}
      <div className="sq">Access history</div>
      {audit.length ? (
        <div className="aud">
          {audit.map((event) => (
            <div key={event.id} className="ae">
              <span className="at">{formatAuditWhen(event.createdAt)}</span>
              <span className="av">
                <b>{AULABEL[event.eventType] || event.eventType.replaceAll("_", " ")}</b>
                {event.newState?.role ? ` · ${String(event.newState.role)}` : ""}
                {typeof event.newState?.mode === "string" && ASSIGNMENT_MODE[event.newState.mode]
                  ? ` · ${ASSIGNMENT_MODE[event.newState.mode]}`
                  : ""}
                <i>
                  {event.eventType}
                </i>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="kd na">No changes recorded yet.</div>
      )}
      {blocked ? (
        <div className="lock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>
            <b>This is the last active Admin.</b> Their role cannot be changed and their access cannot be disabled —
            doing so would leave nobody able to manage BookMax access.
          </span>
        </div>
      ) : null}
    </>
  );
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function ImplementationSection({
  user,
  audit,
  attachable,
  hiddenCount,
  busy,
  actorLabel,
  onAttach,
  onCreate,
  onContinue,
}: {
  user: AccessUserView;
  audit: AuditRow[];
  attachable: AttachableImplementation[];
  hiddenCount: number;
  busy: boolean;
  actorLabel: (userId: string | null | undefined) => string | null;
  onAttach: (id: string) => void;
  onCreate: () => void;
  onContinue: () => void;
}) {
  const linked = user.implementationSetup === "draft" || user.implementationSetup === "submitted";
  const [view, setView] = useState<"linked" | "choose" | "picker" | "confirm">(linked ? "linked" : "choose");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<AttachableImplementation | null>(null);

  const q = search.trim().toLowerCase();
  const named = attachable.filter((row) => row.propertyName && (!q || row.propertyName.toLowerCase().includes(q)));
  const unnamed = q ? [] : attachable.filter((row) => !row.propertyName);

  if (view === "picker") {
    return (
      <div className="idcard" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Attach to an existing property</b>
          <button type="button" className="btn sm" onClick={() => setView(linked ? "linked" : "choose")}>
            Cancel
          </button>
        </div>
        <div className="f" style={{ padding: "0 14px 10px", margin: 0 }}>
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search property name…"
            aria-label="Search property name"
          />
          <div className="hint">
            {attachable.length} {attachable.length === 1 ? "property" : "properties"} with no customer attached
          </div>
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", padding: "0 6px 6px" }} role="listbox" aria-label="Properties">
          {named.map((row) => (
            <button
              key={row.id}
              type="button"
              className="opt"
              role="option"
              aria-selected={false}
              onClick={() => {
                setPicked(row);
                setView("confirm");
              }}
            >
              <span>
                <span className="ol">{row.propertyName}</span>
                <span className="od" style={{ fontFamily: MONO, fontSize: 11 }}>
                  {row.id}
                </span>
              </span>
            </button>
          ))}
          {q && !named.length ? <div className="kd na" style={{ padding: "12px 10px" }}>No unassigned property matches “{search}”.</div> : null}
          {unnamed.length ? (
            <>
              <div className="sq" style={{ padding: "8px 10px 0" }}>
                No name entered yet
              </div>
              {unnamed.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="opt"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setPicked(row);
                    setView("confirm");
                  }}
                >
                  <span>
                    <span className="ol" style={{ fontStyle: "italic", fontWeight: 400 }}>
                      Untitled property · created {formatAuditWhen(row.createdAt)}
                    </span>
                    <span className="od" style={{ fontFamily: MONO, fontSize: 11 }}>
                      {row.id}
                    </span>
                  </span>
                </button>
              ))}
            </>
          ) : null}
        </div>
        <div className="hint" style={{ padding: "10px 14px", borderTop: "1px solid var(--line, #e5e7eb)", margin: 0 }}>
          {hiddenCount} {hiddenCount === 1 ? "property that already belongs" : "properties that already belong"} to a
          customer {hiddenCount === 1 ? "is" : "are"} hidden and can’t be reassigned from here.
        </div>
      </div>
    );
  }

  if (view === "confirm" && picked) {
    const label = picked.propertyName || "Untitled property";
    return (
      <div className="confirm pu">
        <div className="ct">{label}</div>
        <div className="kd" style={{ fontFamily: MONO, fontSize: 11 }}>
          {picked.id}
        </div>
        <div className="sq">What happens</div>
        <ul className="cd2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
          <li>
            This person becomes the customer for <b>{label}</b> and can open its setup.
          </li>
          <li>Any details already entered stay as they are.</li>
          <li>It drops out of this list for other customers. Recorded as a governance event.</li>
          {linked ? <li>Their current setup is kept and becomes available to attach to another customer.</li> : null}
        </ul>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" className="btn sm" disabled={busy} onClick={() => setView("picker")}>
            Back
          </button>
          <button type="button" className="btn sm pri" disabled={busy} onClick={() => onAttach(picked.id)}>
            Attach property
          </button>
        </div>
      </div>
    );
  }

  if (view === "choose") {
    return (
      <>
        <div className="kd">
          {linked
            ? "Choose a different implementation for this person. Their current setup is kept and becomes available to attach to another customer."
            : "This customer isn’t linked to a property yet. Choose how to set them up."}
        </div>
        <div className="opts">
          <button type="button" className="opt" disabled={busy} onClick={() => setView("picker")}>
            <span className="rd" />
            <span>
              <span className="ol">Attach to an existing property</span>
              <span className="od">Give them access to a property that doesn’t belong to any customer yet.</span>
            </span>
          </button>
          <button type="button" className="opt" disabled={busy} onClick={onCreate}>
            <span className="rd" />
            <span>
              <span className="ol">Create a new implementation</span>
              <span className="od">
                Start property setup on their behalf. Saves once the property name and contact name are entered.
              </span>
            </span>
          </button>
        </div>
        {linked ? (
          <button type="button" className="btn sm" onClick={() => setView("linked")}>
            Cancel
          </button>
        ) : null}
      </>
    );
  }

  const latest = audit.find(
    (event) => event.eventType === "CUSTOMER_ASSIGNMENT_CHANGED" || event.eventType === "CUSTOMER_PROPERTY_SAVED",
  );
  const attachedLast = latest?.eventType === "CUSTOMER_ASSIGNMENT_CHANGED" && latest.newState?.mode === "attached";
  const submitted = user.implementationSetup === "submitted";
  return (
    <div className="idcard">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <span style={{ minWidth: 0 }}>
          <div className="nm2">{user.implementationName || "Untitled property"}</div>
          <div className="kd" style={{ fontFamily: MONO, fontSize: 11 }}>
            {user.implementationId}
          </div>
        </span>
        <span className={`bd ${submitted ? "ok" : "pend"}`}>{submitted ? "Submitted" : "Draft · started"}</span>
      </div>
      <div className="idmeta">
        {latest ? (
          <span className="kv">
            <span className="kk">{attachedLast ? "Attached by" : "Started by"}</span>
            <span className="kd">
              {actorLabel(latest.actorUserId) || "An Admin"} · {formatWhen(latest.createdAt)}
            </span>
          </span>
        ) : null}
        <span className="kv">
          <span className="kk">Progress</span>
          <span className="kd">{submitted ? "Submitted" : attachedLast ? "Customer to complete" : "Partial details saved"}</span>
        </span>
      </div>
      <div className="hint">
        {submitted
          ? "This setup has been submitted."
          : attachedLast
            ? "This person can now open this property’s setup on their next request."
            : "When this person next signs in, they land in this setup with these details already filled in."}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => setView("choose")}>
          Change implementation
        </button>
        {submitted ? null : (
          <button type="button" className="btn sm" disabled={busy} onClick={onContinue}>
            Continue in setup ↗
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmBody({ user, action }: { user: AccessUserView; action: ConfirmAction }) {
  const copy = {
    promote: {
      tone: "pu",
      title: "Promote to Admin?",
      body: `${user.name || user.email} will be able to grant and remove access for everyone, including you.`,
    },
    role: {
      tone: "pu",
      title: "Change this role?",
      body: "Their access changes immediately on their next request.",
    },
    disable: {
      tone: "",
      title: "Disable access?",
      body: `${user.name || user.email} will still be able to verify their email, but every protected request will be refused. Nothing is deleted.`,
    },
    enable: {
      tone: "",
      title: "Reactivate access?",
      body: "Their previous role and scope are restored.",
    },
    convertInternal: {
      tone: "pu",
      title: action.kind === "convertInternal" && action.role === "admin" ? "Change to Internal / Admin?" : "Change to Internal / Engineer?",
      body:
        action.kind === "convertInternal" && action.role === "admin"
          ? `${user.name || user.email} will lose customer setup access and will be able to grant and remove access for everyone, including you.`
          : `${user.name || user.email} will lose customer setup access and land on Submissions. Email domain does not grant this.`,
    },
    convertCustomer: {
      tone: "pu",
      title: "Change to Customer?",
      body: `${user.name || user.email} will lose internal workspace access and only be able to open the assigned implementation.`,
    },
  }[action.kind];

  const from =
    action.kind === "role" || action.kind === "promote" || action.kind === "convertInternal" || action.kind === "convertCustomer"
      ? `${accountLabel(user.accountType)}${user.role ? ` / ${roleLabel(user.role)}` : ""}`
      : action.kind === "disable"
        ? "Active"
        : action.kind === "enable"
          ? "Disabled"
          : user.implementationName || "—";
  const to =
    action.kind === "role" || action.kind === "promote"
      ? ROLEDEF[action.role].l
      : action.kind === "convertInternal"
        ? `Internal / ${ROLEDEF[action.role].l}`
        : action.kind === "convertCustomer"
          ? "Customer"
          : action.kind === "disable"
            ? "Disabled"
            : action.kind === "enable"
              ? "Active"
              : "New implementation";
  const recorded =
    action.kind === "disable"
      ? "ACCESS_DISABLED"
      : action.kind === "enable"
        ? "ACCESS_REACTIVATED"
        : action.kind === "convertInternal" || action.kind === "convertCustomer"
          ? "ACCOUNT_TYPE_CHANGED"
          : "ROLE_CHANGED";

  return (
    <>
      <div className={`confirm ${copy.tone}`}>
        <div className="ct">{copy.title}</div>
        <div className="cd2">{copy.body}</div>
      </div>
      <div className="chg">
        <span className="cl2">
          {action.kind === "disable" || action.kind === "enable"
            ? "Status"
            : action.kind === "convertInternal" || action.kind === "convertCustomer"
              ? "Account type"
              : "Role"}
        </span>
        <span className="cv2">
          <s>{from}</s>
          {to}
        </span>
      </div>
      <div className="chg">
        <span className="cl2">Recorded as</span>
        <span className="cv2 mono">{recorded}</span>
      </div>
    </>
  );
}
