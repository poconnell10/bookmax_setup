import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailAccessScreen } from "@/components/access/EmailAccessScreen";

export const metadata: Metadata = { title: "Start implementation" };

export default function Home() {
  return (
    <Suspense>
      <EmailAccessScreen />
    </Suspense>
  );
}
