import { test, expect } from '@playwright/test';
import { createTestUser, signInWithPassword } from './helpers';
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import type { Database } from '../src/lib/types/database';

const EDITION = '00000000-0000-4000-8000-000000000001';
const STAGE_1_ID = '10000000-0000-4000-8000-000000000001';
const RIDER_POG = '20000000-0000-4000-8000-000000000001';
const RIDER_AYU = '20000000-0000-4000-8000-000000000002';
const RIDER_EVE = '20000000-0000-4000-8000-000000000003';

const admin = createSupabaseJs<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

test.describe('board pick reveal', () => {
  test.describe.configure({ mode: 'serial' });
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let other:  Awaited<ReturnType<typeof createTestUser>>;
  let originalStage1Start: string | null = null;
  let originalStage1Status:
    | 'upcoming'
    | 'locked'
    | 'results_draft'
    | 'published'
    | 'cancelled'
    | null = null;

  test.beforeAll(async () => {
    viewer = await createTestUser('player');
    other  = await createTestUser('player');

    // Capture stage 1's seeded start_time AND status so we can restore both.
    const { data } = await admin
      .from('stages')
      .select('start_time, status')
      .eq('id', STAGE_1_ID)
      .single();
    originalStage1Start = data?.start_time ?? null;
    originalStage1Status = data?.status ?? null;

    // Seed GC + jersey picks for both users.
    await admin.from('gc_picks').insert([
      { user_id: viewer.userId, edition_id: EDITION, position: 1, rider_id: RIDER_POG },
      { user_id: viewer.userId, edition_id: EDITION, position: 2, rider_id: RIDER_AYU },
      { user_id: viewer.userId, edition_id: EDITION, position: 3, rider_id: RIDER_EVE },
      { user_id: other.userId,  edition_id: EDITION, position: 1, rider_id: RIDER_AYU },
      { user_id: other.userId,  edition_id: EDITION, position: 2, rider_id: RIDER_POG },
      { user_id: other.userId,  edition_id: EDITION, position: 3, rider_id: RIDER_EVE },
    ]);
    await admin.from('jersey_picks').insert([
      { user_id: viewer.userId, edition_id: EDITION, kind: 'points', rider_id: RIDER_POG },
      { user_id: viewer.userId, edition_id: EDITION, kind: 'white',  rider_id: RIDER_EVE },
      { user_id: other.userId,  edition_id: EDITION, kind: 'points', rider_id: RIDER_AYU },
      // other has no white pick — partial-fill case
    ]);
  });

  test.afterAll(async () => {
    await admin.from('gc_picks').delete().in('user_id', [viewer.userId, other.userId]);
    await admin.from('jersey_picks').delete().in('user_id', [viewer.userId, other.userId]);
    await admin.from('stage_picks').delete().in('user_id', [viewer.userId, other.userId]);
    if (originalStage1Start && originalStage1Status) {
      await admin
        .from('stages')
        .update({
          start_time: originalStage1Start,
          status: originalStage1Status,
        })
        .eq('id', STAGE_1_ID);
    }
    await viewer.cleanup();
    await other.cleanup();
  });

  test('pre-lock: /board shows placeholder, no opponent picks visible', async ({ page }) => {
    // Push stage 1 to the future.
    await admin
      .from('stages')
      .update({ start_time: new Date(Date.now() + 86400_000).toISOString(), status: 'upcoming' })
      .eq('id', STAGE_1_ID);

    await signInWithPassword(page, viewer.email, viewer.password);
    await page.goto('/board');

    // The placeholder copy must include "of" and "players have locked in".
    await expect(page.getByText(/of \d+ players have locked in/).first()).toBeVisible();
    await expect(page.getByText(/Reveals at stage 1 start/).first()).toBeVisible();

    // Confirm the post-lock section headers "Locked in" are NOT shown. The
    // pre-lock placeholder says "players have locked in" (different string).
    // Use getByRole to match exact heading text, not substring matches.
    // The section title "Locked in" is rendered as a standalone div with that
    // exact text — use exact string match to avoid matching "players have locked in".
    await expect(page.getByText('Locked in', { exact: true })).toHaveCount(0);
  });

  test('post-lock: /board shows player-grouped + consensus rows for both users', async ({ page }) => {
    // Move stage 1 into the past.
    await admin
      .from('stages')
      .update({ start_time: new Date(Date.now() - 86400_000).toISOString(), status: 'locked' })
      .eq('id', STAGE_1_ID);

    await signInWithPassword(page, viewer.email, viewer.password);
    await page.goto('/board');

    // The "Locked in" eyebrow appears for both sections.
    await expect(page.getByText(/Locked in/i)).toHaveCount(2);

    // The other player's display name renders at least once.
    const otherSnippet = `E2E ${other.userId.slice(0, 6)}`;
    await expect(page.getByText(otherSnippet).first()).toBeVisible();

    // The viewer's own row reads "You".
    await expect(page.getByText('You').first()).toBeVisible();
  });

  test('post-lock: /stage/1 renders an underdog-tagged chip', async ({ page }) => {
    // Stage 1 is already in the past from the prior test. Insert a primary +
    // underdog stage_picks row for `other` directly — admin client bypasses
    // the post-lock write block.
    await admin.from('stage_picks').insert({
      user_id: other.userId,
      stage_id: STAGE_1_ID,
      rider_id: RIDER_POG,
      underdog_rider_id: RIDER_AYU,
    });

    await signInWithPassword(page, viewer.email, viewer.password);
    await page.goto('/stage/1');

    // The "underdog" tag text appears at least once on the page.
    await expect(page.getByText('· underdog').first()).toBeVisible();
  });
});
