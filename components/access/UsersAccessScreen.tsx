"use client";

import { useMemo, useState } from "react";
import type { AccessAuditView, AccessUserView, ImplementationOption } from "@/lib/implementation/access/types";
import type { InternalRole } from "@/lib/implementation/internal/types";

type FilterKey = "" | "pending" | "customers" | "engineers" | "admins";

function roleLabel(role: AccessUserView["role"]) {
  if (role === "admin") return "Admin";
  if (role === "engineer") return "Engineer";
  if (role === "viewer") return "Viewer";
  if (role === "customer") return "Customer";
  return "Unassigned";
}

function accountLabel(type: AccessUserView["accountType"]) {
  if (type === "internal") return "Internal";
  if (type === "customer") return "Customer";
  return "Unassigned";
}

function statusClass(status: AccessUserView["status"]) {
  if (status === "active") return "ok";
  if (status === "pending") return "pend";
  return "off";
}

function formatWhen(value: string | null) {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString();
}

export function UsersAccessScreen({
  initialUsers,
  initialImplementations,
}: {
  initialUsers: AccessUserView[];
  initialImplementations: ImplementationOption[];
}) {
  const [users, setUsers] = useState<AccessUserView[]>(initialUsers);
  const [implementations, setImplementations] = useState<ImplementationOption[]>(initialImplementations);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<AccessUserView | null>(null);
  const [audit, setAudit] = useState<AccessAuditView[]>([]);
  const [mode, setMode] = useState<"closed" | "provision" | "manage">("closed");
  const [accountType, setAccountType] = useState<"internal" | "customer">("internal");
  const [role, setRole] = useState<InternalRole>("engineer");
  const [implementationId, setImplementationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  async function load() {
    const response = await fetch("/api/implementation/users");
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      users?: AccessUserView[];
      implementations?: ImplementationOption[];
    };
    if (!response.ok || !payload.ok) {
      setError(payload.error || "Users & Access could not be loaded.");
      return;
    }
    setUsers(payload.users ?? []);
    setImplementations(payload.implementations ?? []);
    setError("");
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
    const haystack = `${row.name ?? ""} ${row.email} ${roleLabel(row.role)}`.toLowerCase();
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) {
      return false;
    }
    if (filter === "pending" && row.status !== "pending") return false;
    if (filter === "customers" && row.accountType !== "customer") return false;
    if (filter === "engineers" && row.role !== "engineer") return false;
    if (filter === "admins" && row.role !== "admin") return false;
    if (statusFilter && row.status !== statusFilter) return false;
    return true;
  });

  async function openManage(row: AccessUserView) {
    setSelected(row);
    setMode("manage");
    setConfirmDisable(false);
    setRole(row.role === "admin" || row.role === "engineer" || row.role === "viewer" ? row.role : "engineer");
    setImplementationId(row.implementationId ?? implementations[0]?.id ?? "");
    const response = await fetch(`/api/implementation/users/${row.userId}`);
    const payload = (await response.json()) as { ok?: boolean; audit?: AccessAuditView[]; user?: AccessUserView };
    if (response.ok && payload.ok) {
      setAudit(payload.audit ?? []);
      if (payload.user) {
        setSelected(payload.user);
      }
    }
  }

  function openProvision(row?: AccessUserView) {
    const target = row ?? users.find((item) => item.status === "pending") ?? null;
    setSelected(target);
    setMode("provision");
    setAccountType("internal");
    setRole("engineer");
    setImplementationId(implementations[0]?.id ?? "");
    setAudit([]);
  }

  async function provision() {
    if (!selected || busy) {
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
            ? { userId: selected.userId, accountType, implementationId }
            : { userId: selected.userId, accountType, role },
        ),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "Access could not be granted.");
        return;
      }
      setMode("closed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function manage(action: "role" | "disable" | "reactivate" | "assign", nextRole?: InternalRole) {
    if (!selected || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/implementation/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.userId,
          action,
          role: nextRole ?? role,
          implementationId,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "That access change could not be saved.");
        return;
      }
      setMode("closed");
      setConfirmDisable(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="step ua">
      <div className="phead">
        <div>
          <h1>Users &amp; Access</h1>
          <p className="lede">Manage who can access BookMax and what they are authorized to do.</p>
        </div>
        <button className="btn pri" type="button" onClick={() => openProvision()}>
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
            ["", "All users", counts.all],
            ["pending", "Pending", counts.pending],
            ["customers", "Customers", counts.customers],
            ["engineers", "Engineers", counts.engineers],
            ["admins", "Admins", counts.admins],
          ] as const
        ).map(([key, label, value]) => (
          <button
            key={label}
            type="button"
            className={`sm2${filter === key ? " on" : ""}${key === "pending" ? " alert" : ""}`}
            onClick={() => setFilter(key)}
          >
            <span className="k">{label}</span>
            <span className="v">{value}</span>
          </button>
        ))}
      </div>
      <div className="filters">
        <div className="srch">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
          />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <span className="count">
          {filtered.length} of {users.length}
        </span>
      </div>
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <b>No users match these filters.</b>
          </div>
        ) : (
          filtered.map((row) => (
            <article key={row.userId} className={`row${row.status === "pending" ? " pend" : ""}`}>
              <div>
                <span className="fk">User</span>
                <span className="fv">
                  {row.name || row.emailMasked}
                  <span className="sub2">{row.emailMasked}</span>
                </span>
              </div>
              <div>
                <span className="fk">Account type</span>
                <span className="fv">{accountLabel(row.accountType)}</span>
              </div>
              <div>
                <span className="fk">Role</span>
                <span className={`bd ${row.role === "admin" ? "adm" : row.role ? "info" : "mut"}`}>
                  {roleLabel(row.role)}
                </span>
              </div>
              <div>
                <span className="fk">Status</span>
                <span className={`bd ${statusClass(row.status)}`}>{row.status}</span>
              </div>
              <div>
                <span className="fk">Last login</span>
                <span className="fv">{formatWhen(row.lastSignInAt)}</span>
              </div>
              <div className="ract">
                {row.status === "pending" ? (
                  <button type="button" className="btn sm" onClick={() => openProvision(row)}>
                    Provision
                  </button>
                ) : (
                  <button type="button" className="btn sm" onClick={() => void openManage(row)}>
                    Manage
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {mode !== "closed" && selected ? (
        <div className="scrim on" role="presentation">
          <aside className="drw on" aria-label={mode === "provision" ? "Provision user" : "Manage access"}>
            <div className="dhd">
              <div>
                <div className="t">{mode === "provision" ? "Provision user" : "Manage access"}</div>
                <div className="s">{selected.email}</div>
              </div>
              <button type="button" className="x" onClick={() => setMode("closed")} aria-label="Close">
                ×
              </button>
            </div>
            <div className="dbd">
              <div className="idcard">
                <div className="em">{selected.email}</div>
                <div className="idmeta">
                  <div className="kv">
                    <span className="kk">Account</span>
                    <span className="kd">{accountLabel(selected.accountType)}</span>
                  </div>
                  <div className="kv">
                    <span className="kk">Status</span>
                    <span className="kd">{selected.status}</span>
                  </div>
                  <div className="kv">
                    <span className="kk">Last login</span>
                    <span className="kd">{formatWhen(selected.lastSignInAt)}</span>
                  </div>
                </div>
              </div>

              {mode === "provision" ? (
                <>
                  <div className="sq">Account type</div>
                  <div className="opts">
                    <button
                      type="button"
                      className={`opt${accountType === "internal" ? " on" : ""}`}
                      onClick={() => setAccountType("internal")}
                    >
                      <span className="rd" />
                      <span>
                        <span className="ol">Internal</span>
                        <span className="od">Admin, Engineer, or Viewer access to BookMax.</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`opt${accountType === "customer" ? " on" : ""}`}
                      onClick={() => setAccountType("customer")}
                    >
                      <span className="rd" />
                      <span>
                        <span className="ol">Customer</span>
                        <span className="od">Associate this identity with an existing implementation.</span>
                      </span>
                    </button>
                  </div>
                  {accountType === "internal" ? (
                    <div className="f">
                      <label htmlFor="provision-role">Internal role</label>
                      <select id="provision-role" value={role} onChange={(event) => setRole(event.target.value as InternalRole)}>
                        <option value="engineer">Engineer</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ) : (
                    <div className="f">
                      <label htmlFor="provision-impl">Implementation</label>
                      <select
                        id="provision-impl"
                        value={implementationId}
                        onChange={(event) => setImplementationId(event.target.value)}
                      >
                        {implementations.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {selected.accountType === "internal" ? (
                    <div className="f">
                      <label htmlFor="manage-role">Internal role</label>
                      <select id="manage-role" value={role} onChange={(event) => setRole(event.target.value as InternalRole)}>
                        <option value="engineer">Engineer</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ) : null}
                  {selected.accountType === "customer" ? (
                    <div className="f">
                      <label htmlFor="manage-impl">Implementation</label>
                      <select
                        id="manage-impl"
                        value={implementationId}
                        onChange={(event) => setImplementationId(event.target.value)}
                      >
                        {implementations.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {audit.length > 0 ? (
                    <>
                      <div className="sq">History</div>
                      <div className="aud">
                        {audit.map((event) => (
                          <div key={event.id} className="ae">
                            <span className="at">{new Date(event.createdAt).toLocaleDateString()}</span>
                            <span className="av">{event.eventType.replaceAll("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>
            <div className="dft">
              {mode === "provision" ? (
                <div className="r">
                  <button type="button" className="btn" onClick={() => setMode("closed")}>
                    Cancel
                  </button>
                  <button type="button" className="btn pri" disabled={busy} onClick={() => void provision()}>
                    Grant access
                  </button>
                </div>
              ) : (
                <div className="r">
                  {selected.status === "disabled" ? (
                    <button type="button" className="btn pri" disabled={busy} onClick={() => void manage("reactivate")}>
                      Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn dgr"
                      disabled={busy}
                      onClick={() => {
                        if (!confirmDisable) {
                          setConfirmDisable(true);
                          return;
                        }
                        void manage("disable");
                      }}
                    >
                      {confirmDisable ? "Confirm disable" : "Disable"}
                    </button>
                  )}
                  {selected.accountType === "internal" ? (
                    <button type="button" className="btn pri" disabled={busy} onClick={() => void manage("role")}>
                      Save role
                    </button>
                  ) : (
                    <button type="button" className="btn pri" disabled={busy} onClick={() => void manage("assign")}>
                      Save assignment
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
