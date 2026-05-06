-- Stage 17 (Cassano d'Adda → Andalo, May 27 2026) flipped to double points.
-- Reversible by setting double_points = false on the same row.

update public.stages
  set double_points = true
  where edition_id = '1f81b661-42fa-43db-8af3-5c9a2ac4f107'
    and number = 17;
