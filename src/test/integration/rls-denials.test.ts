import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTestUser, userClient, setStageState } from './helpers';

const STAGE_9 = '10000000-0000-4000-8000-000000000002'; // future (upcoming) per seed
const STAGE_1 = '10000000-0000-4000-8000-000000000001'; // locked (published) per seed
const RIDER_POG = '20000000-0000-4000-8000-000000000001';
const RIDER_AYU = '20000000-0000-4000-8000-000000000002';

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
    const admin = createAdminClient();

    // Capture B's current pick count on Stage 9 (B already has 1 legitimate pick from the earlier test).
    const { data: before } = await admin
      .from('stage_picks')
      .select('id')
      .eq('user_id', userB.userId)
      .eq('stage_id', STAGE_9);
    const beforeCount = before?.length ?? 0;

    const cA = await userClient(userA.email, userA.password);
    const { error } = await cA.from('stage_picks').insert({
      user_id: userB.userId,
      stage_id: STAGE_9,
      rider_id: RIDER_POG,
    });

    // RLS either returns an error OR silently drops the row. Either way, B's pick count must not increase.
    const { data: after } = await admin
      .from('stage_picks')
      .select('id')
      .eq('user_id', userB.userId)
      .eq('stage_id', STAGE_9);
    const afterCount = after?.length ?? 0;

    // Assertion: the spoofed insert had no effect on B's rows.
    expect(afterCount).toBe(beforeCount);
    // Secondary: if the DB returned an error, that's even better.
    if (!error) {
      // Fall-through is allowed; the real check is the row count above.
    }
  });
});
