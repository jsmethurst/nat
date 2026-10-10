import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDaily } from "@/lib/digest";

export const maxDuration = 300;

/** Manual "Refresh" button: sync, triage and rebuild today's digest for the signed-in user. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", request.url), 303);
  try {
    await runDaily(data.user.id);
  } catch (e) {
    console.error("manual refresh failed", e);
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
