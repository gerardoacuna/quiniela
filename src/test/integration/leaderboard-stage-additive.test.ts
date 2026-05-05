import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestUser, setStageState } from './helpers';
import { createAdminClient } from '@/lib/supabase/admin';

const EDITION = '00000000-0000-4000-8000-000000000001';
// Stage 9 from seed (mountain, double_points=true) — we'll force double_points=false to
// keep the points arithmetic legible and assert the additive sum directly.
const STAGE_ID = '10000000-0000-4000-8000-000000000002';
const RIDER_PRIMARY = '20000000-0000-4000-8000-000000000003'; // Evenepoel
const RIDER_UNDERDOG   = '20000000-0000-4000-8000-000000000004'; // Roglič

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('leaderboard_view stage additive scoring', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    // Stage published in the past so it counts; force double_points=false for legible assertions.
    await setStageState(STAGE_ID, {
      start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
      status: 'published',
      double_points: false,
    });
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('stage_results').delete().eq('stage_id', STAGE_ID);
    await a.from('stage_picks').delete().eq('user_id', user.userId);
    await user.cleanup();
    // Restore stage 9's double_points=true (per seed) and put it back in the future.
    await setStageState(STAGE_ID, {
      start_time: '2026-05-17 12:00:00+00',
      status: 'upcoming',
      double_points: true,
    });
  });

  beforeEach(async () => {
    const a = createAdminClient();
    await a.from('stage_results').delete().eq('stage_id', STAGE_ID);
    await a.from('stage_picks').delete().eq('user_id', user.userId);
  });

  async function readBoard() {
    const a = createAdminClient();
    const { data } = await a
      .from('leaderboard_view')
      .select('stage_points, exact_winners_count')
      .eq('user_id', user.userId)
      .eq('edition_id', EDITION)
      .single();
    return data;
  }

  it('primary P3 + underdog P7 = 14 stage points', async () => {
    const a = createAdminClient();
    await a.from('stage_results').insert([
      { stage_id: STAGE_ID, position: 3, rider_id: RIDER_PRIMARY, status: 'published' },
      { stage_id: STAGE_ID, position: 7, rider_id: RIDER_UNDERDOG,   status: 'published' },
    ]);
    await a.from('stage_picks').insert({
      user_id: user.userId,
      stage_id: STAGE_ID,
      rider_id: RIDER_PRIMARY,
      underdog_rider_id: RIDER_UNDERDOG,
    });

    const board = await readBoard();
    expect(board?.stage_points).toBe(14);
    expect(board?.exact_winners_count).toBe(0);
  });

  it('exact_winners_count ticks when underdog lands P1', async () => {
    const a = createAdminClient();
    await a.from('stage_results').insert([
      { stage_id: STAGE_ID, position: 1, rider_id: RIDER_UNDERDOG,   status: 'published' },
      { stage_id: STAGE_ID, position: 5, rider_id: RIDER_PRIMARY, status: 'published' },
    ]);
    await a.from('stage_picks').insert({
      user_id: user.userId,
      stage_id: STAGE_ID,
      rider_id: RIDER_PRIMARY,
      underdog_rider_id: RIDER_UNDERDOG,
    });

    const board = await readBoard();
    expect(board?.stage_points).toBe(6 + 25);
    expect(board?.exact_winners_count).toBe(1);
  });

  it('underdog null produces only the primary contribution', async () => {
    const a = createAdminClient();
    await a.from('stage_results').insert([
      { stage_id: STAGE_ID, position: 2, rider_id: RIDER_PRIMARY, status: 'published' },
    ]);
    await a.from('stage_picks').insert({
      user_id: user.userId,
      stage_id: STAGE_ID,
      rider_id: RIDER_PRIMARY,
      underdog_rider_id: null,
    });

    const board = await readBoard();
    expect(board?.stage_points).toBe(15);
    expect(board?.exact_winners_count).toBe(0);
  });
});
