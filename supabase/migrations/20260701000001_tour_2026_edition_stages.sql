-- Tour de France 2026: edition (dormant) + 21 stages. Generated; idempotent.
insert into public.editions (id, slug, name, start_date, end_date, is_active) values
  ('11111111-1111-4111-8111-111111111111', 'tour-de-france-2026', 'Tour de France 2026', '2026-07-04', '2026-07-26', false)
on conflict (id) do update
  set slug = excluded.slug, name = excluded.name,
      start_date = excluded.start_date, end_date = excluded.end_date;
-- NOTE: is_active is intentionally NOT in the update set, so re-running never
-- flips activation. Activation is a separate ops step at go-live.

insert into public.stages (edition_id, number, start_time, counts_for_scoring, double_points, terrain, km) values
  ('11111111-1111-4111-8111-111111111111', 1, '2026-07-04 15:05:00+00', false, false, 'itt', 20),
  ('11111111-1111-4111-8111-111111111111', 2, '2026-07-05 11:55:00+00', false, false, 'hilly', 169),
  ('11111111-1111-4111-8111-111111111111', 3, '2026-07-06 10:20:00+00', true, false, 'mountain', 196),
  ('11111111-1111-4111-8111-111111111111', 4, '2026-07-07 11:25:00+00', false, false, 'hilly', 182),
  ('11111111-1111-4111-8111-111111111111', 5, '2026-07-08 12:15:00+00', false, false, 'flat', 158),
  ('11111111-1111-4111-8111-111111111111', 6, '2026-07-09 10:40:00+00', true, false, 'mountain', 186),
  ('11111111-1111-4111-8111-111111111111', 7, '2026-07-10 11:25:00+00', true, false, 'flat', 175),
  ('11111111-1111-4111-8111-111111111111', 8, '2026-07-11 11:25:00+00', false, false, 'flat', 180),
  ('11111111-1111-4111-8111-111111111111', 9, '2026-07-12 11:45:00+00', true, true, 'hilly', 186),
  ('11111111-1111-4111-8111-111111111111', 10, '2026-07-14 11:25:00+00', true, false, 'mountain', 167),
  ('11111111-1111-4111-8111-111111111111', 11, '2026-07-15 12:05:00+00', true, false, 'flat', 161),
  ('11111111-1111-4111-8111-111111111111', 12, '2026-07-16 12:40:00+00', false, false, 'flat', 179),
  ('11111111-1111-4111-8111-111111111111', 13, '2026-07-17 11:20:00+00', true, true, 'hilly', 206),
  ('11111111-1111-4111-8111-111111111111', 14, '2026-07-18 11:30:00+00', true, false, 'mountain', 155),
  ('11111111-1111-4111-8111-111111111111', 15, '2026-07-19 11:20:00+00', true, true, 'mountain', 184),
  ('11111111-1111-4111-8111-111111111111', 16, '2026-07-21 11:00:00+00', true, false, 'itt', 26),
  ('11111111-1111-4111-8111-111111111111', 17, '2026-07-22 11:35:00+00', false, false, 'flat', 175),
  ('11111111-1111-4111-8111-111111111111', 18, '2026-07-23 10:50:00+00', true, true, 'mountain', 185),
  ('11111111-1111-4111-8111-111111111111', 19, '2026-07-24 12:15:00+00', true, true, 'mountain', 128),
  ('11111111-1111-4111-8111-111111111111', 20, '2026-07-25 09:30:00+00', true, true, 'mountain', 171),
  ('11111111-1111-4111-8111-111111111111', 21, '2026-07-26 14:25:00+00', false, false, 'flat', 133)
on conflict (edition_id, number) do update
  set start_time = excluded.start_time, counts_for_scoring = excluded.counts_for_scoring,
      double_points = excluded.double_points, terrain = excluded.terrain, km = excluded.km;
