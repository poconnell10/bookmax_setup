import type { Metadata } from "next";
import { Suspense } from "react";
import { ImplementationSignIn } from "@/components/implementation/ImplementationSignIn";
import { loadSignInInvitation } from "@/lib/implementation/invitation/sign-in-context";

export const metadata: Metadata = { title: "Sign in" };

export default async function ImplementationPage() {
  const invitation = await loadSignInInvitation();

  return (
    <Suspense>
      <ImplementationSignIn invitation={invitation} />
    </Suspense>
  );
}
