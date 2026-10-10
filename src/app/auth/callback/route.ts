import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { runDaily } from "@/lib/digest";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const fail = (m: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(m)}`, request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return fail("Missing authorization code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return fail(error?.message ?? "Sign-in failed");

  const email = data.session.user.email?.toLowerCase() ?? "";
  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email)) {
    await supabase.auth.signOut();
    return fail("This account is not allowed");
  }

  const refresh = data.session.provider_refresh_token;
  if (refresh) {
    const db = adminClient();
    const { error: e } = await db.from("connected_accounts").upsert(
      {
        user_id: data.session.user.id,
        provider: "google",
        email,
        refresh_token_enc: encrypt(refresh),
        scopes: "gmail.readonly calendar.readonly",
      },
      { onConflict: "user_id,provider,email" },
    );
    if (e) return fail(e.message);
    // First sync + digest runs after the redirect so sign-in feels instant.
    after(async () => {
      try { await runDaily(data.session!.user.id); } catch (err) { console.error("initial sync failed", err); }
    });
  }
  return NextResponse.redirect(new URL("/", request.url));
}
