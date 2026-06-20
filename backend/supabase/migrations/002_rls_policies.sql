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
