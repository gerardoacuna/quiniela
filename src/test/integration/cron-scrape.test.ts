import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { scrapeAndPersist } from '@/lib/cron/scrape';
import { readFixture } from '@test/helpers/read-fixture';
import { setStageState } from './helpers';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

const EDITION_ID = '00000000-0000-4000-8000-000000000001';
const STAGE_1_ID = '10000000-0000-4000-8000-000000000001';

// Dispatches to fixture files based on URL suffix
async function fakeFetcher(url: string): Promise<string> {
  if (url.endsWith('/startlist')) return readFixture('startlist.html');
  if (url.includes('/stage-1')) return readFixture('stage-results.html');
  if (url.endsWith('/gc')) return readFixture('final-gc.html');
  if (url.endsWith('/points')) return readFixture('final-points.html');
  throw new Error(`unexpected url: ${url}`);
}

// Broken fetcher returns unparseable HTML
async function brokenFetcher(): Promise<string> {
  return '<html>nope</html>';
}

d('scrapeAndPersist integration', () => {
  beforeEach(async () => {
    const admin = createAdminClient();

    // Clear FK-dependent rows in order
    const stageIds =
      (await admin.from('stages').select('id').eq('edition_id', EDITION_ID)).data?.map(
        (s) => s.id,
      ) ?? [];

    await admin.from('stage_picks').delete().in('stage_id', stageIds);
    await admin.from('stage_results').delete().in('stage_id', stageIds);
    await admin.from('gc_picks').delete().eq('edition_id', EDITION_ID);
    await admin.from('points_jersey_picks').delete().eq('edition_id', EDITION_ID);
    await admin.from('final_classifications').delete().eq('edition_id', EDITION_ID);
    await admin.from('riders').delete().eq('edition_id', EDITION_ID);
    await admin.from('scrape_errors').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Reset Stage 1 to deterministic state
    await setStageState(STAGE_1_ID, {
      start_time: '2026-05-09T12:00:00Z',
      status: 'upcoming',
    });
  });

  afterAll(async () => {
    const admin = createAdminClient();

    // Clean up anything left by the tests
    const stageIds =
      (await admin.from('stages').select('id').eq('edition_id', EDITION_ID)).data?.map(
        (s) => s.id,
      ) ?? [];

    await admin.from('stage_picks').delete().in('stage_id', stageIds);
    await admin.from('stage_results').delete().in('stage_id', stageIds);
    await admin.from('gc_picks').delete().eq('edition_id', EDITION_ID);
    await admin.from('points_jersey_picks').delete().eq('edition_id', EDITION_ID);
    await admin.from('final_classifications').delete().eq('edition_id', EDITION_ID);
    await admin.from('riders').delete().eq('edition_id', EDITION_ID);
    await admin.from('scrape_errors').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Re-insert seed riders
    await admin.from('riders').insert([
      {
        id: '20000000-0000-4000-8000-000000000001',
        edition_id: EDITION_ID,
        pcs_slug: 'tadej-pogacar',
        name: 'Tadej Pogačar',
        team: 'UAE Team Emirates',
        bib: 1,
        status: 'active',
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        edition_id: EDITION_ID,
        pcs_slug: 'juan-ayuso',
        name: 'Juan Ayuso',
        team: 'UAE Team Emirates',
        bib: 2,
        status: 'active',
      },
      {
        id: '20000000-0000-4000-8000-000000000003',
        edition_id: EDITION_ID,
        pcs_slug: 'remco-evenepoel',
        name: 'Remco Evenepoel',
        team: 'Soudal Quick-Step',
        bib: 11,
        status: 'active',
      },
      {
        id: '20000000-0000-4000-8000-000000000004',
        edition_id: EDITION_ID,
        pcs_slug: 'primoz-roglic',
        name: 'Primož Roglič',
        team: 'Red Bull - BORA',
        bib: 21,
        status: 'active',
      },
      {
        id: '20000000-0000-4000-8000-000000000005',
        edition_id: EDITION_ID,
        pcs_slug: 'filippo-ganna',
        name: 'Filippo Ganna',
        team: 'INEOS Grenadiers',
        bib: 31,
        status: 'active',
      },
    ]);

    // Restore Stage 1 to seed state: past time + published
    await admin
      .from('stages')
      .update({
        start_time: new Date(Date.now() - 86400_000).toISOString(),
        status: 'published',
      })
      .eq('id', STAGE_1_ID);

    // Re-insert published stage results
    await admin.from('stage_results').insert([
      {
        stage_id: STAGE_1_ID,
        position: 1,
        rider_id: '20000000-0000-4000-8000-000000000001',
        status: 'published',
      },
      {
        stage_id: STAGE_1_ID,
        position: 2,
        rider_id: '20000000-0000-4000-8000-000000000002',
        status: 'published',
      },
      {
        stage_id: STAGE_1_ID,
        position: 3,
        rider_id: '20000000-0000-4000-8000-000000000003',
        status: 'published',
      },
      {
        stage_id: STAGE_1_ID,
        position: 4,
        rider_id: '20000000-0000-4000-8000-000000000004',
        status: 'published',
      },
      {
        stage_id: STAGE_1_ID,
        position: 5,
        rider_id: '20000000-0000-4000-8000-000000000005',
        status: 'published',
      },
    ]);

    // Re-insert stage pick for seed player
    await admin.from('stage_picks').insert({
      user_id: '30000000-0000-4000-8000-000000000002',
      stage_id: STAGE_1_ID,
      rider_id: '20000000-0000-4000-8000-000000000001',
    });
  });

  it('first run populates riders from startlist fixture', async () => {
    const admin = createAdminClient();

    // Verify no riders before test
    const { count: before } = await admin
      .from('riders')
      .select('id', { count: 'exact', head: true })
      .eq('edition_id', EDITION_ID);
    expect(before).toBe(0);

    const sent: { to: string; subject: string }[] = [];

    const res = await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
      emailer: async (to, subject) => {
        sent.push({ to, subject });
      },
    });

    expect(res.ok).toBe(true);

    const { count: after } = await admin
      .from('riders')
      .select('id', { count: 'exact', head: true })
      .eq('edition_id', EDITION_ID);
    expect(after).toBeGreaterThan(20);
  });

  it('after riders seeded, scrapes stage-1 results into drafts', async () => {
    const sent: { to: string; subject: string }[] = [];

    // Prime riders first (before stage window)
    await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T11:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
      emailer: async (to, subject) => {
        sent.push({ to, subject });
      },
    });

    // Verify riders were seeded
    const admin = createAdminClient();
    const { count: riderCount } = await admin
      .from('riders')
      .select('id', { count: 'exact', head: true })
      .eq('edition_id', EDITION_ID);
    expect(riderCount).toBeGreaterThan(0);

    // Reset Stage 1 to upcoming with start_time in the window
    await setStageState(STAGE_1_ID, {
      start_time: '2026-05-09T12:00:00Z',
      status: 'upcoming',
    });

    const sent2: { to: string; subject: string }[] = [];

    // Scrape at 18:00 — 6h after stage start, within the window
    const res = await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
      emailer: async (to, subject) => {
        sent2.push({ to, subject });
      },
    });

    expect(res.ok).toBe(true);

    // Verify stage_results for Stage 1 have draft rows
    const { data: results } = await admin
      .from('stage_results')
      .select('position, status')
      .eq('stage_id', STAGE_1_ID)
      .eq('status', 'draft');
    expect(results?.length).toBeGreaterThan(0);

    // Admin should have been notified
    expect(sent2.length).toBeGreaterThanOrEqual(1);
  });

  it('writes scrape_error and skips stage when resolved positions have gaps', async () => {
    const admin = createAdminClient();

    // Fixture top 3: 1=mads-pedersen, 2=wout-van-aert, 3=orluis-aular.
    // Insert only positions 2 and 3 → resolved set is [2,3] which isn't
    // contiguous from 1, so scrape must refuse to write a gappy draft.
    await admin.from('riders').insert([
      {
        edition_id: EDITION_ID,
        pcs_slug: 'wout-van-aert',
        name: 'Wout van Aert',
        status: 'active',
      },
      {
        edition_id: EDITION_ID,
        pcs_slug: 'orluis-aular',
        name: 'Orluis Aular',
        status: 'active',
      },
    ]);

    await setStageState(STAGE_1_ID, {
      start_time: '2026-05-09T12:00:00Z',
      status: 'upcoming',
    });

    const { count: before } = await admin
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true });

    const res = await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
    });

    expect(res.ok).toBe(false);
    const unresolved = res.targets.find((t) => t.target === 'stage-1');
    expect(unresolved?.message).toBe('unresolved_riders');

    // scrape_errors has a new row, and NO draft stage_results exist for Stage 1.
    const { count: after } = await admin
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true });
    expect(after).toBeGreaterThan(before ?? 0);

    const { data: drafts } = await admin
      .from('stage_results')
      .select('position')
      .eq('stage_id', STAGE_1_ID)
      .eq('status', 'draft');
    expect(drafts ?? []).toEqual([]);
  });

  it('parse error writes to scrape_errors and does not crash', async () => {
    const admin = createAdminClient();

    const { count: before } = await admin
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true });

    const res = await scrapeAndPersist({
      fetcher: brokenFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
    });

    const { count: after } = await admin
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true });

    expect(after).toBeGreaterThan(before ?? 0);
    expect(res.ok).toBe(false);
  });
});
