-- Option A: the app scores with free rules; a daily Claude routine upgrades scores + digest.
alter table public.items add column labels text[] not null default '{}';
alter table public.items add column scored_by text check (scored_by in ('rules','claude'));
alter table public.digests add column source text not null default 'rules' check (source in ('rules','claude'));
create index items_needs_claude on public.items (user_id, occurred_at desc) where scored_by is distinct from 'claude';
