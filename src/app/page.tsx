import { createClient } from "@/lib/supabase/server";
import type { Digest } from "@/lib/digest";

export const dynamic = "force-dynamic";

const tz = process.env.APP_TIMEZONE || "Europe/Istanbul";
const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

type Item = {
  id: string; source: string; sender: string | null; title: string | null; snippet: string | null;
  occurred_at: string; url: string | null; is_unread: boolean; importance: number | null; reason: string | null;
};

function Score({ n }: { n: number | null }) {
  if (n == null) return <span className="pill">new</span>;
  return <span className={`pill ${n >= 70 ? "hot" : n >= 40 ? "warm" : ""}`}>{n}</span>;
}

const TABS = [
  { key: "pressing", label: "Pressing" },
  { key: "calendar", label: "Calendar", source: "gcal" },
  { key: "gmail", label: "Gmail", source: "gmail" },
  { key: "outlook", label: "Outlook" },
  { key: "signal", label: "Signal" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

const PRESSING_MIN = 55;

function ItemCard({ i, showSource }: { i: Item; showSource?: boolean }) {
  const meta = [showSource ? (i.source === "gcal" ? "Calendar" : "Gmail") : null, i.source === "gcal" ? null : i.sender, fmt(i.occurred_at)]
    .filter(Boolean)
    .join(" \u00b7 ");
  return (
    <div className={`card ${i.is_unread ? "unread" : ""}`}>
      <a href={i.url ?? "#"} target="_blank" rel="noreferrer">
        <div className="row"><span className="title">{i.title}</span><Score n={i.importance} /></div>
        <div className="why">{meta}</div>
        {i.reason && <div className="why">{i.reason}</div>}
      </a>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email ?? "";
  const { data: digestRow } = await supabase.from("digests").select("content,digest_date,created_at,source").order("digest_date", { ascending: false }).limit(1).maybeSingle();
  const digest = digestRow?.content as Digest | undefined;

  const cols = "id,source,sender,title,snippet,occurred_at,url,is_unread,importance,reason";
  let items: Item[] = [];
  if (tab.key === "pressing") {
    const { data } = await supabase
      .from("items")
      .select(cols)
      .gte("importance", PRESSING_MIN)
      .lte("occurred_at", new Date(Date.now() + 7 * 864e5).toISOString())
      .order("occurred_at", { ascending: false })
      .limit(100);
    items = (data ?? []) as Item[];
  } else if ("source" in tab) {
    const q = supabase.from("items").select(cols).eq("source", tab.source);
    const { data } =
      tab.source === "gcal"
        ? await q.gte("occurred_at", new Date(Date.now() - 864e5).toISOString()).order("occurred_at", { ascending: true }).limit(200)
        : await q.order("occurred_at", { ascending: false }).limit(200);
    items = (data ?? []) as Item[];
  }

  return (
    <main>
      <div className="top">
        <div>
          <h1>Today</h1>
          <div className="sub">{digestRow ? `Updated ${fmt(digestRow.created_at)}` : "No summary yet"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <form action="/api/sync" method="post"><button>Refresh</button></form>
          <form action="/auth/logout" method="post"><button className="ghost">Sign out</button></form>
        </div>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t.key} href={t.key === "pressing" ? "/" : `/?tab=${t.key}`} className={t.key === tab.key ? "active" : ""}>{t.label}</a>
        ))}
      </nav>

      {tab.key === "calendar" && email && (
        <iframe
          className="gcal"
          title="Google Calendar"
          src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(email)}&ctz=${encodeURIComponent(tz)}&mode=MONTH&showTitle=0&showPrint=0&showTz=0`}
        />
      )}

      {tab.key === "pressing" && digest && <p className="headline">{digest.headline}</p>}

      {"source" in tab || tab.key === "pressing" ? (
        items.length === 0 ? (
          <p className="empty">
            {tab.key === "pressing"
              ? digest ? "Nothing pressing right now." : "Your first summary is being prepared. Tap Refresh to check."
              : "Nothing here yet."}
          </p>
        ) : (
          items.map((i) => <ItemCard key={i.id} i={i} showSource={tab.key === "pressing"} />)
        )
      ) : null}
    </main>
  );
}
