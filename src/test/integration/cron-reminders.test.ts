import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPickReminders } from '@/lib/cron/reminders';
import { createTestUser, setStageState } from './helpers';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

const STAGE_9_ID = '10000000-0000-4000-8000-000000000002';
// A fixed clock near Stage 9's seed start_time so range filtering is deterministic.
const NOW = new Date('2026-05-17T10:30:00Z');
const IN_WINDOW = '2026-05-17T12:00:00Z'; // 90 min after NOW
const OUT_OF_WINDOW = '2026-05-17T13:30:00Z'; // 3h after NOW

d('sendPickReminders integration', () => {
  let userA: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    userA = await createTestUser('player');
  });

  afterAll(async () => {
    const admin = createAdminClient();
    // Wipe any pick_reminders_sent rows for Stage 9 that tests created.
    await admin.from('pick_reminders_sent').delete().eq('stage_id', STAGE_9_ID);
    // Restore Stage 9 to seed baseline.
    await setStageState(STAGE_9_ID, {
      start_time: '2026-05-17T12:00:00Z',
      status: 'upcoming',
    });
    await userA.cleanup();
  });

  beforeEach(async () => {
    const admin = createAdminClient();
    // Reset state: no reminders recorded, no picks by userA on Stage 9.
    await admin.from('pick_reminders_sent').delete().eq('stage_id', STAGE_9_ID);
    await admin
      .from('stage_picks')
      .delete()
      .eq('stage_id', STAGE_9_ID)
      .eq('user_id', userA.userId);
  });

  it('sends a reminder when stage locks within 2h and user has no pick', async () => {
    await setStageState(STAGE_9_ID, { start_time: IN_WINDOW, status: 'upcoming' });

    const sent: { to: string; subject: string }[] = [];
    const res = await sendPickReminders({
      now: () => NOW,
      windowMinutes: 120,
      emailer: async (to, subject) => {
        sent.push({ to, subject });
      },
    });

    expect(res.ok).toBe(true);
    expect(res.sent).toBeGreaterThanOrEqual(1);
    expect(sent.some((e) => e.to === userA.email)).toBe(true);

    const admin = createAdminClient();
    const { data: marked } = await admin
      .from('pick_reminders_sent')
      .select('user_id')
      .eq('stage_id', STAGE_9_ID)
      .eq('user_id', userA.userId);
    expect(marked?.length).toBe(1);
  });

  it('does not double-send on a second run', async () => {
    await setStageState(STAGE_9_ID, { start_time: IN_WINDOW, status: 'upcoming' });

    const sent: { to: string; subject: string }[] = [];
    const emailer = async (to: string, subject: string) => {
      sent.push({ to, subject });
    };

    const first = await sendPickReminders({ now: () => NOW, windowMinutes: 120, emailer });
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const second = await sendPickReminders({ now: () => NOW, windowMinutes: 120, emailer });
    expect(second.sent).toBe(0);
  });

  it('rolls back claim when emailer throws so next run retries', async () => {
    await setStageState(STAGE_9_ID, { start_time: IN_WINDOW, status: 'upcoming' });

    const failing = async () => {
      throw new Error('smtp_down');
    };

    const first = await sendPickReminders({
      now: () => NOW,
      windowMinutes: 120,
      emailer: failing,
    });
    expect(first.ok).toBe(false);
    expect(first.sent).toBe(0);
    expect(first.errors.length).toBeGreaterThanOrEqual(1);

    // The failed claim must have been released — next run with a working emailer succeeds.
    const sent: { to: string; subject: string }[] = [];
    const second = await sendPickReminders({
      now: () => NOW,
      windowMinutes: 120,
      emailer: async (to, subject) => {
        sent.push({ to, subject });
      },
    });
    expect(second.ok).toBe(true);
    expect(second.sent).toBeGreaterThanOrEqual(1);
    expect(sent.some((e) => e.to === userA.email)).toBe(true);
  });

  it('concurrent runs send exactly once per user', async () => {
    await setStageState(STAGE_9_ID, { start_time: IN_WINDOW, status: 'upcoming' });

    const sent: { to: string; subject: string }[] = [];
    const emailer = async (to: string, subject: string) => {
      sent.push({ to, subject });
    };

    const [a, b] = await Promise.all([
      sendPickReminders({ now: () => NOW, windowMinutes: 120, emailer }),
      sendPickReminders({ now: () => NOW, windowMinutes: 120, emailer }),
    ]);

    const totalSent = a.sent + b.sent;
    expect(totalSent).toBeGreaterThanOrEqual(1);
    // Guard: if the claim mechanism silently excluded userA, totalSent could be
    // 0-from-somewhere-else and the exactly-once loop below would trivially pass.
    expect(sent.some((e) => e.to === userA.email)).toBe(true);

    const emailCounts = sent.reduce<Record<string, number>>((acc, e) => {
      acc[e.to] = (acc[e.to] ?? 0) + 1;
      return acc;
    }, {});
    for (const to of Object.keys(emailCounts)) {
      expect(emailCounts[to]).toBe(1);
    }
    expect(sent.length).toBe(totalSent);
  });

  it('does not send when stage is outside the 2h window', async () => {
    await setStageState(STAGE_9_ID, { start_time: OUT_OF_WINDOW, status: 'upcoming' });

    const sent: { to: string; subject: string }[] = [];
    const res = await sendPickReminders({
      now: () => NOW,
      windowMinutes: 120,
      emailer: async (to, subject) => {
        sent.push({ to, subject });
      },
    });

    expect(res.sent).toBe(0);
    expect(sent.length).toBe(0);
  });
});
