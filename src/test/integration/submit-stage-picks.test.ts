import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { submitStagePicksCore } from '@/lib/actions/picks';
import { createTestUser, userClient, setStageState } from './helpers';
import { createAdminClient } from '@/lib/supabase/admin';

// Use stages 9 and 21 from the seed; both are future-dated.
const STAGE_FUTURE_ID = '10000000-0000-4000-8000-000000000002';
const STAGE_OTHER_ID = '10000000-0000-4000-8000-000000000003';
const STAGE_OTHER_NUMBER = 21;

// Active riders from seed.
const RIDER_PRIMARY = '20000000-0000-4000-8000-000000000003'; // Evenepoel
const RIDER_HEDGE   = '20000000-0000-4000-8000-000000000004'; // Roglič
const RIDER_OTHER   = '20000000-0000-4000-8000-000000000005'; // Ganna
const RIDER_TOP_TIER = '20000000-0000-4000-8000-000000000001'; // Pogačar — flagged in setup

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('submitStagePicksCore', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    await setStageState(STAGE_FUTURE_ID, {
      start_time: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      status: 'upcoming',
    });
    await setStageState(STAGE_OTHER_ID, {
      start_time: new Date(Date.now() + 8 * 24 * 3600_000).toISOString(),
      status: 'upcoming',
    });
    const a = createAdminClient();
    await a.from('riders').update({ is_top_tier: true }).eq('id', RIDER_TOP_TIER);
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('stage_picks').delete().eq('user_id', user.userId);
    await a.from('riders').update({ is_top_tier: false }).eq('id', RIDER_TOP_TIER);
    await user.cleanup();
  });

  beforeEach(async () => {
    const a = createAdminClient();
    await a.from('stage_picks').delete().eq('user_id', user.userId);
  });

  it('saves primary only (hedge null)', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: null,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('stage_picks')
      .select('rider_id, hedge_rider_id')
      .eq('user_id', user.userId)
      .eq('stage_id', STAGE_FUTURE_ID)
      .single();
    expect(data).toEqual({ rider_id: RIDER_PRIMARY, hedge_rider_id: null });
  });

  it('saves primary + hedge', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_HEDGE,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('stage_picks')
      .select('rider_id, hedge_rider_id')
      .eq('user_id', user.userId)
      .eq('stage_id', STAGE_FUTURE_ID)
      .single();
    expect(data).toEqual({ rider_id: RIDER_PRIMARY, hedge_rider_id: RIDER_HEDGE });
  });

  it('updates hedge later without changing primary', async () => {
    const c = await userClient(user.email, user.password);
    await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: null,
    });
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_HEDGE,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('stage_picks')
      .select('rider_id, hedge_rider_id')
      .eq('user_id', user.userId)
      .eq('stage_id', STAGE_FUTURE_ID)
      .single();
    expect(data).toEqual({ rider_id: RIDER_PRIMARY, hedge_rider_id: RIDER_HEDGE });
  });

  it('removes hedge by passing null', async () => {
    const c = await userClient(user.email, user.password);
    await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_HEDGE,
    });
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: null,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a
      .from('stage_picks')
      .select('hedge_rider_id')
      .eq('user_id', user.userId)
      .eq('stage_id', STAGE_FUTURE_ID)
      .single();
    expect(data?.hedge_rider_id).toBeNull();
  });

  it('rejects when stage is locked', async () => {
    await setStageState(STAGE_FUTURE_ID, {
      start_time: new Date(Date.now() - 3600_000).toISOString(),
      status: 'locked',
    });
    try {
      const c = await userClient(user.email, user.password);
      const res = await submitStagePicksCore(c, user.userId, {
        stageId: STAGE_FUTURE_ID,
        primaryRiderId: RIDER_PRIMARY,
        hedgeRiderId: null,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('stage_locked');
    } finally {
      await setStageState(STAGE_FUTURE_ID, {
        start_time: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
        status: 'upcoming',
      });
    }
  });

  it('rejects primary == hedge with primary_equals_hedge', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_PRIMARY,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('primary_equals_hedge');
  });

  it('rejects hedge with is_top_tier=true', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_TOP_TIER,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('rider_not_eligible_hedge');
  });

  it('rejects when hedge was used as primary on another stage', async () => {
    const c = await userClient(user.email, user.password);
    // Primary RIDER_OTHER on STAGE_OTHER first.
    await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_OTHER_ID,
      primaryRiderId: RIDER_OTHER,
      hedgeRiderId: null,
    });
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_OTHER,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(`rider_already_used_on_stage_${STAGE_OTHER_NUMBER}`);
  });

  it('rejects when primary was used as hedge on another stage', async () => {
    const c = await userClient(user.email, user.password);
    // RIDER_PRIMARY as hedge on STAGE_OTHER.
    await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_OTHER_ID,
      primaryRiderId: RIDER_OTHER,
      hedgeRiderId: RIDER_PRIMARY,
    });
    const res = await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_FUTURE_ID,
      primaryRiderId: RIDER_PRIMARY,
      hedgeRiderId: RIDER_HEDGE,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(`rider_already_used_on_stage_${STAGE_OTHER_NUMBER}`);
  });

  it('cancelled-stage rider does NOT burn the slot', async () => {
    const c = await userClient(user.email, user.password);
    // Use RIDER_OTHER on STAGE_OTHER, then cancel that stage.
    await submitStagePicksCore(c, user.userId, {
      stageId: STAGE_OTHER_ID,
      primaryRiderId: RIDER_OTHER,
      hedgeRiderId: null,
    });
    await setStageState(STAGE_OTHER_ID, {
      start_time: new Date(Date.now() + 8 * 24 * 3600_000).toISOString(),
      status: 'cancelled',
    });
    try {
      const res = await submitStagePicksCore(c, user.userId, {
        stageId: STAGE_FUTURE_ID,
        primaryRiderId: RIDER_OTHER,
        hedgeRiderId: null,
      });
      expect(res.ok).toBe(true);
    } finally {
      await setStageState(STAGE_OTHER_ID, {
        start_time: new Date(Date.now() + 8 * 24 * 3600_000).toISOString(),
        status: 'upcoming',
      });
    }
  });
});
