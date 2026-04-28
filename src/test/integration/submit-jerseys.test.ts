import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { submitJerseyPickCore } from '@/lib/actions/picks';
import { createTestUser, userClient, setStageState } from './helpers';
import { createAdminClient } from '@/lib/supabase/admin';

const EDITION = '00000000-0000-4000-8000-000000000001';
const STAGE_1 = '10000000-0000-4000-8000-000000000001';
const RIDER_POG = '20000000-0000-4000-8000-000000000001';
const RIDER_AYU = '20000000-0000-4000-8000-000000000002';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('submitJerseyPickCore', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      status: 'upcoming',
    });
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('jersey_picks').delete().eq('user_id', user.userId);
    await user.cleanup();
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
      status: 'published',
    });
  });

  it('saves a single jersey kind per call (points)', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPickCore(c, user.userId, {
      editionId: EDITION,
      kind: 'points',
      riderId: RIDER_POG,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('jersey_picks')
      .select('kind, rider_id')
      .eq('user_id', user.userId)
      .eq('edition_id', EDITION)
      .order('kind');
    expect(data).toEqual([{ kind: 'points', rider_id: RIDER_POG }]);
  });

  it('saving white after points leaves both rows present', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPickCore(c, user.userId, {
      editionId: EDITION,
      kind: 'white',
      riderId: RIDER_AYU,
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

  it('upserting the same kind twice replaces the rider', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitJerseyPickCore(c, user.userId, {
      editionId: EDITION,
      kind: 'points',
      riderId: RIDER_AYU,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('jersey_picks')
      .select('kind, rider_id')
      .eq('user_id', user.userId)
      .eq('edition_id', EDITION)
      .eq('kind', 'points')
      .single();
    expect(data).toEqual({ kind: 'points', rider_id: RIDER_AYU });
  });

  it('rejects when Stage 1 has already started', async () => {
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 3600_000).toISOString(),
      status: 'locked',
    });
    try {
      const c = await userClient(user.email, user.password);
      const res = await submitJerseyPickCore(c, user.userId, {
        editionId: EDITION,
        kind: 'points',
        riderId: RIDER_POG,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('jersey_locked');
    } finally {
      await setStageState(STAGE_1, {
        start_time: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
        status: 'upcoming',
      });
    }
  });

  it('rejects a rider from a different edition', async () => {
    const a = createAdminClient();
    const OTHER_EDITION = '00000000-0000-4000-8000-0000000000ff';
    const OTHER_STAGE_1 = '10000000-0000-4000-8000-0000000000ff';
    await a.from('editions').insert({
      id: OTHER_EDITION,
      slug: 'other-edition-test',
      name: 'Other Edition (test)',
      start_date: '2099-01-01',
      end_date: '2099-01-31',
      is_active: false,
    });
    await a.from('stages').insert({
      id: OTHER_STAGE_1,
      edition_id: OTHER_EDITION,
      number: 1,
      start_time: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      counts_for_scoring: true,
      double_points: false,
      status: 'upcoming',
      terrain: 'flat',
      km: 100,
    });
    try {
      const c = await userClient(user.email, user.password);
      const res = await submitJerseyPickCore(c, user.userId, {
        editionId: OTHER_EDITION,
        kind: 'points',
        riderId: RIDER_POG,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('rider_wrong_edition');
    } finally {
      await a.from('stages').delete().eq('id', OTHER_STAGE_1);
      await a.from('editions').delete().eq('id', OTHER_EDITION);
    }
  });

  it('rejects a rider with status != active', async () => {
    const a = createAdminClient();
    await a.from('riders').update({ status: 'dnf' }).eq('id', RIDER_AYU);
    try {
      const c = await userClient(user.email, user.password);
      const res = await submitJerseyPickCore(c, user.userId, {
        editionId: EDITION,
        kind: 'white',
        riderId: RIDER_AYU,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('rider_not_active');
    } finally {
      await a.from('riders').update({ status: 'active' }).eq('id', RIDER_AYU);
    }
  });
});
