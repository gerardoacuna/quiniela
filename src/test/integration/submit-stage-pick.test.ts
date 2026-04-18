import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { submitStagePickCore } from '@/lib/actions/picks';
import { createTestUser, userClient, setStageState } from './helpers';

const STAGE_1 = '10000000-0000-0000-0000-000000000001';  // locked (past start_time, published) per seed
const STAGE_9 = '10000000-0000-0000-0000-000000000002';  // future, double_points per seed
const STAGE_21 = '10000000-0000-0000-0000-000000000003'; // future per seed
const RIDER_POGACAR = '20000000-0000-0000-0000-000000000001';
const RIDER_AYUSO = '20000000-0000-0000-0000-000000000002';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('submitStagePickCore', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    // Explicitly lock Stage 1 in the past so this test is not affected by gc-jersey test state.
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
      status: 'published',
    });
    // Ensure Stage 9 and Stage 21 are in the future.
    const future = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    await setStageState(STAGE_9, { start_time: future, status: 'upcoming' });
    await setStageState(STAGE_21, { start_time: future, status: 'upcoming' });
  });

  afterAll(async () => {
    await user.cleanup();
  });

  it('creates a pick when stage is upcoming and rider is active', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePickCore(c, user.userId, { stageId: STAGE_9, riderId: RIDER_POGACAR });
    expect(res.ok).toBe(true);
  });

  it('rejects re-picking the same rider on a different stage', async () => {
    const c = await userClient(user.email, user.password);
    // Ensure the user currently has Pogacar on Stage 9 from previous test.
    const res = await submitStagePickCore(c, user.userId, { stageId: STAGE_21, riderId: RIDER_POGACAR });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/rider_already_used/);
  });

  it('allows picking a different rider on a different stage', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePickCore(c, user.userId, { stageId: STAGE_21, riderId: RIDER_AYUSO });
    expect(res.ok).toBe(true);
  });

  it('rejects when stage is locked (start_time in past)', async () => {
    const c = await userClient(user.email, user.password);
    const res = await submitStagePickCore(c, user.userId, { stageId: STAGE_1, riderId: RIDER_POGACAR });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('stage_locked');
  });

  it('allows updating the same-stage pick (editing)', async () => {
    const c = await userClient(user.email, user.password);
    // Change Stage 9 pick from Pogacar to Evenepoel — Pogacar is still on Stage 9 so no no-reuse conflict.
    const EVENEPOEL = '20000000-0000-0000-0000-000000000003';
    const res = await submitStagePickCore(c, user.userId, { stageId: STAGE_9, riderId: EVENEPOEL });
    expect(res.ok).toBe(true);
  });
});
