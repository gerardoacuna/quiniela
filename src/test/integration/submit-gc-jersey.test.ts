import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { submitGcPicksCore, submitJerseyPickCore } from '@/lib/actions/picks';
import { createTestUser, userClient, setStageState } from './helpers';

const EDITION = '00000000-0000-4000-8000-000000000001';
const STAGE_1 = '10000000-0000-4000-8000-000000000001';
const STAGE_9 = '10000000-0000-4000-8000-000000000002';
const STAGE_21 = '10000000-0000-4000-8000-000000000003';
const RIDER_POG = '20000000-0000-4000-8000-000000000001';
const RIDER_AYU = '20000000-0000-4000-8000-000000000002';
const RIDER_EVE = '20000000-0000-4000-8000-000000000003';
const RIDER_ROG = '20000000-0000-4000-8000-000000000004';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('submitGcPicksCore + submitJerseyPickCore', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    // Move Stage 1 into the future so GC/jersey are editable.
    const future = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    await setStageState(STAGE_1, { start_time: future, status: 'upcoming' });
    await setStageState(STAGE_9, { start_time: new Date(Date.now() + 31 * 24 * 3600_000).toISOString(), status: 'upcoming' });
    await setStageState(STAGE_21, { start_time: new Date(Date.now() + 60 * 24 * 3600_000).toISOString(), status: 'upcoming' });
  });

  afterAll(async () => {
    await user.cleanup();
    // Restore Stage 1 to its seeded published state so other tests see it as locked.
    await setStageState(STAGE_1, {
      start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
      status: 'published',
    });
  });

  describe('gc', () => {
    it('saves 3 distinct picks', async () => {
      const c = await userClient(user.email, user.password);
      const res = await submitGcPicksCore(c, user.userId, {
        editionId: EDITION,
        first: RIDER_POG,
        second: RIDER_AYU,
        third: RIDER_EVE,
      });
      expect(res.ok).toBe(true);
    });

    it('rejects duplicate rider across slots', async () => {
      const c = await userClient(user.email, user.password);
      const res = await submitGcPicksCore(c, user.userId, {
        editionId: EDITION,
        first: RIDER_POG,
        second: RIDER_POG,
        third: RIDER_EVE,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('gc_riders_must_be_distinct');
    });
  });

  describe('jersey', () => {
    it('saves a pick', async () => {
      const c = await userClient(user.email, user.password);
      const res = await submitJerseyPickCore(c, user.userId, {
        editionId: EDITION,
        riderId: RIDER_ROG,
      });
      expect(res.ok).toBe(true);
    });

    it('rejects a rider from a different edition', async () => {
      const c = await userClient(user.email, user.password);
      const res = await submitJerseyPickCore(c, user.userId, {
        editionId: '00000000-0000-0000-0000-000000000999',
        riderId: RIDER_POG,
      });
      expect(res.ok).toBe(false);
    });
  });
});
