export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

async function gget<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google API ${res.status} for ${url.split("?")[0]}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type RawItem = {
  source: "gmail" | "gcal";
  external_id: string;
  thread_id?: string;
  sender?: string;
  title?: string;
  snippet?: string;
  occurred_at: string;
  ends_at?: string;
  url?: string;
  is_unread?: boolean;
};

type GmailList = { messages?: { id: string }[]; nextPageToken?: string };
type GmailMsg = {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  internalDate: string;
  payload?: { headers?: { name: string; value: string }[] };
};

/** Inbox mail from the last `days` days (every page, so nothing is missed). */
export async function fetchGmail(token: string, days: number, cap = 300): Promise<RawItem[]> {
  const ids: string[] = [];
  let page: string | undefined;
  do {
    const q = new URLSearchParams({ q: `in:inbox newer_than:${days}d`, maxResults: "100" });
    if (page) q.set("pageToken", page);
    const list = await gget<GmailList>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`);
    ids.push(...(list.messages ?? []).map((m) => m.id));
    page = list.nextPageToken;
  } while (page && ids.length < cap);

  const out: RawItem[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(
      ids.slice(i, i + 10).map((id) =>
        gget<GmailMsg>(
          token,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        ),
      ),
    );
    for (const m of batch) {
      const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value;
      out.push({
        source: "gmail",
        external_id: m.id,
        thread_id: m.threadId,
        sender: h("from"),
        title: h("subject") || "(no subject)",
        snippet: m.snippet,
        occurred_at: new Date(Number(m.internalDate)).toISOString(),
        url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
        is_unread: m.labelIds?.includes("UNREAD") ?? false,
      });
    }
  }
  return out;
}

type GcalList = {
  items?: {
    id: string;
    status?: string;
    summary?: string;
    description?: string;
    location?: string;
    htmlLink?: string;
    organizer?: { email?: string; displayName?: string };
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }[];
};

/** Events from now until `days` days ahead. */
export async function fetchCalendar(token: string, days: number): Promise<RawItem[]> {
  const q = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 864e5).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const data = await gget<GcalList>(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
    .map((e) => ({
      source: "gcal" as const,
      external_id: e.id,
      sender: e.organizer?.displayName || e.organizer?.email,
      title: e.summary || "(untitled event)",
      snippet: [e.location, e.description?.slice(0, 300)].filter(Boolean).join(" · "),
      occurred_at: new Date((e.start!.dateTime || e.start!.date)!).toISOString(),
      ends_at: e.end ? new Date((e.end.dateTime || e.end.date)!).toISOString() : undefined,
      url: e.htmlLink,
    }));
}
