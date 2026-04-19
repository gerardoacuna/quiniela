import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishFinalCore } from '@/lib/actions/admin-final';
import { createTestUser, userClient } from './helpers';

const EDITION = '00000000-0000-4000-8000-000000000001';
const STAGE_1 = '10000000-0000-4000-8000-000000000001';
const R_POG = '20000000-0000-4000-8000-000000000001';
const R_AYU = '20000000-0000-4000-8000-000000000002';
const R_EVE = '20000000-0000-4000-8000-000000000003';
const R_ROG = '20000000-0000-4000-8000-000000000004';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('publishFinalCore (admin)', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let player: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    admin = await createTestUser('admin');
    player = await createTestUser('player');
    const a = createAdminClient();
    // Ensure Stage 1 is in the FUTURE so GC/jersey picks are writable under RLS.
    await a.from('stages').update({
      start_time: new Date(Date.now() + 30 * 86400_000).toISOString(),
      status: 'upcoming',
    }).eq('id', STAGE_1);
    // Player's GC picks exactly match what we'll publish → 90 pts.
    await a.from('gc_picks').delete().eq('user_id', player.userId);
    await a.from('gc_picks').insert([
      { user_id: player.userId, edition_id: EDITION, position: 1, rider_id: R_POG },
      { user_id: player.userId, edition_id: EDITION, position: 2, rider_id: R_AYU },
      { user_id: player.userId, edition_id: EDITION, position: 3, rider_id: R_EVE },
    ]);
    // Player's jersey pick → Roglic (matches publish).
    await a.from('points_jersey_picks').delete().eq('user_id', player.userId);
    await a.from('points_jersey_picks').insert({
      user_id: player.userId, edition_id: EDITION, rider_id: R_ROG,
    });
    await a.from('final_classifications').delete().eq('edition_id', EDITION);
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('final_classifications').delete().eq('edition_id', EDITION);
    await a.from('gc_picks').delete().eq('user_id', player.userId);
    await a.from('points_jersey_picks').delete().eq('user_id', player.userId);
    // Restore Stage 1 to seeded state (past + published).
    await a.from('stages').update({
      start_time: new Date(Date.now() - 86400_000).toISOString(),
      status: 'published',
    }).eq('id', STAGE_1);
    await admin.cleanup();
    await player.cleanup();
  });

  it('publishing GC matching player picks awards 90 pts', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, {
      editionId: EDITION,
      gc: { first: R_POG, second: R_AYU, third: R_EVE },
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a.from('leaderboard_view').select('*').eq('user_id', player.userId);
    expect(data?.[0]?.gc_points).toBe(90);
  });

  it('publishing jersey matching player pick awards 30 pts', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, {
      editionId: EDITION,
      jerseyRiderId: R_ROG,
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a.from('leaderboard_view').select('*').eq('user_id', player.userId);
    expect(data?.[0]?.jersey_points).toBe(30);
  });

  it('rejects duplicate riders in GC', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, {
      editionId: EDITION,
      gc: { first: R_POG, second: R_POG, third: R_EVE },
    });
    expect(res.ok).toBe(false);
  });

  it('rejects empty publish', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishFinalCore(c, admin.userId, { editionId: EDITION });
    expect(res.ok).toBe(false);
  });
});
