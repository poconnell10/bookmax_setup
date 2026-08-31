import type { Metadata } from "next";
import { Suspense } from "react";
import { ImplementationSignIn } from "@/components/implementation/ImplementationSignIn";

export const metadata: Metadata = {
  title: "Welcome",
};

export default function ImplementationPage() {
  return (
    <Suspense>
      <ImplementationSignIn />
    </Suspense>
  );
}
