-- ============================================================================
-- InfluenceHub — 001_schema.sql
-- Core database schema (tables, enums-as-checks, indexes, triggers).
-- Run order: 001_schema.sql -> 002_rls_policies.sql -> 003_seed_data.sql
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ─── user_roles ──────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  role        text not null check (role in ('brand','influencer','admin')),
  created_at  timestamptz default now()
);

-- ─── brand_profiles ──────────────────────────────────────────────────────────
create table if not exists public.brand_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─── influencer_profiles ─────────────────────────────────────────────────────
create table if not exists public.influencer_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references auth.users(id) on delete cascade,
  display_name      text not null,
  bio               text,
  category          text check (category in (
                      'food','tech','fashion','lifestyle','education','travel',
                      'beauty','sports','entertainment','business','auto')),
  city              text,
  is_visible        boolean default true,
  league_rank       integer,
  avatar_url        text,
  onboarding_status text default 'pending'
                      check (onboarding_status in ('pending','processing','completed','failed')),
  collection_error  text,
  engagement_rate   numeric(5,2),
  created_at        timestamptz default now()
);
create index if not exists idx_influencer_visible on public.influencer_profiles(is_visible);
create index if not exists idx_influencer_rank    on public.influencer_profiles(league_rank);
create index if not exists idx_influencer_category on public.influencer_profiles(category);

-- ─── social_platforms ────────────────────────────────────────────────────────
create table if not exists public.social_platforms (
  id              uuid primary key default gen_random_uuid(),
  influencer_id   uuid not null references public.influencer_profiles(id) on delete cascade,
  platform        text check (platform in ('youtube','instagram','tiktok','telegram')),
  username        text,
  followers_count bigint,
  engagement_rate numeric(5,2),
  profile_url     text,
  is_primary      boolean default false,
  created_at      timestamptz default now()
);
create index if not exists idx_social_influencer on public.social_platforms(influencer_id);

-- ─── advertising_prices ──────────────────────────────────────────────────────
create table if not exists public.advertising_prices (
  id            uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencer_profiles(id) on delete cascade,
  ad_type       text check (ad_type in ('post','story','video','reel','package','native')),
  price_usd     numeric(10,2),
  description   text,
  duration      text,
  delivery_days integer default 7,
  is_public     boolean default true,
  created_at    timestamptz default now()
);
create index if not exists idx_prices_influencer on public.advertising_prices(influencer_id);

-- ─── influencer_contacts ─────────────────────────────────────────────────────
create table if not exists public.influencer_contacts (
  id                uuid primary key default gen_random_uuid(),
  influencer_id     uuid not null unique references public.influencer_profiles(id) on delete cascade,
  email             text,
  phone             text,
  telegram_username text,
  instagram_dm      text,
  created_at        timestamptz default now()
);

-- ─── discounts ───────────────────────────────────────────────────────────────
create table if not exists public.discounts (
  id               uuid primary key default gen_random_uuid(),
  influencer_id    uuid not null references public.influencer_profiles(id) on delete cascade,
  title            text,
  description      text,
  discount_percent integer,
  valid_until      timestamptz,
  is_active        boolean default true,
  created_at       timestamptz default now()
);
create index if not exists idx_discounts_influencer on public.discounts(influencer_id);

-- ─── subscriptions ───────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  plan_type              text check (plan_type in ('brand_pro','influencer_sync','influencer_feature')),
  status                 text check (status in ('active','cancelled','expired')) default 'active',
  expires_at             timestamptz,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);
create index if not exists idx_subs_user on public.subscriptions(user_id);

-- ─── campaigns ───────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brand_profiles(id) on delete cascade,
  title        text not null,
  description  text,
  requirements text,
  budget_usd   numeric(10,2),
  platform     text check (platform in ('youtube','instagram','tiktok','telegram')),
  category     text,
  status       text check (status in ('draft','open','active','completed','cancelled')) default 'open',
  deadline     timestamptz,
  created_at   timestamptz default now()
);
create index if not exists idx_campaigns_brand  on public.campaigns(brand_id);
create index if not exists idx_campaigns_status on public.campaigns(status);

-- ─── bids ────────────────────────────────────────────────────────────────────
create table if not exists public.bids (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  influencer_id  uuid not null references public.influencer_profiles(id) on delete cascade,
  proposed_price numeric(10,2),
  proposal       text,
  delivery_days  integer default 7,
  status         text check (status in ('pending','accepted','rejected')) default 'pending',
  created_at     timestamptz default now()
);
create index if not exists idx_bids_campaign   on public.bids(campaign_id);
create index if not exists idx_bids_influencer on public.bids(influencer_id);

-- ─── deals ───────────────────────────────────────────────────────────────────
create table if not exists public.deals (
  id            uuid primary key default gen_random_uuid(),
  bid_id        uuid references public.bids(id) on delete set null,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  brand_id      uuid references public.brand_profiles(id) on delete set null,
  influencer_id uuid references public.influencer_profiles(id) on delete set null,
  agreed_price  numeric(10,2),
  status        text check (status in ('active','content_submitted','approved','completed','cancelled')) default 'active',
  content_url   text,
  completed_at  timestamptz,
  review        text,
  rating        integer check (rating between 1 and 5),
  created_at    timestamptz default now()
);
create index if not exists idx_deals_brand      on public.deals(brand_id);
create index if not exists idx_deals_influencer on public.deals(influencer_id);

-- ─── messages ────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists idx_messages_deal on public.messages(deal_id);

-- ─── notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text,
  title      text,
  message    text,
  link       text,
  is_read    boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- ─── favorites ───────────────────────────────────────────────────────────────
create table if not exists public.favorites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  influencer_id uuid not null references public.influencer_profiles(id) on delete cascade,
  created_at    timestamptz default now(),
  unique(user_id, influencer_id)
);

-- ─── influencer_analytics_history ────────────────────────────────────────────
create table if not exists public.influencer_analytics_history (
  id              uuid primary key default gen_random_uuid(),
  influencer_id   uuid not null references public.influencer_profiles(id) on delete cascade,
  platform        text,
  followers_count bigint,
  engagement_rate numeric(5,2),
  recorded_at     timestamptz default now()
);
create index if not exists idx_analytics_influencer on public.influencer_analytics_history(influencer_id, recorded_at);

-- ─── payments ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  stripe_session_id text,
  plan_type         text,
  amount            numeric(10,2),
  currency          text default 'USD',
  status            text,
  created_at        timestamptz default now()
);

-- ─── admin_actions ───────────────────────────────────────────────────────────
create table if not exists public.admin_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references auth.users(id) on delete set null,
  action_type  text,
  target_table text,
  target_id    uuid,
  details      jsonb,
  created_at   timestamptz default now()
);

-- ─── scraping_queue ──────────────────────────────────────────────────────────
create table if not exists public.scraping_queue (
  id            uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencer_profiles(id) on delete cascade,
  status        text default 'pending' check (status in ('pending','processing','completed','failed')),
  error         text,
  created_at    timestamptz default now()
);
create index if not exists idx_scraping_status on public.scraping_queue(status);

-- ─── new-user trigger: auto-create a profiles row on signup ──────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── helper: is the current user an admin? (used by RLS) ──────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ─── helper: does the current user hold an active brand_pro subscription? ─────
create or replace function public.has_brand_pro()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid()
      and plan_type = 'brand_pro'
      and status = 'active'
      and (expires_at is null or expires_at > now())
  );
$$;
