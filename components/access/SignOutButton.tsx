"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton({ className = "sout" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/access/logout", { method: "POST" });
    } finally {
      router.replace("/access");
      router.refresh();
    }
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={() => void onSignOut()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
