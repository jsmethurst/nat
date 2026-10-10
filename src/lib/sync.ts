import { adminClient } from "./supabase/admin";
import { decrypt } from "./crypto";
import { fetchCalendar, fetchGmail, refreshAccessToken } from "./google";

/** Pull the latest mail + calendar for every connected account of a user (or all users). */
export async function syncUser(userId?: string): Promise<{ accounts: number; items: number; errors: string[] }> {
  const db = adminClient();
  let q = db.from("connected_accounts").select("id,user_id,email,refresh_token_enc,last_synced_at");
  if (userId) q = q.eq("user_id", userId);
  const { data: accounts, error } = await q;
  if (error) throw error;

  let total = 0;
  const errors: string[] = [];
  for (const a of accounts ?? []) {
    try {
      const token = await refreshAccessToken(decrypt(a.refresh_token_enc));
      // First sync looks back 7 days; later syncs 3 days (overlap makes it idempotent).
      const days = a.last_synced_at ? 3 : 7;
      const [mail, cal] = await Promise.all([fetchGmail(token, days), fetchCalendar(token, 7)]);
      const rows = [...mail, ...cal].map((r) => ({ ...r, is_unread: r.is_unread ?? false, labels: r.labels ?? [], user_id: a.user_id, account_id: a.id }));
      for (let i = 0; i < rows.length; i += 200) {
        // Upsert deliberately omits triage columns so existing scores survive a re-sync.
        const { error: e } = await db
          .from("items")
          .upsert(rows.slice(i, i + 200), { onConflict: "user_id,source,external_id" });
        if (e) throw e;
      }
      await db.from("connected_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", a.id);
      total += rows.length;
    } catch (e) {
      errors.push(`${a.email}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }
  }
  return { accounts: accounts?.length ?? 0, items: total, errors };
}
