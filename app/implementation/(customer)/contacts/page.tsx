import type { Metadata } from "next";
import { ContactsScreen } from "@/components/setup/ContactsScreen";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return <ContactsScreen />;
}
