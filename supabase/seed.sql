-- Deterministic seed for local dev and integration tests.

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
