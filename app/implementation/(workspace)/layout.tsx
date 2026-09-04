import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getInternalViewerKind } from "@/lib/implementation/internal/auth";

export default async function ImplementationWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewerKind = await getInternalViewerKind();
  return <AppShell viewerKind={viewerKind}>{children}</AppShell>;
}
