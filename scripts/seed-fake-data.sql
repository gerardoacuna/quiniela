-- Heavy fake data for local dev: 8 published stages, ~30 riders, 34 players,
-- picks for every user × stage, GC + jersey picks, stage results.
--
-- Re-run with:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/seed-fake-data.sql
--
-- Idempotent: existing rows from supabase/seed.sql are preserved (admin + dev-player
-- profiles), and re-running this file will reset only the picks/results it owns.
-- Bypasses RLS because psql connects as the postgres superuser.

begin;

-- ---------------------------------------------------------------------------
-- 1. Riders — bulk-add ~25 more so 30+ active riders exist for picks.
-- ---------------------------------------------------------------------------
insert into public.riders (id, edition_id, pcs_slug, name, team, bib, status, is_top_tier) values
  ('20000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'jonathan-milan',     'Jonathan Milan',     'Lidl-Trek',                 41, 'active', false),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'mads-pedersen',      'Mads Pedersen',      'Lidl-Trek',                 42, 'active', true),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'jasper-philipsen',   'Jasper Philipsen',   'Alpecin-Deceuninck',        51, 'active', true),
  ('20000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'kaden-groves',       'Kaden Groves',       'Alpecin-Deceuninck',        52, 'active', false),
  ('20000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', 'wout-van-aert',      'Wout van Aert',      'Visma | Lease a Bike',      61, 'active', true),
  ('20000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', 'jonas-vingegaard',   'Jonas Vingegaard',   'Visma | Lease a Bike',      62, 'active', true),
  ('20000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000001', 'sepp-kuss',          'Sepp Kuss',          'Visma | Lease a Bike',      63, 'active', false),
  ('20000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000001', 'adam-yates',         'Adam Yates',         'UAE Team Emirates',         71, 'active', true),
  ('20000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000001', 'jhonatan-narvaez',   'Jhonatan Narváez',   'UAE Team Emirates',         72, 'active', false),
  ('20000000-0000-4000-8000-000000000019', '00000000-0000-4000-8000-000000000001', 'marc-soler',         'Marc Soler',         'UAE Team Emirates',         73, 'active', false),
  ('20000000-0000-4000-8000-00000000001a', '00000000-0000-4000-8000-000000000001', 'derek-gee',          'Derek Gee',          'Israel - Premier Tech',     81, 'active', false),
  ('20000000-0000-4000-8000-00000000001b', '00000000-0000-4000-8000-000000000001', 'simon-yates',        'Simon Yates',        'Jayco AlUla',               91, 'active', false),
  ('20000000-0000-4000-8000-00000000001c', '00000000-0000-4000-8000-000000000001', 'caleb-ewan',         'Caleb Ewan',         'Jayco AlUla',               92, 'active', false),
  ('20000000-0000-4000-8000-00000000001d', '00000000-0000-4000-8000-000000000001', 'romain-bardet',      'Romain Bardet',      'dsm-firmenich PostNL',     101, 'active', false),
  ('20000000-0000-4000-8000-00000000001e', '00000000-0000-4000-8000-000000000001', 'antonio-tiberi',     'Antonio Tiberi',     'Bahrain - Victorious',     111, 'active', false),
  ('20000000-0000-4000-8000-00000000001f', '00000000-0000-4000-8000-000000000001', 'santiago-buitrago',  'Santiago Buitrago',  'Bahrain - Victorious',     112, 'active', false),
  ('20000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001', 'enric-mas',          'Enric Mas',          'Movistar Team',            121, 'active', false),
  ('20000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', 'einer-rubio',        'Einer Rubio',        'Movistar Team',            122, 'active', false),
  ('20000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', 'aleksandr-vlasov',   'Aleksandr Vlasov',   'Red Bull - BORA',          131, 'active', false),
  ('20000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000001', 'jai-hindley',        'Jai Hindley',        'Red Bull - BORA',          132, 'active', true),
  ('20000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', 'ben-oconnor',        'Ben O''Connor',      'Decathlon CMA CGM',        141, 'active', false),
  ('20000000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000001', 'felix-gall',         'Felix Gall',         'Decathlon CMA CGM',        142, 'active', false),
  ('20000000-0000-4000-8000-000000000026', '00000000-0000-4000-8000-000000000001', 'thymen-arensman',    'Thymen Arensman',    'INEOS Grenadiers',         151, 'active', false),
  ('20000000-0000-4000-8000-000000000027', '00000000-0000-4000-8000-000000000001', 'egan-bernal',        'Egan Bernal',        'INEOS Grenadiers',         152, 'active', true),
  ('20000000-0000-4000-8000-000000000028', '00000000-0000-4000-8000-000000000001', 'pello-bilbao',       'Pello Bilbao',       'Bahrain - Victorious',     113, 'active', false),
  ('20000000-0000-4000-8000-000000000029', '00000000-0000-4000-8000-000000000001', 'giulio-ciccone',     'Giulio Ciccone',     'Lidl-Trek',                 43, 'active', false),
  ('20000000-0000-4000-8000-00000000002a', '00000000-0000-4000-8000-000000000001', 'tim-merlier',        'Tim Merlier',        'Soudal Quick-Step',         12, 'active', false)
on conflict (edition_id, pcs_slug) do nothing;

-- Mark the original 5 seed riders' top-tier flags so the underdog hedge is exercised.
update public.riders set is_top_tier = true
  where edition_id = '00000000-0000-4000-8000-000000000001'
    and pcs_slug in ('tadej-pogacar', 'remco-evenepoel', 'primoz-roglic');

-- ---------------------------------------------------------------------------
-- 2. Stages — add stages 2..8 published in the recent past. Stage 1 already
--    exists from seed.sql; bump its date so 1..8 form a contiguous timeline.
-- ---------------------------------------------------------------------------
-- IDs in the 1xxxxxxxx range — disjoint from seed.sql (which uses ...001/002/003).
insert into public.stages (id, edition_id, number, start_time, counts_for_scoring, double_points, status, terrain, km) values
  ('10000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 2, now() - interval '7 days', true, false, 'published', 'flat',     200),
  ('10000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 3, now() - interval '6 days', true, false, 'published', 'hilly',    178),
  ('10000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 4, now() - interval '5 days', true, false, 'published', 'mountain', 165),
  ('10000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 5, now() - interval '4 days', true, false, 'published', 'flat',     205),
  ('10000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 6, now() - interval '3 days', true, false, 'published', 'hilly',    188),
  ('10000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 7, now() - interval '2 days', true, true,  'published', 'mountain', 152),
  ('10000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 8, now() - interval '1 day',  true, false, 'published', 'flat',     215)
on conflict (edition_id, number) do nothing;

update public.stages
  set start_time = now() - interval '8 days', status = 'published', counts_for_scoring = true
  where edition_id = '00000000-0000-4000-8000-000000000001' and number = 1;

-- ---------------------------------------------------------------------------
-- 3. 32 fake players (auth.users + profiles). Deterministic UUIDs for re-runs.
-- ---------------------------------------------------------------------------
do $$
declare
  fake_users text[][] := array[
    array['alessandro@example.com',  'Alessandro Greco'],
    array['beatriz@example.com',     'Beatriz Martín'],
    array['carlos@example.com',      'Carlos Mendoza'],
    array['diana@example.com',       'Diana Reyes'],
    array['emilio@example.com',      'Emilio Vargas'],
    array['florencia@example.com',   'Florencia Solís'],
    array['gabriel@example.com',     'Gabriel Tapia'],
    array['helena@example.com',      'Helena Cruz'],
    array['ignacio@example.com',     'Ignacio Bravo'],
    array['julieta@example.com',     'Julieta Núñez'],
    array['kevin@example.com',       'Kevin Ortega'],
    array['lucia@example.com',       'Lucía Domínguez'],
    array['mateo@example.com',       'Mateo Ramírez'],
    array['nina@example.com',        'Nina Cortez'],
    array['octavio@example.com',     'Octavio Salinas'],
    array['paloma@example.com',      'Paloma Fuentes'],
    array['quique@example.com',      'Quique Vega'],
    array['rosario@example.com',     'Rosario Lago'],
    array['santi@example.com',       'Santiago Beltrán'],
    array['tania@example.com',       'Tania Aguilar'],
    array['ulises@example.com',      'Ulises Paredes'],
    array['valeria@example.com',     'Valeria Maldonado'],
    array['walter@example.com',      'Walter Quintero'],
    array['ximena@example.com',      'Ximena Cano'],
    array['yair@example.com',        'Yair Espinoza'],
    array['zoe@example.com',         'Zoe Hidalgo'],
    array['andres@example.com',      'Andrés Cabrera'],
    array['bruno@example.com',       'Bruno Fierro'],
    array['camila@example.com',      'Camila Rivas'],
    array['dario@example.com',       'Darío Mejía'],
    array['elisa@example.com',       'Elisa Pinto'],
    array['fabian@example.com',      'Fabián Acosta']
  ];
  i int;
  user_uuid uuid;
begin
  for i in 1..array_length(fake_users, 1) loop
    user_uuid := ('40000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    insert into auth.users (
      id, email, encrypted_password, email_confirmed_at, aud, role, instance_id,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
      email_change, phone_change_token, phone_change, reauthentication_token
    ) values (
      user_uuid, fake_users[i][1], crypt('devpass123', gen_salt('bf')), now(),
      'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000',
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', ''
    ) on conflict (id) do nothing;

    insert into public.profiles (id, display_name, role, email)
    values (user_uuid, fake_users[i][2], 'player', fake_users[i][1])
    on conflict (id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Stage picks — every player picks one rider per stage 1..8.
--    Idempotent: clear first, then insert.
-- ---------------------------------------------------------------------------
delete from public.stage_picks
where stage_id in (
  select id from public.stages
  where edition_id = '00000000-0000-4000-8000-000000000001'
    and number between 1 and 8
);

insert into public.stage_picks (user_id, stage_id, rider_id)
select
  p.id,
  s.id,
  (select r.id from public.riders r
     where r.edition_id = s.edition_id and r.status = 'active'
     order by random() limit 1)
from public.profiles p
cross join public.stages s
where s.edition_id = '00000000-0000-4000-8000-000000000001'
  and s.number between 1 and 8
  and p.deleted_at is null;

-- Underdog hedge: when the primary pick is a top-tier rider, attach an
-- underdog (non-top-tier, different rider).
update public.stage_picks sp
set underdog_rider_id = (
  select r.id from public.riders r
  where r.edition_id = (select edition_id from public.stages where id = sp.stage_id)
    and r.is_top_tier = false
    and r.status = 'active'
    and r.id != sp.rider_id
  order by random() limit 1
)
where exists (
  select 1 from public.riders rr
  where rr.id = sp.rider_id and rr.is_top_tier = true
);

-- ---------------------------------------------------------------------------
-- 5. Stage results — top 10 finishers per stage (distinct riders).
-- ---------------------------------------------------------------------------
delete from public.stage_results
where stage_id in (
  select id from public.stages
  where edition_id = '00000000-0000-4000-8000-000000000001'
    and number between 1 and 8
);

with shuffled as (
  select s.id as stage_id, r.id as rider_id,
         row_number() over (partition by s.id order by random()) as pos
  from public.stages s
  join public.riders r
    on r.edition_id = s.edition_id and r.status = 'active'
  where s.edition_id = '00000000-0000-4000-8000-000000000001'
    and s.number between 1 and 8
)
insert into public.stage_results (stage_id, position, rider_id, status)
select stage_id, pos, rider_id, 'published'
from shuffled
where pos <= 10;

-- ---------------------------------------------------------------------------
-- 6. GC picks — each player picks 3 distinct riders for the podium.
-- ---------------------------------------------------------------------------
delete from public.gc_picks where edition_id = '00000000-0000-4000-8000-000000000001';

with user_riders as (
  select p.id as user_id, r.id as rider_id,
         row_number() over (partition by p.id order by random()) as rn
  from public.profiles p
  cross join public.riders r
  where r.edition_id = '00000000-0000-4000-8000-000000000001'
    and r.status = 'active'
    and p.deleted_at is null
)
insert into public.gc_picks (user_id, edition_id, position, rider_id)
select user_id, '00000000-0000-4000-8000-000000000001', rn, rider_id
from user_riders
where rn <= 3;

-- ---------------------------------------------------------------------------
-- 7. Jersey picks — each player picks one rider for points + one for white.
-- ---------------------------------------------------------------------------
delete from public.jersey_picks where edition_id = '00000000-0000-4000-8000-000000000001';

insert into public.jersey_picks (user_id, edition_id, kind, rider_id)
select
  p.id,
  '00000000-0000-4000-8000-000000000001',
  k.kind,
  (select r.id from public.riders r
     where r.edition_id = '00000000-0000-4000-8000-000000000001'
       and r.status = 'active'
     order by random() limit 1)
from public.profiles p
cross join (values ('points'::public.jersey_kind), ('white'::public.jersey_kind)) as k(kind)
where p.deleted_at is null;

commit;

-- Sanity counts.
select 'profiles'      as t, count(*) from public.profiles
union all select 'riders',         count(*) from public.riders
union all select 'stages',         count(*) from public.stages
union all select 'stages_pub',     count(*) from public.stages where status = 'published'
union all select 'stage_picks',    count(*) from public.stage_picks
union all select 'stage_results',  count(*) from public.stage_results
union all select 'gc_picks',       count(*) from public.gc_picks
union all select 'jersey_picks',   count(*) from public.jersey_picks;
