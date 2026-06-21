-- ============================================================================
-- InfluenceHub — 011_test_influencer_accounts.sql
-- Create 3 demo influencer LOGINS so the influencer flow (dashboard, profile
-- edit, campaign bids) can be tested. Each is linked to an existing real
-- blogger profile by social username. Password: Password123!
--
-- Idempotent: influencer_profiles.user_id references auth.users ON DELETE
-- CASCADE, so we must NULL the link BEFORE deleting the old test users —
-- otherwise deleting a test login would cascade-delete the real blogger row.
-- ============================================================================

update public.influencer_profiles ip set user_id = null
 where user_id in (
   select id from auth.users where email like 'test-inf%@demo.influencehub.app');

delete from auth.users where email like 'test-inf%@demo.influencehub.app';

do $$
declare
  pairs text[][] := array[
    array['test-inf1@demo.influencehub.app', 'familytravel.uz'],
    array['test-inf2@demo.influencehub.app', 'yulduz_mav'],
    array['test-inf3@demo.influencehub.app', 'mama.doda']
  ];
  i    int;
  uid  uuid;
  inf  uuid;
  nm   text;
begin
  for i in 1 .. array_length(pairs, 1) loop
    select sp.influencer_id into inf
      from public.social_platforms sp where sp.username = pairs[i][2] limit 1;
    if inf is null then
      raise notice 'no profile for %, skipping', pairs[i][2];
      continue;
    end if;
    select display_name into nm from public.influencer_profiles where id = inf;
    uid := gen_random_uuid();

    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            pairs[i][1], crypt('Password123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', nm), now(), now());

    insert into public.profiles (id, full_name, email)
      values (uid, nm, pairs[i][1]) on conflict (id) do nothing;
    insert into public.user_roles (user_id, role)
      values (uid, 'influencer') on conflict (user_id) do nothing;

    update public.influencer_profiles set user_id = uid where id = inf;
  end loop;
end $$;

-- GoTrue reads these token columns as strings on login; NULLs can break sign-in.
update auth.users set
  confirmation_token     = coalesce(confirmation_token, ''),
  recovery_token         = coalesce(recovery_token, ''),
  email_change           = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, '')
where email like 'test-inf%@demo.influencehub.app';
