-- Bulk-create invites for the 17 Giro 2026 participants who don't yet have a
-- profile. Codes are random; expires 2026-07-04 (~30 days after the race
-- ends). created_by is left NULL for bulk-system inserts.
--
-- Already-onboarded participants (skipped): gerardoacuna@gmail.com,
-- jlopez@aeroelica.com, marcelomorales51@gmail.com, cienfuegos.ricardo@gmail.com.

insert into public.invites (code, created_by, email, expires_at)
select
  replace(gen_random_uuid()::text, '-', ''),
  null,
  email,
  '2026-07-04 00:00:00+00'::timestamptz
from (values
  ('andrestr94@gmail.com'),
  ('fjmartinv@me.com'),
  ('bernardobremer@me.com'),
  ('hectorgtz@gmail.com'),
  ('patriciocueva@reacciones.com'),
  ('apo.rdz@gmail.com'),
  ('juanmpz@gmail.com'),
  ('octavio.rodriguezs13@gmail.com'),
  ('dfariasa@gmail.com'),
  ('pato.gt@gmail.com'),
  ('aellaguno@gmail.com'),
  ('chansantos@hotmail.com'),
  ('eduardorestrepo@yahoo.com'),
  ('mbarreragarza@gmail.com'),
  ('hg@gco.mx'),
  ('jaime.montemayor@amrop.mx'),
  ('rodrigorubioe@gmail.com')
) as t(email)
where not exists (
  select 1 from public.profiles p where p.email = t.email
);
