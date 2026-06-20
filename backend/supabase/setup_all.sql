-- InfluenceHub — full setup (run once in the Supabase SQL Editor).
-- Concatenation of migrations 001..005 in order. Safe on a fresh project.


-- ============================================================
-- 001_schema.sql
-- ============================================================
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


-- ============================================================
-- 002_rls_policies.sql
-- ============================================================
-- ============================================================================
-- InfluenceHub — 002_rls_policies.sql
-- Row Level Security. Admins bypass everything via service_role / is_admin().
-- ============================================================================

alter table public.profiles                     enable row level security;
alter table public.user_roles                   enable row level security;
alter table public.brand_profiles               enable row level security;
alter table public.influencer_profiles          enable row level security;
alter table public.social_platforms             enable row level security;
alter table public.advertising_prices           enable row level security;
alter table public.influencer_contacts          enable row level security;
alter table public.discounts                    enable row level security;
alter table public.subscriptions                enable row level security;
alter table public.campaigns                    enable row level security;
alter table public.bids                         enable row level security;
alter table public.deals                        enable row level security;
alter table public.messages                     enable row level security;
alter table public.notifications                enable row level security;
alter table public.favorites                    enable row level security;
alter table public.influencer_analytics_history enable row level security;
alter table public.payments                     enable row level security;
alter table public.admin_actions                enable row level security;
alter table public.scraping_queue               enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────────────
create policy "read_own_profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "update_own_profile" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- ─── user_roles ──────────────────────────────────────────────────────────────
create policy "read_own_role" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "insert_own_role" on public.user_roles
  for insert with check (user_id = auth.uid());
create policy "admin_manage_roles" on public.user_roles
  for update using (public.is_admin());

-- ─── brand_profiles ──────────────────────────────────────────────────────────
create policy "read_own_brand" on public.brand_profiles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "insert_own_brand" on public.brand_profiles
  for insert with check (user_id = auth.uid());

-- ─── influencer_profiles ─────────────────────────────────────────────────────
-- Public read for visible influencers (the public league / profile pages).
create policy "public_read_influencers" on public.influencer_profiles
  for select using (is_visible = true or user_id = auth.uid() or public.is_admin());
-- Influencers can only edit their own profile.
create policy "influencer_edit_own" on public.influencer_profiles
  for update using (user_id = auth.uid() or public.is_admin());
create policy "influencer_insert_own" on public.influencer_profiles
  for insert with check (user_id = auth.uid() or public.is_admin());

-- ─── social_platforms (public read; owner/admin write) ───────────────────────
create policy "public_read_social" on public.social_platforms
  for select using (true);
create policy "owner_write_social" on public.social_platforms
  for all using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── advertising_prices ──────────────────────────────────────────────────────
-- Public rows readable by anyone; private rows only for brand_pro subscribers.
-- Owner & admin always see their own.
create policy "subscribers_read_prices" on public.advertising_prices
  for select using (
    is_public = true
    or public.has_brand_pro()
    or public.is_admin()
    or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
  );
create policy "owner_write_prices" on public.advertising_prices
  for all using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── influencer_contacts (brand_pro only) ────────────────────────────────────
create policy "subscribers_read_contacts" on public.influencer_contacts
  for select using (
    public.has_brand_pro()
    or public.is_admin()
    or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
  );
create policy "owner_write_contacts" on public.influencer_contacts
  for all using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── discounts (brand_pro only for read) ─────────────────────────────────────
create policy "subscribers_read_discounts" on public.discounts
  for select using (
    public.has_brand_pro()
    or public.is_admin()
    or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
  );
create policy "owner_write_discounts" on public.discounts
  for all using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── subscriptions ───────────────────────────────────────────────────────────
create policy "read_own_subscription" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- ─── campaigns ───────────────────────────────────────────────────────────────
-- Open/active campaigns visible to everyone (influencers browse them).
create policy "read_campaigns" on public.campaigns
  for select using (
    status in ('open','active','completed')
    or brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or public.is_admin()
  );
create policy "brand_insert_campaigns" on public.campaigns
  for insert with check (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
  );
create policy "brand_edit_campaigns" on public.campaigns
  for update using (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── bids ────────────────────────────────────────────────────────────────────
-- Bidding influencer + owning brand + admin can read.
create policy "read_bids" on public.bids
  for select using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or campaign_id in (
      select c.id from public.campaigns c
      join public.brand_profiles b on b.id = c.brand_id
      where b.user_id = auth.uid()
    )
    or public.is_admin()
  );
create policy "influencer_insert_bids" on public.bids
  for insert with check (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
  );
