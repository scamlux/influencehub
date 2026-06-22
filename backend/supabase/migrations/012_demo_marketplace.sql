-- ============================================================================
-- InfluenceHub — 012_demo_marketplace.sql
-- Re-seed a small demo marketplace so the brand / influencer / admin flows have
-- data to show (campaigns, bids, deals). Tied to a demo brand and the 3 test
-- influencer logins from 011. Idempotent: clears the demo brand's campaigns
-- (cascades bids/deals) before re-inserting.
-- ============================================================================

do $$
declare
  brand uuid;
  infs  uuid[];
  camp_ids uuid[] := '{}';
  cid   uuid;
  bid   uuid;
  i     int;
begin
  -- a demo brand to own the campaigns
  select bp.id into brand
    from public.brand_profiles bp
    join auth.users u on u.id = bp.user_id
   where u.email like 'brand1@demo.influencehub.app'
   limit 1;
  if brand is null then
    raise notice 'no demo brand found — skipping demo marketplace seed';
    return;
  end if;

  -- the claimed test-influencer profiles (from 011)
  select array_agg(ip.id) into infs
    from public.influencer_profiles ip
    join auth.users u on u.id = ip.user_id
   where u.email like 'test-inf%@demo.influencehub.app';
  if infs is null then
    raise notice 'no test influencers found — skipping demo marketplace seed';
    return;
  end if;

  -- clean prior demo campaigns for this brand (cascades bids + deals)
  delete from public.campaigns where brand_id = brand;

  -- 6 campaigns
  for i in 1..6 loop
    insert into public.campaigns
      (brand_id, title, description, requirements, budget_usd, platform, category, status, deadline)
    values (
      brand,
      (array['Summer Collab UZ','Ramadan Special','Tech Gadget Launch','Travel Series',
             'Beauty Box Promo','Family Brand Push'])[i],
      'Looking for authentic creators to promote our brand to a Central Asian audience.',
      'Min 100K followers, ER > 2%, 1 post + 2 stories.',
      round((500 + random() * 4500)::numeric, 2),
      (array['instagram','instagram','tiktok','instagram','instagram','tiktok'])[i],
      (array['fashion','lifestyle','tech','travel','beauty','lifestyle'])[i],
      (array['open','open','open','active','open','active'])[i],
      now() + (interval '1 day' * (10 + i * 3))
    )
    returning id into cid;
    camp_ids := camp_ids || cid;
  end loop;

  -- bids from the test influencers across the first few campaigns
  for i in 1 .. array_length(infs, 1) loop
    insert into public.bids
      (campaign_id, influencer_id, proposed_price, proposal, delivery_days, status)
    values (
      camp_ids[i], infs[i],
      round((300 + random() * 2000)::numeric, 2),
      'My audience aligns perfectly with your brand — here is my proposal.',
      3 + (i * 2), 'pending'
    );
  end loop;

  -- accept the first influencer's bid on campaign #4 (active) → a live deal
  insert into public.bids (campaign_id, influencer_id, proposed_price, proposal, delivery_days, status)
    values (camp_ids[4], infs[1], 1200, 'Ready to start this week.', 5, 'accepted')
    returning id into bid;
  insert into public.deals (bid_id, campaign_id, brand_id, influencer_id, agreed_price, status)
    values (bid, camp_ids[4], brand, infs[1], 1200, 'active');
end $$;
