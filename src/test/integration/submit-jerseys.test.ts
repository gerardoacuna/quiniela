import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { submitJerseyPicksCore } from '@/lib/actions/picks';
import { createTestUser, userClient, setStageState } from './helpers';
import { createAdminClient } from '@/lib/supabase/admin';

const EDITION = '00000000-0000-4000-8000-000000000001';
const STAGE_1 = '10000000-0000-4000-8000-000000000001';
const RIDER_POG = '20000000-0000-4000-8000-000000000001';
const RIDER_AYU = '20000000-0000-4000-8000-000000000002';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('submitJerseyPicksCore', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    // Move Stage 1 into the future so jersey picks are writable.
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      status: 'upcoming',
    });
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('jersey_picks').delete().eq('user_id', user.userId);
    await user.cleanup();
    // Restore Stage 1 to its seeded published state for other tests.
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
      status: 'published',
    });
  });

  it('saves both jersey kinds in one call', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPicksCore(c, user.userId, {
      editionId: EDITION,
      pointsRiderId: RIDER_POG,
      whiteRiderId: RIDER_AYU,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('jersey_picks')
      .select('kind, rider_id')
      .eq('user_id', user.userId)
      .eq('edition_id', EDITION)
      .order('kind');
    expect(data).toEqual([
      { kind: 'points', rider_id: RIDER_POG },
      { kind: 'white',  rider_id: RIDER_AYU },
    ]);
  });

  it('allows the same rider for both kinds', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPicksCore(c, user.userId, {
      editionId: EDITION,
      pointsRiderId: RIDER_POG,
      whiteRiderId: RIDER_POG,
    });
    expect(res.ok).toBe(true);
  });

  it('rejects when Stage 1 has already started', async () => {
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 3600_000).toISOString(),
      status: 'locked',
    });
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPicksCore(c, user.userId, {
      editionId: EDITION,
      pointsRiderId: RIDER_POG,
      whiteRiderId: RIDER_AYU,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('jersey_locked');

    // Restore for following tests.
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      status: 'upcoming',
    });
  });

  it('rejects a rider from a different edition', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPicksCore(c, user.userId, {
      editionId: '00000000-0000-0000-0000-000000000999',
      pointsRiderId: RIDER_POG,
      whiteRiderId: RIDER_AYU,
    });
    expect(res.ok).toBe(false);
  });

  it('rejects a rider with status != active', async () => {
    const a = createAdminClient();
    await a.from('riders').update({ status: 'dnf' }).eq('id', RIDER_AYU);
    try {
      const c = await userClient(user.email, user.password);
      const res = await submitJerseyPicksCore(c, user.userId, {
        editionId: EDITION,
        pointsRiderId: RIDER_POG,
        whiteRiderId: RIDER_AYU,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('rider_not_active');
    } finally {
      await a.from('riders').update({ status: 'active' }).eq('id', RIDER_AYU);
    }
  });
});
