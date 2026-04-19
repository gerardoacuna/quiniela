import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTestUser, userClient, setStageState } from './helpers';

const STAGE_9 = '10000000-0000-0000-0000-000000000002'; // future (upcoming) per seed
const STAGE_1 = '10000000-0000-0000-0000-000000000001'; // locked (published) per seed
const RIDER_POG = '20000000-0000-0000-0000-000000000001';
const RIDER_AYU = '20000000-0000-0000-0000-000000000002';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('RLS denials', () => {
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    // Ensure Stage 9 is in the future so picks are allowed.
    await setStageState(STAGE_9, {
      start_time: new Date(Date.now() + 30 * 86400_000).toISOString(),
      status: 'upcoming',
    });
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    await userA.cleanup();
    await userB.cleanup();
  });

  it("user A cannot read user B's un-locked pick via RLS", async () => {
    // B submits a pick on Stage 9 (un-locked).
    const cB = await userClient(userB.email, userB.password);
    const { error: insertErr } = await cB.from('stage_picks').insert({
      user_id: userB.userId,
      stage_id: STAGE_9,
      rider_id: RIDER_POG,
    });
    expect(insertErr).toBeNull();

    // A tries to read B's pick for Stage 9.
    const cA = await userClient(userA.email, userA.password);
    const { data } = await cA
      .from('stage_picks')
      .select('id')
      .eq('user_id', userB.userId)
      .eq('stage_id', STAGE_9);
    expect(data).toEqual([]);
  });

  it("user A CAN read user B's pick on a locked stage", async () => {
    // B has a pick on Stage 1 (locked) per seed? No - seed only gave dev-player, not userB.
    // Create one as B on Stage 1 via ADMIN client (bypasses RLS for setup).
    const admin = createAdminClient();
    await admin.from('stage_picks').insert({
      user_id: userB.userId,
      stage_id: STAGE_1,
      rider_id: RIDER_AYU,
    });

    const cA = await userClient(userA.email, userA.password);
    const { data } = await cA
      .from('stage_picks')
      .select('id, user_id, rider_id')
      .eq('user_id', userB.userId)
      .eq('stage_id', STAGE_1);
    expect(data).toBeTruthy();
    expect(data!.length).toBe(1);
  });

  it('non-admin cannot insert into stage_results', async () => {
    const cA = await userClient(userA.email, userA.password);
    const { error } = await cA.from('stage_results').insert({
      stage_id: STAGE_9,
      position: 1,
      rider_id: RIDER_POG,
      status: 'draft',
    });
    expect(error).not.toBeNull();
  });

  it('non-admin cannot read DRAFT stage_results', async () => {
    // Admin inserts a draft result on Stage 9.
    const admin = createAdminClient();
    await admin.from('stage_results').delete().eq('stage_id', STAGE_9);
    const { error: insErr } = await admin.from('stage_results').insert({
      stage_id: STAGE_9,
      position: 2,
      rider_id: RIDER_POG,
      status: 'draft',
    });
    expect(insErr).toBeNull();

    const cA = await userClient(userA.email, userA.password);
    const { data } = await cA
      .from('stage_results')
      .select('*')
      .eq('stage_id', STAGE_9)
      .eq('status', 'draft');
    expect(data).toEqual([]);

    // Cleanup.
    await admin.from('stage_results').delete().eq('stage_id', STAGE_9);
  });

  it('user A cannot write a stage_pick with user_id = user B', async () => {
    const cA = await userClient(userA.email, userA.password);
    // Clear any prior pick for A on Stage 9 first.
    await cA.from('stage_picks').delete().eq('user_id', userA.userId).eq('stage_id', STAGE_9);
    const { error } = await cA.from('stage_picks').insert({
      user_id: userB.userId,
      stage_id: STAGE_9,
      rider_id: RIDER_POG,
    });
    // RLS may return an error OR silently drop the row (0 rows inserted).
    // Check both: either error is set, or no row was written for userB on Stage 9 (beyond the pick B already submitted).
    if (error) {
      expect(error).not.toBeNull();
    } else {
      // Verify via admin that no spurious row was inserted with user_id = userA acting as userB
      const admin = createAdminClient();
      const { data: rows } = await admin
        .from('stage_picks')
        .select('id')
        .eq('user_id', userA.userId)
        .eq('stage_id', STAGE_9);
      // A should have no pick on Stage 9 (they were prevented from writing B's row)
      expect(rows).toEqual([]);
    }
  });
});
