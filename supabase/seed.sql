-- Deterministic seed for local dev and integration tests.
-- pgcrypto is needed for crypt() / gen_salt() used in the dev-user rows below.
create extension if not exists pgcrypto;

insert into public.editions (id, slug, name, start_date, end_date, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'giro-2026', 'Giro d''Italia 2026', '2026-05-09', '2026-05-31', true);

insert into public.stages (id, edition_id, number, start_time, counts_for_scoring, double_points, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1,  '2026-05-09 12:00:00+00', true,  false, 'upcoming'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 9,  '2026-05-17 12:00:00+00', true,  true,  'upcoming'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 21, '2026-05-31 12:00:00+00', true,  false, 'upcoming');

insert into public.riders (id, edition_id, pcs_slug, name, team, bib, status) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'tadej-pogacar',     'Tadej Pogačar',      'UAE Team Emirates', 1,  'active'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'juan-ayuso',        'Juan Ayuso',         'UAE Team Emirates', 2,  'active'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'remco-evenepoel',   'Remco Evenepoel',    'Soudal Quick-Step',  11, 'active'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'primoz-roglic',     'Primož Roglič',      'Red Bull - BORA',    21, 'active'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'filippo-ganna',     'Filippo Ganna',      'INEOS Grenadiers',   31, 'active');

-- Dev auth users for local flow testing.
-- Supabase's pgcrypto extension provides crypt() and gen_salt() for bcrypt password hashing.

-- GoTrue's Go structs don't tolerate NULL in the token string columns; seed them as ''.
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at, aud, role, instance_id,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, phone_change_token, phone_change, reauthentication_token
)
values
  ('30000000-0000-0000-0000-000000000001', 'dev-admin@example.com',  crypt('devpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('30000000-0000-0000-0000-000000000002', 'dev-player@example.com', crypt('devpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, display_name, role, email) values
  ('30000000-0000-0000-0000-000000000001', 'Admin (dev)',  'admin',  'dev-admin@example.com'),
  ('30000000-0000-0000-0000-000000000002', 'Player (dev)', 'player', 'dev-player@example.com')
on conflict (id) do nothing;

insert into public.invites (code, created_by, email, expires_at) values
  ('dev-invite-0001', '30000000-0000-0000-0000-000000000001', 'dev-invitee@example.com', now() + interval '7 days')
on conflict (code) do nothing;

-- Push Stage 1 into the past and publish its results so leaderboard has data.
update public.stages set
  start_time = now() - interval '1 day',
  status = 'published'
where id = '10000000-0000-0000-0000-000000000001';

insert into public.stage_results (stage_id, position, rider_id, status) values
  ('10000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-000000000001', 'published'),
  ('10000000-0000-0000-0000-000000000001', 2, '20000000-0000-0000-0000-000000000002', 'published'),
  ('10000000-0000-0000-0000-000000000001', 3, '20000000-0000-0000-0000-000000000003', 'published'),
  ('10000000-0000-0000-0000-000000000001', 4, '20000000-0000-0000-0000-000000000004', 'published'),
  ('10000000-0000-0000-0000-000000000001', 5, '20000000-0000-0000-0000-000000000005', 'published')
on conflict (stage_id, position) do nothing;

insert into public.stage_picks (user_id, stage_id, rider_id) values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')
on conflict (user_id, stage_id) do nothing;
