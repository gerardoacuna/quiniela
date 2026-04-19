import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishStageResultsCore, cancelStageCore, resetStageToUpcomingCore } from '@/lib/actions/admin-stage';
import { createTestUser, userClient } from './helpers';

const STAGE_9 = '10000000-0000-4000-8000-000000000002';
const R_POG = '20000000-0000-4000-8000-000000000001';
const R_AYU = '20000000-0000-4000-8000-000000000002';
const R_EVE = '20000000-0000-4000-8000-000000000003';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('publishStageResults (admin)', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let player: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    admin = await createTestUser('admin');
    player = await createTestUser('player');
    const a = createAdminClient();
    // Player has Pogacar on Stage 9.
    await a.from('stage_picks').delete().eq('user_id', player.userId).eq('stage_id', STAGE_9);
    await a.from('stage_picks').insert({ user_id: player.userId, stage_id: STAGE_9, rider_id: R_POG });
    // Push Stage 9 slightly into the past so publishing makes sense.
    await a.from('stages').update({ start_time: new Date(Date.now() - 3600_000).toISOString() }).eq('id', STAGE_9);
    // Clean any prior results on this stage.
    await a.from('stage_results').delete().eq('stage_id', STAGE_9);
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('stage_results').delete().eq('stage_id', STAGE_9);
    await a.from('stage_picks').delete().eq('stage_id', STAGE_9);
    // Restore seed defaults.
    await a.from('stages').update({
      start_time: '2026-05-17T12:00:00Z',
      status: 'upcoming',
    }).eq('id', STAGE_9);
    await admin.cleanup();
    await player.cleanup();
  });

  it('publishing Pogacar at position 1 on Stage 9 (2×) awards player 50 pts', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishStageResultsCore(c, admin.userId, {
      stageId: STAGE_9,
      results: [
        { position: 1, rider_id: R_POG },
        { position: 2, rider_id: R_AYU },
        { position: 3, rider_id: R_EVE },
      ],
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a.from('leaderboard_view').select('*').eq('user_id', player.userId);
    expect(data?.[0]?.stage_points).toBe(50);
    expect(data?.[0]?.exact_winners_count).toBe(1);
  });

  it('rejects duplicate positions', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await publishStageResultsCore(c, admin.userId, {
      stageId: STAGE_9,
      results: [
        { position: 1, rider_id: R_POG },
        { position: 1, rider_id: R_AYU },
      ],
    });
    expect(res.ok).toBe(false);
  });

  it('non-admin cannot publish (RLS blocks stage_results writes)', async () => {
    const c = await userClient(player.email, player.password);
    const res = await publishStageResultsCore(c, player.userId, {
      stageId: STAGE_9,
      results: [{ position: 1, rider_id: R_POG }],
    });
    expect(res.ok).toBe(false);
  });

  it('refuses to reset a published stage', async () => {
    // Stage 9 is still published from the first test — try to reset it.
    const c = await userClient(admin.email, admin.password);
    const res = await resetStageToUpcomingCore(c, admin.userId, STAGE_9);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('stage_already_published');

    // Confirm stage_results are still present and stage is still published.
    const a = createAdminClient();
    const { data: results } = await a.from('stage_results').select('position').eq('stage_id', STAGE_9);
    expect((results ?? []).length).toBeGreaterThan(0);
    const { data: stage } = await a.from('stages').select('status').eq('id', STAGE_9).maybeSingle();
    expect(stage?.status).toBe('published');
  });

  it('refuses to cancel a published stage', async () => {
    const c = await userClient(admin.email, admin.password);
    const res = await cancelStageCore(c, admin.userId, STAGE_9);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('stage_already_published');
  });
});
