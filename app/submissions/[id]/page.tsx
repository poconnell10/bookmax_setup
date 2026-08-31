import { redirect } from "next/navigation";

export default async function SubmissionDetailAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/implementation/submissions/${id}`);
}
