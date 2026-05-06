-- Flag the 20 top competitors as is_top_tier=true. These riders are excluded
-- from the underdog picker pool. List sourced from the user's curated power
-- ranking (top 20 by points/odds as of 2026-05-05).
--
-- Reversible by setting is_top_tier=false (e.g. via /admin/riders toggle or
-- by re-running with the inverse SET). The set is per-edition.

update public.riders
  set is_top_tier = true
  where edition_id = '1f81b661-42fa-43db-8af3-5c9a2ac4f107'
    and pcs_slug in (
      'jonas-vingegaard',       -- 1.  VINGEGAARD Jonas      (Visma)
      'arnaud-de-lie',          -- 2.  DE LIE Arnaud         (Lotto)
      'tobias-lund-andresen',   -- 3.  ANDRESEN Tobias Lund  (Decathlon)
      'christian-scaroni',      -- 4.  SCARONI Christian     (XDS Astana)
      'paul-magnier',           -- 5.  MAGNIER Paul          (Soudal)
      'giulio-pellizzari',      -- 6.  PELLIZZARI Giulio     (Red Bull)
      'felix-gall',             -- 7.  GALL Felix            (Decathlon)
      'jay-vine',               -- 8.  VINE Jay              (UAE)
      'jan-christen',           -- 9.  CHRISTEN Jan          (UAE)
      'dylan-groenewegen',      -- 10. GROENEWEGEN Dylan     (Unibet)
      'egan-bernal',            -- 11. BERNAL Egan           (INEOS)
      'corbin-strong',          -- 12. STRONG Corbin         (NSN)
      'adam-yates',             -- 13. YATES Adam            (UAE)
      'jonathan-milan',         -- 14. MILAN Jonathan        (Lidl-Trek)
      'giulio-ciccone',         -- 15. CICCONE Giulio        (Lidl-Trek)
      'michael-storer',         -- 16. STORER Michael        (Tudor)
      'thymen-arensman',        -- 17. ARENSMAN Thymen       (INEOS)
      'lukas-kubis',            -- 18. KUBIŠ Lukáš           (Unibet)
      'ben-o-connor',           -- 19. O'CONNOR Ben          (Jayco)
      'jhonatan-narvaez'        -- 20. NARVÁEZ Jhonatan      (UAE)
    );
