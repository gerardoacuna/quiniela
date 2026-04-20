import { test, expect } from '@playwright/test';
import { createTestUser, signInWithPassword } from './helpers';
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import type { Database } from '../src/lib/types/database';

const STAGE_9_ID = '10000000-0000-4000-8000-000000000002';
const R_POG = '20000000-0000-4000-8000-000000000001';
const R_AYU = '20000000-0000-4000-8000-000000000002';
const R_EVE = '20000000-0000-4000-8000-000000000003';

const admin = createSupabaseJs<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

test.describe('admin publish stage', () => {
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let player: Awaited<ReturnType<typeof createTestUser>>;

  test.beforeAll(async () => {
    adminUser = await createTestUser('admin');
    player = await createTestUser('player');

    // Player picks Pogacar on Stage 9 via admin client (bypass RLS for setup speed).
    await admin
      .from('stages')
      .update({
        start_time: new Date(Date.now() - 3600_000).toISOString(), // 1h ago, so publish is valid
        status: 'upcoming',
      })
      .eq('id', STAGE_9_ID);
    await admin.from('stage_picks').delete().eq('user_id', player.userId).eq('stage_id', STAGE_9_ID);
    await admin.from('stage_picks').insert({
      user_id: player.userId,
      stage_id: STAGE_9_ID,
      rider_id: R_POG,
    });
    await admin.from('stage_results').delete().eq('stage_id', STAGE_9_ID);
  });

  test.afterAll(async () => {
    await admin.from('stage_results').delete().eq('stage_id', STAGE_9_ID);
    await admin.from('stage_picks').delete().eq('stage_id', STAGE_9_ID);
    await admin
      .from('stages')
      .update({
        start_time: '2026-05-17T12:00:00Z',
        status: 'upcoming',
      })
      .eq('id', STAGE_9_ID);
    await player.cleanup();
    await adminUser.cleanup();
  });

  test('publish Stage 9 top 3 → player scores 50 (double pts × 25)', async ({ page }) => {
    await signInWithPassword(page, adminUser.email, adminUser.password);

    await page.goto('/admin/stages/9');

    // The stage form has select elements with aria-label="Position N".
    // Use selectOption to pick from the native <select> dropdown by rider UUID (the option value).
    await page.getByLabel('Position 1', { exact: true }).selectOption(R_POG);
    await page.getByLabel('Position 2', { exact: true }).selectOption(R_AYU);
    await page.getByLabel('Position 3', { exact: true }).selectOption(R_EVE);

    await page.getByRole('button', { name: /Publish/i }).click();

    // After publishing, the form shows "Results published."
    await expect(page.getByText(/published/i).first()).toBeVisible();

    // Switch accounts: sign in as the player and check the leaderboard.
    await page.context().clearCookies();
    await signInWithPassword(page, player.email, player.password);
    await page.goto('/home');

    // The leaderboard should show 50 points (Pogačar at position 1, Stage 9 is 2×).
    await expect(page.getByText(/50/).first()).toBeVisible();
  });
});
