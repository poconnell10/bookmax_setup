import { runPrivilegedConnectionTest } from "@/lib/supabase/connection-test";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const client = createServiceClient();
    const result = await runPrivilegedConnectionTest(
      client as unknown as Parameters<typeof runPrivilegedConnectionTest>[0],
    );

    return Response.json(result, {
      status: result.ok ? 200 : 503,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        write: false,
        read: false,
        id: null,
      },
      { status: 503 },
    );
  }
}
