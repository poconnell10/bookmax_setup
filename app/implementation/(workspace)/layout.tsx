import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getInternalViewer } from "@/lib/implementation/internal/auth";

export default async function ImplementationWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getInternalViewer();
  return (
    <AppShell viewerKind={viewer.kind} identity={{ email: viewer.email, name: viewer.name }}>
      {children}
    </AppShell>
  );
}
