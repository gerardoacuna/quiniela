import { test, expect } from '@playwright/test';
import { createTestUser, signInWithPassword } from './helpers';
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import type { Database } from '../src/lib/types/database';

const STAGE_9_ID = '10000000-0000-4000-8000-000000000002';
const RIDER_POG = '20000000-0000-4000-8000-000000000001';

const admin = createSupabaseJs<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

test.describe('player picks', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  test.beforeAll(async () => {
    user = await createTestUser('player');
    // Make sure Stage 9 is upcoming so picks are allowed.
    await admin
      .from('stages')
      .update({
        start_time: new Date(Date.now() + 30 * 86400_000).toISOString(),
        status: 'upcoming',
      })
      .eq('id', STAGE_9_ID);
    // Remove any leftover pick by this brand-new user (shouldn't exist, but belt-and-suspenders).
    await admin.from('stage_picks').delete().eq('user_id', user.userId).eq('stage_id', STAGE_9_ID);
  });

  test.afterAll(async () => {
    await admin.from('stage_picks').delete().eq('user_id', user.userId);
    await user.cleanup();
  });

  test('sign-in → pick rider → reload shows same pick', async ({ page }) => {
    await signInWithPassword(page, user.email, user.password);

    // Navigate to the Stage 9 pick page.
    await page.goto('/picks/stage/9');

    // The rider picker shows "Tadej Pogačar" as a button (aria-label matches name).
    await page.getByRole('button', { name: /Pogačar/i }).click();

    // Click the Save pick button to persist the selection.
    await page.getByRole('button', { name: /Save pick/i }).click();

    // After the server action resolves, the "Current pick" banner appears.
    // The banner div contains both "Current pick:" and the rider name as sibling spans.
    await expect(page.getByText(/Current pick/i)).toBeVisible();
    await expect(page.getByText('Tadej Pogačar').first()).toBeVisible();

    // Reload and assert the pick persists (server re-renders with the saved rider).
    await page.reload();
    await expect(page.getByText(/Current pick/i)).toBeVisible();
    await expect(page.getByText('Tadej Pogačar').first()).toBeVisible();

    // Belt-and-suspenders: confirm the DB row exists.
    const { data } = await admin
      .from('stage_picks')
      .select('rider_id')
      .eq('user_id', user.userId)
      .eq('stage_id', STAGE_9_ID);
    expect(data?.[0]?.rider_id).toBe(RIDER_POG);
  });
});
