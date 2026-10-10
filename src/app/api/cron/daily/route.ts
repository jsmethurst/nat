import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { runDaily } from "@/lib/digest";

export const maxDuration = 300;

/** Vercel Cron: runs the full daily pipeline for every connected user. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = adminClient();
  const { data } = await db.from("connected_accounts").select("user_id");
  const users = [...new Set((data ?? []).map((r) => r.user_id as string))];
  const results: Record<string, string> = {};
  for (const id of users) {
    try {
      await runDaily(id);
      results[id] = "ok";
    } catch (e) {
      results[id] = e instanceof Error ? e.message : String(e);
    }
  }
  return NextResponse.json({ users: users.length, results });
}
