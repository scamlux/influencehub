-- Heartbeat / healthcheck for the scheduled discovery worker (Docker cron).
-- Each refresh writes one row here so we can tell at a glance whether the cron
-- is still alive and which jobs succeeded. Admin-readable only.

create table if not exists public.discovery_runs (
  id          uuid primary key default gen_random_uuid(),
  status      text not null check (status in ('ok', 'partial', 'failed')),
  jobs        jsonb not null default '{}'::jsonb,  -- { youtube: 'ok'|'failed'|'skipped', ... }
  failures    text[] not null default '{}',
  duration_ms integer,
  started_at  timestamptz,
  finished_at timestamptz not null default now()
);

create index if not exists idx_discovery_runs_finished
  on public.discovery_runs(finished_at desc);

alter table public.discovery_runs enable row level security;

-- Only admins can read the run history from the client. Writes come from the
-- worker using the service-role key, which bypasses RLS, so no insert policy.
drop policy if exists discovery_runs_admin_read on public.discovery_runs;
create policy discovery_runs_admin_read on public.discovery_runs
  for select using (public.is_admin());
