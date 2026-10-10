import { adminClient } from "./supabase/admin";

/**
 * Free, deterministic scoring. Runs on every sync so the app always works.
 * A daily Claude routine later overwrites these rows (scored_by = 'claude').
 */
type Row = {
  id: string; source: string; sender: string | null; title: string | null; snippet: string | null;
  occurred_at: string; is_unread: boolean; labels: string[] | null;
};

const URGENT = /\b(urgent|asap|deadline|due (today|tomorrow|soon)|overdue|action required|final notice|reminder|rsvp|please (reply|respond|confirm)|confirm (your|by)|appointment|payment|invoice|expires?|cancell?ed|rescheduled?|okul|acil|randevu|fatura|son gün)\b/i;
const MONEY = /\b(invoice|payment|receipt|bill|refund|fatura|ödeme)\b/i;
const TRAVEL = /\b(flight|boarding|check-?in|itinerary|booking|reservation|uçuş|rezervasyon)\b/i;
const AUTOMATED = /(no-?reply|do-?not-?reply|notifications?@|newsletter|mailer|marketing|updates?@)/i;

export function scoreRow(r: Row, now = Date.now()) {
  const text = `${r.title ?? ""} ${r.snippet ?? ""}`;
  const labels = r.labels ?? [];
  let score: number;
  let category = "fyi";
  let reason = "";
  let needs_action = false;

  if (r.source === "gcal") {
    const hours = (new Date(r.occurred_at).getTime() - now) / 36e5;
    score = hours < 24 ? 80 : hours < 48 ? 65 : 40;
    category = "event";
    reason = hours < 24 ? "Event in the next 24 hours" : hours < 48 ? "Event in the next 2 days" : "Upcoming event this week";
  } else {
    score = 35;
    if (labels.includes("CATEGORY_PROMOTIONS") || labels.includes("CATEGORY_SOCIAL")) {
      score = 8; category = "promo"; reason = "Promotion or social notification";
    } else if (labels.includes("CATEGORY_FORUMS")) {
      score = 18; reason = "Forum or group mail";
    } else if (labels.includes("CATEGORY_UPDATES")) {
      score = 28; reason = "Automated update";
    } else if (AUTOMATED.test(r.sender ?? "")) {
      score = 22; reason = "Automated sender";
    } else {
      score = 45; category = "reply"; reason = "Message from a person";
    }
    if (labels.includes("IMPORTANT")) { score += 20; reason = `${reason}; Gmail marked it important`; }
    if (labels.includes("STARRED")) { score += 30; reason = `${reason}; you starred it`; }
    if (r.is_unread) score += 8;
    if (URGENT.test(text)) { score += 22; needs_action = true; category = "action"; reason = `${reason}; wording suggests action or a deadline`; }
    if (MONEY.test(text) && score >= 30) category = "money";
    if (TRAVEL.test(text) && score >= 30) category = "travel";
  }
  return { importance: Math.max(0, Math.min(100, score)), category, reason, needs_action };
}

/** Score every not-yet-scored item with rules. Never overwrites Claude's scores. */
export async function scoreWithRules(userId: string, limit = 500): Promise<number> {
  const db = adminClient();
  const { data, error } = await db
    .from("items")
    .select("id,source,sender,title,snippet,occurred_at,is_unread,labels")
    .eq("user_id", userId)
    .is("scored_by", null)
    .limit(limit);
  if (error) throw error;
  let n = 0;
  for (const r of (data ?? []) as Row[]) {
    const s = scoreRow(r);
    const { error: e } = await db
      .from("items")
      .update({ ...s, scored_by: "rules", triaged_at: new Date().toISOString() })
      .eq("id", r.id)
      .is("scored_by", null);
    if (e) throw e;
    n++;
  }
  return n;
}
