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

export default async function Home() {
  const supabase = await createClient();
  const { data: digestRow } = await supabase.from("digests").select("content,digest_date,created_at").order("digest_date", { ascending: false }).limit(1).maybeSingle();
  const { data: itemRows } = await supabase
    .from("items")
    .select("id,source,sender,title,snippet,occurred_at,url,is_unread,importance,reason")
    .lte("occurred_at", new Date(Date.now() + 7 * 864e5).toISOString())
    .order("occurred_at", { ascending: false })
    .limit(200);
  const items = (itemRows ?? []) as Item[];
  const byId = new Map(items.map((i) => [i.id, i]));
  const digest = digestRow?.content as Digest | undefined;

  return (
    <main>
      <div className="top">
        <div>
          <h1>Today</h1>
          <div className="sub">
            {digestRow ? `Summary from ${fmt(digestRow.created_at)}` : "No summary yet"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <form action="/api/sync" method="post"><button>Refresh</button></form>
          <form action="/auth/logout" method="post"><button className="ghost">Sign out</button></form>
        </div>
      </div>

      {!digest ? (
        <p className="empty">Your first summary is being prepared &mdash; this can take a minute after signing in. Tap Refresh to check.</p>
      ) : (
        <>
          <p className="headline">{digest.headline}</p>

          <h2>Needs you ({digest.important.length})</h2>
          {digest.important.length === 0 && <p className="empty">Nothing needs you right now.</p>}
          {digest.important.map((d) => {
            const it = byId.get(d.item_id);
            const body = (
              <>
                <div className="row"><span className="title">{d.title}</span>{it && <Score n={it.importance} />}</div>
                <div className="why">{d.why}</div>
                {d.action && <div className="action">{d.action}</div>}
              </>
            );
            return <div className="card" key={d.item_id}>{it?.url ? <a href={it.url} target="_blank" rel="noreferrer">{body}</a> : body}</div>;
          })}

          {digest.coming_up.length > 0 && (
            <>
              <h2>Coming up</h2>
              {digest.coming_up.map((c) => (
                <div className="card" key={c.item_id}><div className="row"><span className="title">{c.title}</span><span className="pill">{c.when}</span></div></div>
              ))}
            </>
          )}

          <h2>Everything else</h2>
          <p className="why">{digest.everything_else}</p>
        </>
      )}

      <h2>All messages &amp; events ({items.length})</h2>
      {items.map((i) => (
        <div className={`card ${i.is_unread ? "unread" : ""}`} key={i.id}>
          <a href={i.url ?? "#"} target="_blank" rel="noreferrer">
            <div className="row"><span className="title">{i.title}</span><Score n={i.importance} /></div>
            <div className="why">{i.source === "gcal" ? "Event" : i.sender} &middot; {fmt(i.occurred_at)}</div>
            {i.reason && <div className="why">{i.reason}</div>}
          </a>
        </div>
      ))}
    </main>
  );
}
