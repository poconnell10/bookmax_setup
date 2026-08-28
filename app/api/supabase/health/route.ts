import { checkSupabaseConnection } from "@/lib/supabase/check-connection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await createClient();
    const status = await checkSupabaseConnection();

    return Response.json(status, {
      status: status.ok ? 200 : 503,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        clientInitialized: false,
        projectReachable: false,
      },
      { status: 503 },
    );
  }
}
