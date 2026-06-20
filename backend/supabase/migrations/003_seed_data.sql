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
