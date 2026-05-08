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

  // -------------------------------------------------------------------------
  // GC + jersey reveal: pre-edition-start visibility & count RPCs
  // -------------------------------------------------------------------------

  const EDITION = '00000000-0000-4000-8000-000000000001';
  const RIDER_EVE = '20000000-0000-4000-8000-000000000003';

  describe('GC + jersey reveal', () => {
    let editionStage1OriginalStartTime: string | null = null;
    let editionStage1OriginalStatus:
      | 'upcoming'
      | 'locked'
      | 'results_draft'
      | 'published'
      | 'cancelled'
      | null = null;

    beforeAll(async () => {
      // Push stage 1 into the future so edition_started() returns false.
      const admin = createAdminClient();
      const { data } = await admin
        .from('stages')
        .select('start_time, status')
        .eq('edition_id', EDITION)
        .eq('number', 1)
        .single();
      editionStage1OriginalStartTime = data?.start_time ?? null;
      editionStage1OriginalStatus = data?.status ?? null;

      await admin
        .from('stages')
        .update({
          start_time: new Date(Date.now() + 30 * 86400_000).toISOString(),
          status: 'upcoming',
        })
        .eq('edition_id', EDITION)
        .eq('number', 1);

      // Clear any pre-existing GC/jersey rows for these test users (defensive).
      await admin
        .from('gc_picks')
        .delete()
        .in('user_id', [userA.userId, userB.userId]);
      await admin
        .from('jersey_picks')
        .delete()
        .in('user_id', [userA.userId, userB.userId]);
    });

    afterAll(async () => {
      // Restore stage 1 to its seeded start_time AND status.
      const admin = createAdminClient();
      if (editionStage1OriginalStartTime && editionStage1OriginalStatus) {
        await admin
          .from('stages')
          .update({
            start_time: editionStage1OriginalStartTime,
            status: editionStage1OriginalStatus,
          })
          .eq('edition_id', EDITION)
          .eq('number', 1);
      }
      await admin
        .from('gc_picks')
        .delete()
        .in('user_id', [userA.userId, userB.userId]);
      await admin
        .from('jersey_picks')
        .delete()
        .in('user_id', [userA.userId, userB.userId]);
    });

    it('pre-edition-start: user A cannot read user B gc_picks; count RPC returns the correct distinct submitter count', async () => {
      // Both A and B insert a partial GC slate as themselves (writes allowed pre-start).
      const cA = await userClient(userA.email, userA.password);
      const cB = await userClient(userB.email, userB.password);

      const { error: aInsertErr } = await cA.from('gc_picks').insert([
        { user_id: userA.userId, edition_id: EDITION, position: 1, rider_id: RIDER_POG },
      ]);
      expect(aInsertErr).toBeNull();
      const { error: bInsertErr } = await cB.from('gc_picks').insert([
        { user_id: userB.userId, edition_id: EDITION, position: 1, rider_id: RIDER_AYU },
      ]);
      expect(bInsertErr).toBeNull();

      // A reads gc_picks scoped to user B → empty (RLS hides B's row).
      const { data: aSeesB } = await cA
        .from('gc_picks')
        .select('user_id, position')
        .eq('user_id', userB.userId);
      expect(aSeesB).toEqual([]);

      // A reads its own row.
      const { data: aSeesSelf } = await cA
        .from('gc_picks')
        .select('user_id, position')
        .eq('user_id', userA.userId);
      expect(aSeesSelf).toHaveLength(1);

      // gc_submission_count counts ALL submitters in the edition (including any
      // dev-player rows from seed.sql), even though RLS prevents A from seeing
      // B's row directly. Use ≥ 2 because the seed may have other GC submitters.
      const { data: count, error: countErr } = await cA.rpc('gc_submission_count', {
        edition_id: EDITION,
      });
      expect(countErr).toBeNull();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('pre-edition-start: user A cannot read user B jersey_picks; jersey_submission_count returns correct count', async () => {
      const cA = await userClient(userA.email, userA.password);
      const cB = await userClient(userB.email, userB.password);

      const { error: aInsertErr } = await cA.from('jersey_picks').insert({
        user_id: userA.userId, edition_id: EDITION, kind: 'points', rider_id: RIDER_POG,
      });
      expect(aInsertErr).toBeNull();
      const { error: bInsertErr } = await cB.from('jersey_picks').insert({
        user_id: userB.userId, edition_id: EDITION, kind: 'white', rider_id: RIDER_EVE,
      });
      expect(bInsertErr).toBeNull();

      const { data: aSeesB } = await cA
        .from('jersey_picks')
        .select('user_id, kind')
        .eq('user_id', userB.userId);
      expect(aSeesB).toEqual([]);

      const { data: count, error: countErr } = await cA.rpc('jersey_submission_count', {
        edition_id: EDITION,
      });
      expect(countErr).toBeNull();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('post-edition-start: A and B can read each other gc_picks and jersey_picks', async () => {
      // Move stage 1 into the past — edition_started() now returns true.
      const admin = createAdminClient();
      await admin
        .from('stages')
        .update({
          start_time: new Date(Date.now() - 86400_000).toISOString(),
          status: 'locked',
        })
        .eq('edition_id', EDITION)
        .eq('number', 1);

      const cA = await userClient(userA.email, userA.password);
      const { data: gcRows } = await cA
        .from('gc_picks')
        .select('user_id, position')
        .eq('edition_id', EDITION);
      expect(gcRows?.length).toBeGreaterThanOrEqual(2);
      // Both users' rows should be present.
      const userIds = new Set(gcRows?.map((r) => r.user_id));
      expect(userIds.has(userA.userId)).toBe(true);
      expect(userIds.has(userB.userId)).toBe(true);

      const { data: jerseyRows } = await cA
        .from('jersey_picks')
        .select('user_id, kind')
        .eq('edition_id', EDITION);
      const jerseyUserIds = new Set(jerseyRows?.map((r) => r.user_id));
      expect(jerseyUserIds.has(userA.userId)).toBe(true);
      expect(jerseyUserIds.has(userB.userId)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Stage underdog visibility through stage_picks_read_locked
  // -------------------------------------------------------------------------

  describe('stage underdog visibility', () => {
    afterEach(async () => {
      const admin = createAdminClient();
      await admin
        .from('stage_picks')
        .delete()
        .in('user_id', [userA.userId, userB.userId])
        .eq('stage_id', STAGE_9);
    });

    afterAll(async () => {
      // Restore Stage 9 to the seeded state (upcoming, future start_time)
      // so downstream test files don't inherit a locked Stage 9.
      await setStageState(STAGE_9, {
        start_time: new Date(Date.now() + 30 * 86400_000).toISOString(),
        status: 'upcoming',
      });
    });

    it('pre-stage-start: user A cannot read user B underdog_rider_id', async () => {
      // Reset Stage 9 to the future.
      await setStageState(STAGE_9, {
        start_time: new Date(Date.now() + 86400_000).toISOString(),
        status: 'upcoming',
      });

      const cB = await userClient(userB.email, userB.password);
      await cB.from('stage_picks').insert({
        user_id: userB.userId,
        stage_id: STAGE_9,
        rider_id: RIDER_POG,
        underdog_rider_id: RIDER_AYU,
      });

      const cA = await userClient(userA.email, userA.password);
      const { data } = await cA
        .from('stage_picks')
        .select('user_id, underdog_rider_id')
        .eq('user_id', userB.userId)
        .eq('stage_id', STAGE_9);
      expect(data).toEqual([]);
    });

    it('post-stage-start: user A can read user B underdog_rider_id', async () => {
      // Place Stage 9's start_time in the past (locked).
      await setStageState(STAGE_9, {
        start_time: new Date(Date.now() - 60_000).toISOString(),
        status: 'locked',
      });

      // Insert as admin since direct writes are blocked when stage is locked.
      const admin = createAdminClient();
      await admin.from('stage_picks').insert({
        user_id: userB.userId,
        stage_id: STAGE_9,
        rider_id: RIDER_POG,
        underdog_rider_id: RIDER_AYU,
      });

      const cA = await userClient(userA.email, userA.password);
      const { data } = await cA
        .from('stage_picks')
        .select('user_id, underdog_rider_id')
        .eq('user_id', userB.userId)
        .eq('stage_id', STAGE_9);
      expect(data?.length).toBe(1);
      expect(data?.[0].underdog_rider_id).toBe(RIDER_AYU);
    });
  });
});
