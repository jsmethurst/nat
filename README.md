# Nat's Inbox

One calm place for mail and calendar, with a daily summary of what truly matters
and a complete list of everything underneath, so nothing is missed.

**Phase 1 (this repo):** Gmail + Google Calendar, ranked and summarised by Claude.
**Next:** Outlook / Teams via Microsoft Graph (needs her employer's IT approval), optional urgent push.
Not supported: iMessage, WhatsApp, Signal (no official APIs on iPhone). Use iOS
*Settings → Notifications → Scheduled Summary* + a Focus filter for those apps.

## How it works
1. Sign in with Google (read-only Gmail + Calendar). The refresh token is stored AES-256-GCM encrypted; the browser can never read it.
2. Daily cron (05:00 UTC = 08:00 Istanbul) and the **Refresh** button run: sync → score every new item 0–100 → write the day's digest.
3. Home page shows: headline, **Needs you**, **Coming up**, a themed count of **Everything else**, then the full list.

Stack: Next.js 15 (App Router) · Supabase (Postgres + Auth) · Claude (`claude-sonnet-5-5`, override with `ANTHROPIC_MODEL`) · Vercel.
Supabase project: `nat-inbox` (`hmlitbveiapwwkzptyqg`, eu-central-1). Schema: `supabase/migrations/0001_init.sql` (already applied).

## Setup
1. **Google Cloud** → new project → enable *Gmail API* and *Google Calendar API* → OAuth consent screen (External, add her email as a test user) → Credentials → OAuth client ID (Web). Authorised redirect URI:
   `https://hmlitbveiapwwkzptyqg.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Providers → Google: paste the client ID/secret. Authentication → URL Configuration: set Site URL to the deployed app URL and add `<app-url>/auth/callback` to Redirect URLs.
3. Copy `.env.example` → `.env.local` and fill it in (Supabase anon + service-role keys are under Project Settings → API).
4. `npm install && npm run dev`
5. **Vercel**: import this repo, add the same env vars, deploy. (Vercel Hobby allows one cron per day, which is what's configured.)

Note: while the Google consent screen is in *Testing*, Google expires refresh tokens after 7 days. Publish the app (or move it to *In production*; personal use does not need verification beyond the "unverified app" warning) to avoid re-signing in weekly.

## Privacy
Only subject, sender, a ~200-char preview and calendar metadata are stored and sent to Claude; message bodies are not stored. Access is limited to `ALLOWED_EMAILS`.
