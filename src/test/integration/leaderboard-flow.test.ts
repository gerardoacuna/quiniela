import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTestUser, setStageState } from './helpers';

const STAGE_1 = '10000000-0000-4000-8000-000000000001'; // seeded as published, in past
const RIDER_POG = '20000000-0000-4000-8000-000000000001';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('Leaderboard flow', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    // Restore Stage 1 to its "seeded" state (published, in past) in case prior suites moved it.
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 86400_000).toISOString(),
      status: 'published',
    });
    user = await createTestUser();
    // User picked Pogacar (1st place in seeded results) on Stage 1.
    // Use admin client because Stage 1 is locked; normal RLS forbids writes.
    const admin = createAdminClient();
    await admin.from('stage_picks').delete().eq('user_id', user.userId);
    await admin.from('stage_picks').insert({
      user_id: user.userId,
      stage_id: STAGE_1,
      rider_id: RIDER_POG,
    });
  });

  afterAll(async () => {
    await user.cleanup();
  });

  it('leaderboard shows the new user with 25 points and 1 exact winner from Stage 1', async () => {
    // Use admin client to bypass auth for read.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('leaderboard_view')
      .select('*')
      .eq('user_id', user.userId);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBe(1);
    const row = data![0];
    // Stage 1 is not double points; top spot is 25.
    expect(row.total_points ?? 0).toBe(25);
    expect(row.exact_winners_count ?? 0).toBe(1);
    expect(row.stage_points ?? 0).toBe(25);
    expect(row.gc_points ?? 0).toBe(0);
    expect(row.jersey_points ?? 0).toBe(0);
  });

  it('leaderboard total across dev-player + test user reflects both scoring runs', async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from('leaderboard_view')
      .select('user_id, display_name, total_points, exact_winners_count')
      .order('total_points', { ascending: false });

    expect(data).toBeTruthy();
    // dev-player has the seeded Stage 1 pick (Pogacar) → 25 pts.
    // test user also picked Pogacar → 25 pts. Both should be in top entries.
    const top = data!.filter((r) => (r.total_points ?? 0) === 25);
    expect(top.length).toBeGreaterThanOrEqual(2);
  });
});
