import { adminClient } from "./supabase/admin";
import { scoreWithRules } from "./rules";
import { syncUser } from "./sync";

export type Digest = {
  headline: string;
  important: { item_id: string; title: string; why: string; action: string | null }[];
  coming_up: { item_id: string; title: string; when: string }[];
  everything_else: string;
  counts?: { total: number; shown_above: number; unread: number };
};

/** Date string (YYYY-MM-DD) in the app timezone. */
export function todayIn(tz = process.env.APP_TIMEZONE || "Europe/Istanbul") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/** Free fallback digest built from rule scores. The Claude routine replaces it each morning. */
export async function buildRulesDigest(userId: string): Promise<Digest> {
  const db = adminClient();
  const tz = process.env.APP_TIMEZONE || "Europe/Istanbul";
  const since = new Date(Date.now() - 36 * 36e5).toISOString();
  const until = new Date(Date.now() + 48 * 36e5).toISOString();
  const { data, error } = await db
    .from("items")
    .select("id,source,sender,title,occurred_at,is_unread,importance,category,reason,needs_action")
    .eq("user_id", userId)
    .gte("occurred_at", since)
    .lte("occurred_at", until)
    .order("importance", { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) throw error;
  const items = data ?? [];

  const important = items
    .filter((i) => i.source === "gmail" && (i.importance ?? 0) >= 55)
    .slice(0, 15)
    .map((i) => ({ item_id: i.id, title: i.title ?? "(no subject)", why: `${i.reason ?? "Looks important"}${i.sender ? ` — from ${i.sender}` : ""}`, action: i.needs_action ? "May need a reply or action" : null }));
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit" });
  const coming_up = items
    .filter((i) => i.source === "gcal" && new Date(i.occurred_at).getTime() >= Date.now())
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((i) => ({ item_id: i.id, title: i.title ?? "(event)", when: fmt.format(new Date(i.occurred_at)) }));

  const rest = items.filter((i) => i.source === "gmail" && !important.some((m) => m.item_id === i.id));
  const byCat = new Map<string, number>();
  rest.forEach((i) => byCat.set(i.category ?? "fyi", (byCat.get(i.category ?? "fyi") ?? 0) + 1));
  const everything_else = rest.length
    ? `${rest.length} other messages: ${[...byCat].map(([c, n]) => `${n} ${c}`).join(", ")}. All of them are listed below.`
    : "Nothing else came in.";

  return {
    headline: important.length
      ? `${important.length} message${important.length === 1 ? "" : "s"} may need you, ${coming_up.length} event${coming_up.length === 1 ? "" : "s"} coming up.`
      : `A quiet stretch: nothing stands out, ${coming_up.length} event${coming_up.length === 1 ? "" : "s"} coming up.`,
    important,
    coming_up,
    everything_else,
    counts: { total: items.length, shown_above: important.length, unread: items.filter((i) => i.is_unread).length },
  };
}

/** Free pipeline for one user: sync -> rule scores -> fallback digest (never clobbers a Claude digest). */
export async function runDaily(userId: string) {
  const sync = await syncUser(userId);
  const scored = await scoreWithRules(userId);
  const db = adminClient();
  const date = todayIn();
  const { data: existing } = await db.from("digests").select("source").eq("user_id", userId).eq("digest_date", date).maybeSingle();
  if (existing?.source !== "claude") {
    const content = await buildRulesDigest(userId);
    const { error } = await db
      .from("digests")
      .upsert({ user_id: userId, digest_date: date, content, source: "rules" }, { onConflict: "user_id,digest_date" });
    if (error) throw error;
  }
  return { sync, scored };
}
