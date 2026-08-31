import { NextResponse } from "next/server";
import { listPrototypeSubmissions } from "@/lib/implementation/persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ submissions: listPrototypeSubmissions() });
}
