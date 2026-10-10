# Nat's Inbox

One calm place for mail and calendar, with a daily summary of what truly matters
and a complete list of everything underneath, so nothing is missed.

**Phase 1 (this repo):** Gmail + Google Calendar, ranked and summarised by Claude.
**Next:** Outlook / Teams via Microsoft Graph (needs her employer's IT approval), optional urgent push.
Not supported: iMessage, WhatsApp, Signal (no official APIs on iPhone). Use iOS
*Settings → Notifications → Scheduled Summary* + a Focus filter for those apps.

## How it works
1. Sign in with Google (read-only Gmail + Calendar). The refresh token is stored AES-256-GCM encrypted; the browser can never read it.
2. A daily Vercel cron (06:00 Istanbul) and the **Refresh** button sync mail + calendar, score every item 0-100 with free rules, and write a quick fallback digest. No paid API is used by the app.
3. A scheduled **Claude routine** (prompt: `docs/routine-prompt.md`, 08:07 Istanbul) re-scores items with real judgement and writes the smart digest into Supabase. It replaces the fallback and is never overwritten by it.
4. Home page: headline, **Needs you**, **Coming up**, a themed count of **Everything else**, then the full list.

Stack: Next.js 15 (App Router) · Supabase (Postgres + Auth) · Vercel · a Claude routine on your Claude plan (no API key).
Supabase project: `nat-inbox` (`hmlitbveiapwwkzptyqg`, eu-central-1). Schema: `supabase/migrations/` (already applied).

**The routine needs the Supabase connector.** Create or edit it at claude.ai (Routines), attach the *Supabase* connector, and paste in `docs/routine-prompt.md`. Without the connector the app still works on rule-based scores.

## Setup
1. **Google Cloud** → new project → enable *Gmail API* and *Google Calendar API* → OAuth consent screen (External, add her email as a test user) → Credentials → OAuth client ID (Web). Authorised redirect URI:
   `https://hmlitbveiapwwkzptyqg.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Providers → Google: paste the client ID/secret. Authentication → URL Configuration: set Site URL to the deployed app URL and add `<app-url>/auth/callback` to Redirect URLs.
3. Copy `.env.example` → `.env.local` and fill it in (Supabase anon + service-role keys are under Project Settings → API). No Anthropic key is needed.
4. `npm install && npm run dev`
5. **Vercel**: import this repo, add the same env vars, deploy. (Vercel Hobby allows one cron per day, which is what's configured.)

Note: while the Google consent screen is in *Testing*, Google expires refresh tokens after 7 days. Publish the app (or move it to *In production*; personal use does not need verification beyond the "unverified app" warning) to avoid re-signing in weekly.

## Privacy
Only subject, sender, a ~300-char preview and calendar metadata are stored; message bodies are not stored. The daily routine reads those previews, so they appear in that Claude session's history. Access is limited to `ALLOWED_EMAILS`.