create policy "manage_bids" on public.bids
  for update using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or campaign_id in (
      select c.id from public.campaigns c
      join public.brand_profiles b on b.id = c.brand_id
      where b.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- ─── deals (parties + admin) ─────────────────────────────────────────────────
create policy "read_deals" on public.deals
  for select using (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );
create policy "update_deals" on public.deals
  for update using (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );
create policy "insert_deals" on public.deals
  for insert with check (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── messages (deal parties only) ────────────────────────────────────────────
create policy "read_deal_messages" on public.messages
  for select using (
    deal_id in (
      select id from public.deals
      where brand_id in (select id from public.brand_profiles where user_id = auth.uid())
         or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    )
    or public.is_admin()
  );
create policy "send_deal_messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and deal_id in (
      select id from public.deals
      where brand_id in (select id from public.brand_profiles where user_id = auth.uid())
         or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    )
  );

-- ─── notifications ───────────────────────────────────────────────────────────
create policy "read_own_notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "update_own_notifications" on public.notifications
  for update using (user_id = auth.uid());

-- ─── favorites ───────────────────────────────────────────────────────────────
create policy "manage_own_favorites" on public.favorites
  for all using (user_id = auth.uid());

-- ─── analytics history (public read) ─────────────────────────────────────────
create policy "public_read_analytics" on public.influencer_analytics_history
  for select using (true);

-- ─── payments (own + admin) ──────────────────────────────────────────────────
create policy "read_own_payments" on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

-- ─── admin_actions (admin only) ──────────────────────────────────────────────
create policy "admin_read_actions" on public.admin_actions
  for select using (public.is_admin());

-- ─── scraping_queue (admin only) ─────────────────────────────────────────────
create policy "admin_read_queue" on public.scraping_queue
  for select using (public.is_admin());


-- ============================================================
-- 003_seed_data.sql
-- ============================================================
-- ============================================================================
-- InfluenceHub — 003_seed_data.sql
-- Mock/seed data: 3 admins, 5 brands, 25 influencers + full relational data.
-- Every seeded auth user has password: Password123!
-- Idempotent-ish: re-running clears previously seeded demo rows by email domain.
-- ============================================================================

-- Clean any previous demo data (cascades through FKs).
delete from auth.users where email like '%@demo.influencehub.app';

do $$
declare
  -- ── reference pools ───────────────────────────────────────────────────────
  cities       text[] := array['Toshkent','Samarqand','Buxoro','Andijon','Namangan'];
  categories   text[] := array['food','tech','fashion','lifestyle','education',
                               'travel','beauty','sports','entertainment','business','auto'];
  platforms    text[] := array['youtube','instagram','tiktok','telegram'];
  adtypes      text[] := array['post','story','video','reel','package','native'];
  firstnames   text[] := array['Aziz','Dilnoza','Jasur','Madina','Sardor','Nilufar',
                               'Bekzod','Kamola','Rustam','Zarina','Otabek','Sevara',
                               'Farrux','Gulnora','Sherzod','Malika','Akmal','Dilfuza',
                               'Ulugbek','Shahnoza','Bobur','Nargiza','Temur','Feruza','Davron'];
  lastnames    text[] := array['Karimov','Yusupova','Rashidov','Tursunova','Aliyev',
                               'Saidova','Ergashev','Komilova','Nazarov','Abdullaeva',
                               'Mirzaev','Ismoilova','Qodirov','Xolmatova','Tashkentov',
                               'Yuldasheva','Sobirov','Rahimova','Jalilov','Usmonova',
                               'Hakimov','Sultonova','Maxmudov','Inoyatova','Gafurov'];

  -- ── working vars ──────────────────────────────────────────────────────────
  admin_ids    uuid[] := '{}';
  brand_ids    uuid[] := '{}';   -- brand_profiles.id
  inf_ids      uuid[] := '{}';   -- influencer_profiles.id
  uid          uuid;
  inf_id       uuid;
  brand_id     uuid;
  i            int;
  j            int;
  nplat        int;
  plat         text;
  fname        text;
  followers    bigint;
  er           numeric(5,2);
  ncampaigns   int := 10;
  camp_id      uuid;
  bid_id       uuid;
  deal_id      uuid;
  picked_inf   uuid;
  d            int;
