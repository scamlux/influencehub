-- Region support: tag each influencer with an ISO country code (e.g. 'UZ').
-- Enables filtering the league by region and going international later.

alter table public.influencer_profiles
  add column if not exists country text;

create index if not exists idx_influencer_country
  on public.influencer_profiles(country);

-- Backfill the existing demo + discovered rows as Uzbekistan.
update public.influencer_profiles set country = 'UZ' where country is null;
