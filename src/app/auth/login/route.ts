import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_SCOPES } from "@/lib/google";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${request.nextUrl.origin}/auth/callback`,
      scopes: GOOGLE_SCOPES.join(" "),
      // offline + consent => Google returns a refresh token every time.
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}`, request.url));
  }
  return NextResponse.redirect(data.url);
}