begin
  -- ── 3 admins ──────────────────────────────────────────────────────────────
  for i in 1..3 loop
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'admin' || i || '@demo.influencehub.app', crypt('Password123!', gen_salt('bf')),
            now(), '{"provider":"email","providers":["email"]}',
            json_build_object('full_name', 'Admin ' || i), now(), now());
    insert into public.profiles (id, full_name, email)
      values (uid, 'Admin ' || i, 'admin' || i || '@demo.influencehub.app')
      on conflict (id) do nothing;
    insert into public.user_roles (user_id, role) values (uid, 'admin');
    admin_ids := admin_ids || uid;
  end loop;

  -- ── 5 brands ──────────────────────────────────────────────────────────────
  for i in 1..5 loop
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'brand' || i || '@demo.influencehub.app', crypt('Password123!', gen_salt('bf')),
            now(), '{"provider":"email","providers":["email"]}',
            json_build_object('full_name', 'Brand Co ' || i), now(), now());
    insert into public.profiles (id, full_name, email)
      values (uid, 'Brand Co ' || i, 'brand' || i || '@demo.influencehub.app')
      on conflict (id) do nothing;
    insert into public.user_roles (user_id, role) values (uid, 'brand');
    insert into public.brand_profiles (user_id) values (uid) returning id into brand_id;
    brand_ids := brand_ids || brand_id;
    -- give the first two brands an active brand_pro subscription
    if i <= 2 then
      insert into public.subscriptions (user_id, plan_type, status, expires_at)
        values (uid, 'brand_pro', 'active', now() + interval '30 days');
    end if;
  end loop;

  -- ── 25 influencers ────────────────────────────────────────────────────────
  for i in 1..25 loop
    uid   := gen_random_uuid();
    fname := firstnames[i] || ' ' || lastnames[i];
    er    := round((1 + random() * 11)::numeric, 2);

    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'influencer' || i || '@demo.influencehub.app', crypt('Password123!', gen_salt('bf')),
            now(), '{"provider":"email","providers":["email"]}',
            json_build_object('full_name', fname), now(), now());
    insert into public.profiles (id, full_name, email)
      values (uid, fname, 'influencer' || i || '@demo.influencehub.app')
      on conflict (id) do nothing;
    insert into public.user_roles (user_id, role) values (uid, 'influencer');

    insert into public.influencer_profiles
      (user_id, display_name, bio, category, city, is_visible, league_rank,
       avatar_url, onboarding_status, engagement_rate)
    values
      (uid, fname,
       fname || ' — top ' || categories[1 + (i % 11)] || ' creator in Uzbekistan. ' ||
         'Authentic content, real audience, measurable results.',
       categories[1 + (i % 11)],
       cities[1 + (i % 5)],
       true, i,
       'https://i.pravatar.cc/300?img=' || (i % 70),
       'completed', er)
    returning id into inf_id;
    inf_ids := inf_ids || inf_id;

    -- 1–3 social platforms
    nplat := 1 + floor(random() * 3)::int;
    for j in 1..nplat loop
      plat      := platforms[1 + ((i + j) % 4)];
      followers := (50000 + floor(random() * 14950000))::bigint;
      insert into public.social_platforms
        (influencer_id, platform, username, followers_count, engagement_rate,
         profile_url, is_primary)
      values
        (inf_id, plat, lower(replace(fname,' ','_')),
         followers, round((1 + random()*11)::numeric,2),
         'https://' || plat || '.com/' || lower(replace(fname,' ','_')),
         j = 1);
    end loop;

    -- 2–5 advertising prices
    for j in 1..(2 + floor(random()*4)::int) loop
      insert into public.advertising_prices
        (influencer_id, ad_type, price_usd, description, duration, delivery_days, is_public)
      values
        (inf_id, adtypes[1 + ((i + j) % 6)],
         round((50 + random()*4950)::numeric, 2),
         'Sponsored ' || adtypes[1 + ((i + j) % 6)] || ' with full creative freedom.',
         (array['24h','48h','permanent','7d'])[1 + floor(random()*4)::int],
         1 + floor(random()*14)::int,
         random() > 0.4);
    end loop;

    -- contacts (email + telegram)
    insert into public.influencer_contacts
      (influencer_id, email, phone, telegram_username, instagram_dm)
    values
      (inf_id, 'influencer' || i || '@demo.influencehub.app',
       '+99890' || lpad((1000000 + floor(random()*8999999)::int)::text, 7, '0'),
       '@' || lower(replace(fname,' ','_')),
       lower(replace(fname,' ','_')));

    -- 0–2 active discounts
    for j in 1..floor(random()*3)::int loop
      insert into public.discounts
        (influencer_id, title, description, discount_percent, valid_until, is_active)
      values
        (inf_id, 'Summer Special -' || (10 + floor(random()*40)::int) || '%',
         'Limited-time discount for new brand partners.',
         10 + floor(random()*40)::int,
         now() + (interval '1 day' * (5 + floor(random()*40)::int)),
         true);
    end loop;

    -- 30 days of analytics history (primary platform)
    for d in 0..29 loop
      insert into public.influencer_analytics_history
        (influencer_id, platform, followers_count, engagement_rate, recorded_at)
      values
        (inf_id, platforms[1 + (i % 4)],
         (200000 + i*50000 + (29-d)*(500 + floor(random()*2000)::int))::bigint,
         round((er + (random()-0.5))::numeric, 2),
         now() - (interval '1 day' * d));
    end loop;

    -- a couple of influencers get a sync subscription + feature
    if i % 7 = 0 then
      insert into public.subscriptions (user_id, plan_type, status, expires_at)
        values (uid, 'influencer_sync', 'active', now() + interval '30 days');
    end if;
  end loop;

  -- ── 10 campaigns ──────────────────────────────────────────────────────────
  for i in 1..ncampaigns loop
    brand_id := brand_ids[1 + (i % array_length(brand_ids,1))];
    insert into public.campaigns
      (brand_id, title, description, requirements, budget_usd, platform, category,
       status, deadline)
    values
      (brand_id,
       (array['Ramadan Promo','New App Launch','Fashion Drop','Summer Menu',
              'Tech Review Series','Travel Vlog','Beauty Box','Fitness Challenge',
              'Back to School','Auto Showcase'])[i],
       'We are looking for authentic creators to promote our brand to a Uzbek audience.',
       'Min 100K followers, ER > 3%, 1 post + 2 stories.',
       round((500 + random()*9500)::numeric, 2),
       platforms[1 + (i % 4)],
       categories[1 + (i % 11)],
       (array['open','open','open','active','active','open','completed','draft','open','active'])[i],
       now() + (interval '1 day' * (7 + i*2)))
    returning id into camp_id;

    -- ── 3 bids per campaign (= 30 bids) ──────────────────────────────────────
    for j in 1..3 loop
      picked_inf := inf_ids[1 + ((i*3 + j) % array_length(inf_ids,1))];
      insert into public.bids
        (campaign_id, influencer_id, proposed_price, proposal, delivery_days, status)
      values
        (camp_id, picked_inf,
         round((300 + random()*4000)::numeric, 2),
         'I love this brand and my audience aligns perfectly. Here is my pitch...',
         3 + floor(random()*10)::int,
         (array['pending','pending','accepted'])[j])
      returning id into bid_id;

      -- ── create a deal for each accepted bid (first campaigns => 10 deals) ──
      if j = 3 and i <= 10 then
        insert into public.deals
          (bid_id, campaign_id, brand_id, influencer_id, agreed_price, status,
           content_url, completed_at, review, rating)
        values
          (bid_id, camp_id, brand_id, picked_inf,
           round((300 + random()*4000)::numeric, 2),
           (array['active','content_submitted','approved','completed','cancelled',
                  'active','content_submitted','approved','completed','active'])[i],
           case when i % 2 = 0 then 'https://youtu.be/demo' || i else null end,
           case when i = 4 or i = 9 then now() else null end,
           case when i = 4 then 'Great collaboration, delivered on time!' else null end,
           case when i = 4 then 5 when i = 9 then 4 else null end);
      end if;
    end loop;
  end loop;

  -- ── a few notifications for brand #1 ──────────────────────────────────────
  insert into public.notifications (user_id, type, title, message, link)
  select bp.user_id, 'bid', 'New bid received',
         'An influencer placed a bid on your campaign.', '/brand/campaigns'
  from public.brand_profiles bp limit 5;

  raise notice 'Seed complete: % admins, % brands, % influencers',
    array_length(admin_ids,1), array_length(brand_ids,1), array_length(inf_ids,1);
end $$;

-- Harden seeded auth users: GoTrue scans these token columns as strings on
-- login; leaving them NULL can cause "Database error querying schema" on some
-- versions. Empty strings are the safe default. (coalesce = only touches NULLs.)
update auth.users set
  confirmation_token     = coalesce(confirmation_token, ''),
  recovery_token         = coalesce(recovery_token, ''),
  email_change           = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, '')
where email like '%@demo.influencehub.app';


-- ============================================================
-- 004_realtime.sql
-- ============================================================
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


-- ============================================================
-- 005_admin_subscriptions.sql
-- ============================================================
-- Allow admins to update subscriptions (e.g. cancel from the admin panel).
-- The base policy only grants SELECT (own + admin); without an UPDATE policy an
-- admin's cancel would be silently filtered out by RLS.

drop policy if exists "admin_manage_subscriptions" on public.subscriptions;
create policy "admin_manage_subscriptions" on public.subscriptions
  for update using (public.is_admin());

-- Force PostgREST to pick up the new tables immediately.
select pg_notify('pgrst', 'reload schema');
