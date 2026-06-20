-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime for chat + notifications, and server-side notification triggers.
--
-- Clients can't INSERT notifications for OTHER users (no RLS insert policy), so
-- cross-user alerts are created by SECURITY DEFINER triggers on bids/deals. The
-- inserts then stream to the recipient over Realtime (RLS still filters delivery,
-- so each user only receives their own rows).
-- ─────────────────────────────────────────────────────────────────────────────

-- Full row image so Realtime UPDATE/DELETE events carry filterable columns.
alter table public.messages       replica identity full;
alter table public.notifications  replica identity full;

-- Add both tables to the realtime publication (create it if missing).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ─── notify brand when a bid is submitted ────────────────────────────────────
create or replace function public.notify_bid_received()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  brand_user uuid;
  camp_title text;
begin
  select b.user_id, c.title
    into brand_user, camp_title
  from public.campaigns c
  join public.brand_profiles b on b.id = c.brand_id
  where c.id = new.campaign_id;

  if brand_user is not null then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      brand_user, 'bid_received', 'New bid received',
      'A creator submitted a bid on ' || coalesce(camp_title, 'your campaign') || '.',
      '/brand/campaigns'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_bid_received on public.bids;
create trigger trg_notify_bid_received
  after insert on public.bids
  for each row execute function public.notify_bid_received();

-- ─── notify influencer when their bid is accepted ────────────────────────────
create or replace function public.notify_bid_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inf_user uuid;
  camp_title text;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select i.user_id into inf_user
    from public.influencer_profiles i where i.id = new.influencer_id;
    select c.title into camp_title
    from public.campaigns c where c.id = new.campaign_id;

    if inf_user is not null then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        inf_user, 'bid_accepted', 'Your bid was accepted!',
        'Your bid on ' || coalesce(camp_title, 'a campaign') || ' was accepted. A new deal has been created.',
        '/influencer/deals'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_bid_status on public.bids;
create trigger trg_notify_bid_status
  after update on public.bids
  for each row execute function public.notify_bid_status();

-- ─── notify the other party when a deal's status changes ─────────────────────
create or replace function public.notify_deal_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  brand_user uuid;
  inf_user uuid;
begin
  if new.status is distinct from old.status then
    select user_id into brand_user from public.brand_profiles where id = new.brand_id;
    select user_id into inf_user from public.influencer_profiles where id = new.influencer_id;

    if new.status = 'content_submitted' and brand_user is not null then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        brand_user, 'deal_update', 'Content submitted',
        'A creator submitted content for your review.', '/brand/deals'
      );
    elsif inf_user is not null then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        inf_user, 'deal_update', 'Deal updated',
        'Your deal status changed to "' || new.status || '".', '/influencer/deals'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_deal_status on public.deals;
create trigger trg_notify_deal_status
  after update on public.deals
  for each row execute function public.notify_deal_status();
