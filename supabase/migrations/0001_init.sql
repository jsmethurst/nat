-- Connected provider accounts (refresh tokens stored AES-GCM encrypted by the app).
create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  email text not null,
  refresh_token_enc text not null,
  scopes text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider, email)
);

-- Everything pooled from every source, one row per email / event.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.connected_accounts(id) on delete cascade,
  source text not null check (source in ('gmail','gcal')),
  external_id text not null,
  thread_id text,
  sender text,
  title text,
  snippet text,
  occurred_at timestamptz not null,
  ends_at timestamptz,
  url text,
  is_unread boolean not null default false,
  -- triage output
  importance smallint,
  category text,
  reason text,
  needs_action boolean,
  triaged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index items_user_time on public.items (user_id, occurred_at desc);
create index items_untriaged on public.items (user_id) where triaged_at is null;

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, digest_date)
);

alter table public.connected_accounts enable row level security;
alter table public.items enable row level security;
alter table public.digests enable row level security;

-- Users read their own rows; all writes go through the service role (server only).
create policy "own items" on public.items for select using (auth.uid() = user_id);
create policy "own digests" on public.digests for select using (auth.uid() = user_id);
-- connected_accounts has no policies: tokens are never readable from the client.
