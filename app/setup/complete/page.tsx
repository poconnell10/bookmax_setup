import { redirect } from "next/navigation";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { emptySetupIntake } from "@/lib/setup/intake";
import { getSetupResumePath } from "@/lib/setup/resume";
import { createSupabaseServerClient } from "@/lib/supabase/auth-clients";

export default async function SetupCompletePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/access");
  }

  try {
    const context = await getCustomerService().getForUser(user.id);
    redirect(
      getSetupResumePath({
        status: context.implementation.status,
        property: context.property,
        intake: context.intake?.payload ?? emptySetupIntake(),
        submitted: Boolean(context.submission),
      }),
    );
  } catch {
    redirect("/access");
  }
}
