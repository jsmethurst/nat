-- Surface sync failures in the app's Status window.
alter table public.connected_accounts add column last_sync_error text;
