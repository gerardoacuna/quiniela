# Plan D — Deploy, PWA, E2E, CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the remaining deferred work from Plans A-C: carry-over hygiene, Playwright E2E smoke, GitHub Actions CI, PWA (manifest + service worker), and production Vercel deploy with custom domain.

**Architecture:** Code changes are small and surgical. The heavy lifting is in wiring external systems: GitHub Actions (already tracked in git), Serwist for PWA, Playwright for mobile E2E, and Vercel Marketplace for the Supabase production link. Each subsystem ships in its own phase and can be verified independently.

**Tech Stack:** GitHub Actions · Playwright 1.59+ (already installed) · @serwist/next 9+ · Vercel + Supabase Marketplace · Next.js 16 App Router (existing).

---

## Scope and non-goals

**In scope:**
- Three Plan C carry-over items (review gaps + micro-cleanup)
- CI pipeline (typecheck, lint, unit, integration, build)
- Two mobile E2E smoke tests
- PWA (manifest, icons, service worker)
- Vercel production project + env vars + custom domain
- Pre-race operational checklist

**Out of scope (do NOT expand into these):**
- New product features (no push notifications, no social feed, no native apps)
- Multi-edition support beyond what the schema already allows
- Horizontal scaling / caching layers
- Additional email providers beyond Resend + Supabase SMTP
- Analytics or observability beyond what Vercel + Supabase already give us

---

## File structure

Files created in this plan:

```
.github/
  workflows/
    ci.yml                            # single CI workflow
e2e/
  helpers.ts                          # test user factory, sign-in helper
  player-pick.spec.ts                 # sign-in + pick + reload
  admin-publish.spec.ts               # publish stage → leaderboard
public/
  manifest.webmanifest
  icon-192.png
  icon-512.png
  apple-touch-icon.png
src/app/
  layout.tsx                          # MODIFY: link manifest + theme-color
  offline/
    page.tsx                          # offline fallback route
src/app/sw.ts                         # Serwist service worker entry
next.config.ts                        # MODIFY: wrap with Serwist
docs/
  pre-race-checklist.md               # operational runbook
```

Files modified:

- `src/lib/supabase/admin.ts` — fix `'server-only'` bare literal
- `src/lib/cron/scrape.ts` — surface notifyAdmins failure as scrape_error
- `src/test/integration/cron-reminders.test.ts` — concurrent-run test
- `package.json` — add `e2e`, `e2e:headed`, `db:migrate:prod` scripts; add @serwist/next dep
- `README.md` — production deploy + PWA notes (only if it exists; otherwise create)

Files touched ONLY during Phase 4 user-driven deploy:

- Vercel dashboard: project settings, env vars, domain
- Supabase dashboard: prod project, site URL whitelist, SMTP config (if not using Resend)
- DNS: CNAME / A record for custom domain

---

## Phase 0 — Plan C carry-over

### Task D-0.1: Fix `'server-only'` bare literal

**Files:**
- Modify: `src/lib/supabase/admin.ts:1`

**Context:** Line 1 currently reads `'server-only'` as a bare string expression statement. That's a no-op — it doesn't import the module, and the build wouldn't catch it if this file got bundled into a client component tree. It should be `import 'server-only'` (same pattern used by every other server-only module in the repo).

- [ ] **Step 1: Edit the file**

Change `src/lib/supabase/admin.ts` line 1 from:

```ts
'server-only'
```

to:

```ts
import 'server-only';
```

- [ ] **Step 2: Verify nothing imports it from a client component**

```bash
grep -rn "from '@/lib/supabase/admin'" src/app/ | cat
```

Expected: zero results from any `'use client'` file. All hits should be in server components, server actions, route handlers, or `server-only` modules under `src/lib/`.

- [ ] **Step 3: Run full typecheck + lint + unit + integration suite**

```bash
npm run typecheck
npm run lint
npx vitest run --reporter=dot
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot
```

All green. If any client file now errors because it accidentally imports a server-only module, that's the fix landing correctly — remove the import from the client tree instead of reverting this change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/admin.ts
git commit -m "fix(supabase): import 'server-only' module so bundler catches client leaks"
```

---

### Task D-0.2: Surface notifyAdmins email failure as scrape_error

**Files:**
- Modify: `src/lib/cron/scrape.ts` (`notifyAdmins` helper)

**Context:** `notifyAdmins` currently swallows every email error inside its inner `try/catch`. A broken SMTP config or expired Resend key is invisible — the dashboard shows nothing, admins never hear about stage drafts. Fix: when every admin email attempt fails, write a `scrape_errors` row so the `/admin/errors` page surfaces the breakage.

- [ ] **Step 1: Edit `notifyAdmins` in `src/lib/cron/scrape.ts`**

Find the current helper (search for `async function notifyAdmins`). Replace its body with:

```ts
async function notifyAdmins(
  supabase: ReturnType<typeof createAdminClient>,
  stageNumber: number,
  emailer?: (to: string, subject: string, text: string) => Promise<void>,
): Promise<void> {
  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .is('deleted_at', null);

  const recipients = (admins ?? []).filter((a) => a.email).map((a) => a.email!);
  if (recipients.length === 0) return;

  const site = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const tpl = stageDraftReady(stageNumber, `${site}/admin/stages/${stageNumber}`);

  const results = await Promise.allSettled(
    recipients.map(async (to) => {
      if (emailer) await emailer(to, tpl.subject, tpl.text);
      else await sendEmail({ to, subject: tpl.subject, text: tpl.text });
    }),
  );

  const failures = results
    .map((r, i) => ({ r, to: recipients[i] }))
    .filter((x): x is { r: PromiseRejectedResult; to: string } => x.r.status === 'rejected');

  if (failures.length === 0) return;

  // If EVERY recipient failed, the email adapter itself is broken — surface it.
  // Partial failures are logged but we don't insert a scrape_error because the draft
  // itself landed fine and at least one admin was notified.
  if (failures.length === recipients.length) {
    const msg = failures[0].r.reason instanceof Error
      ? failures[0].r.reason.message
      : String(failures[0].r.reason);
    await supabase.from('scrape_errors').insert({
      target: `notify-admins-stage-${stageNumber}`,
      error: `all_admin_emails_failed: ${msg}`,
    });
  }
}
```

- [ ] **Step 2: Write an integration test for the all-fail path**

Append to `src/test/integration/cron-scrape.test.ts` (before the final `});` that closes `d('scrapeAndPersist integration', ...)`):

```ts
  it('writes scrape_error when all admin notification emails fail', async () => {
    const admin = createAdminClient();

    // Prime riders so the stage-1 scrape branch runs (emails fire on success).
    await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T11:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
    });

    await setStageState(STAGE_1_ID, {
      start_time: '2026-05-09T12:00:00Z',
      status: 'upcoming',
    });

    const { count: before } = await admin
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true });

    const failingEmailer = async () => {
      throw new Error('smtp_down');
    };

    const res = await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
      emailer: failingEmailer,
    });

    // The stage-1 scrape target itself still succeeds (email failure is non-fatal).
    expect(res.targets.some((t) => t.target === 'stage-1' && t.status === 'ok')).toBe(true);

    const { data: errs } = await admin
      .from('scrape_errors')
      .select('target, error')
      .order('run_at', { ascending: false })
      .limit(5);
    expect(errs?.some((e) => e.target === 'notify-admins-stage-1')).toBe(true);

    const { count: after } = await admin
      .from('scrape_errors')
      .select('id', { count: 'exact', head: true });
    expect(after).toBeGreaterThan(before ?? 0);
  });
```

- [ ] **Step 3: Run integration test**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/cron-scrape.test.ts --reporter=dot
```

Expected: 5 passed (4 prior + 1 new).

- [ ] **Step 4: Commit**

```bash
git add src/lib/cron/scrape.ts src/test/integration/cron-scrape.test.ts
git commit -m "feat(cron): surface notify-admins email failure as scrape_error"
```

---

### Task D-0.3: Concurrent reminder overlap test

**Files:**
- Modify: `src/test/integration/cron-reminders.test.ts`

**Context:** The existing dedup test runs two reminder passes sequentially. We also want coverage for the Vercel at-least-once case where two runs fire in parallel. The claim-then-email refactor from Plan C fix #2 should mean exactly one of the two races sends the email per user.

- [ ] **Step 1: Append the concurrent test**

Insert this test inside the `d('sendPickReminders integration', ...)` block, after the rollback test and before the "does not send when stage is outside..." test:

```ts
  it('concurrent runs send exactly once per user', async () => {
    await setStageState(STAGE_9_ID, { start_time: IN_WINDOW, status: 'upcoming' });

    const sent: { to: string; subject: string }[] = [];
    const emailer = async (to: string, subject: string) => {
      sent.push({ to, subject });
    };

    // Fire two runs in parallel. The claim-then-email pattern must ensure the
    // losing run sees the PK conflict, gets an empty upsert result, and skips.
    const [a, b] = await Promise.all([
      sendPickReminders({ now: () => NOW, windowMinutes: 120, emailer }),
      sendPickReminders({ now: () => NOW, windowMinutes: 120, emailer }),
    ]);

    const totalSent = a.sent + b.sent;
    // At least one run sent to userA.
    expect(totalSent).toBeGreaterThanOrEqual(1);
    // No user was emailed twice.
    const emailCounts = sent.reduce<Record<string, number>>((acc, e) => {
      acc[e.to] = (acc[e.to] ?? 0) + 1;
      return acc;
    }, {});
    for (const to of Object.keys(emailCounts)) {
      expect(emailCounts[to]).toBe(1);
    }
    // And the total emails matches total claimed sends.
    expect(sent.length).toBe(totalSent);
  });
```

- [ ] **Step 2: Run it**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/cron-reminders.test.ts --reporter=dot
```

Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add src/test/integration/cron-reminders.test.ts
git commit -m "test(cron): verify concurrent reminder runs send exactly once per user"
```

---

## Phase 1 — CI

### Task D-1.1: Basic CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Context:** Every PR and every push to `main` runs: typecheck, lint, unit tests, build. Integration tests live in a separate job that boots local Supabase — that job is slower but essential. Node 24, pnpm or npm (we're using npm because `package-lock.json` is committed). Caches node_modules via actions/setup-node's built-in npm cache.

- [ ] **Step 1: Create the workflow**

Write `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: typecheck, lint, unit, build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npx vitest run --reporter=dot

      - name: Build
        run: npm run build
        env:
          # Build only needs placeholder values; no runtime Supabase calls during build.
          NEXT_PUBLIC_SUPABASE_URL: https://build-placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          SUPABASE_SERVICE_ROLE_KEY: placeholder
          CRON_SECRET: placeholder

  integration:
    name: integration tests (local supabase)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Install dependencies
        run: npm ci

      - name: Start local Supabase
        run: supabase start

      - name: Load Supabase env into .env.local
        run: |
          URL=$(supabase status --output json | jq -r '.API_URL')
          ANON=$(supabase status --output json | jq -r '.ANON_KEY')
          SERVICE=$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY')
          cat > .env.local <<EOF
          NEXT_PUBLIC_SUPABASE_URL=$URL
          NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
          SUPABASE_SERVICE_ROLE_KEY=$SERVICE
          CRON_SECRET=ci-placeholder-secret
          NEXT_PUBLIC_APP_URL=http://localhost:3000
          SUPABASE_SMTP_HOST=127.0.0.1
          SUPABASE_SMTP_PORT=54325
          EOF

      - name: Run integration tests
        run: SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

- [ ] **Step 2: Verify locally that `npm run build` works with placeholder envs**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
SUPABASE_SERVICE_ROLE_KEY=placeholder \
CRON_SECRET=placeholder \
npm run build
```

Expected: build completes. If the build fails on a placeholder URL, fix the call site — our code should only resolve Supabase at request time, not at build time.

- [ ] **Step 3: Commit and push to trigger the workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck + lint + unit + build + integration workflow"
git push origin main
```

- [ ] **Step 4: Watch the first CI run**

```bash
gh run list --limit 3
gh run watch
```

Expected: both jobs green. If `integration` fails with a supabase-start timeout, check the `supabase/setup-cli@v1` action version and Supabase's current local-dev minimum requirements.

---

### Task D-1.2: Require CI on main branch protection

**Files:** none (GitHub settings)

**Context:** CI is useless if a broken PR can merge. Lock `main` behind a passing CI.

- [ ] **Step 1: Enable branch protection**

Via web UI (Settings → Branches → Branch protection rules → Add rule for `main`), or via gh:

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]='typecheck, lint, unit, build' \
  -f required_status_checks[contexts][]='integration tests (local supabase)' \
  -f enforce_admins=false \
  -f required_pull_request_reviews[required_approving_review_count]=0 \
  -f restrictions=
```

If the API form trips on required fields, set it in the UI. The critical outcome: both CI jobs are "required" checks.

- [ ] **Step 2: Verify by opening a throwaway PR**

Create a branch with a deliberate typecheck error, push, open a PR, confirm the Merge button is greyed out until the branch is fixed or deleted. Then close the throwaway PR.

---

## Phase 2 — Playwright E2E

### Task D-2.1: E2E helpers (sign-in shortcut)

**Files:**
- Create: `e2e/helpers.ts`

**Context:** Magic-link auth is great for production but miserable for deterministic E2E. Supabase supports password login for users created via the admin API, so our E2E helper creates a test user with a known password, then signs in via `signInWithPassword` from the Playwright page. The test lifecycle cleans the user up after.

The helpers live alongside `playwright.config.ts` (Playwright's default testDir is `./e2e`). They reuse the service-role key to provision/destroy users.

- [ ] **Step 1: Create `e2e/helpers.ts`**

```ts
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import { Page } from '@playwright/test';
import type { Database } from '../src/lib/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  throw new Error('E2E helpers require Supabase env vars (see .env.local).');
}

const admin = createSupabaseJs<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  cleanup: () => Promise<void>;
}

export async function createTestUser(role: 'player' | 'admin' = 'player'): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'e2e-password-12345';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('no user created');

  await admin.from('profiles').insert({
    id: data.user.id,
    display_name: `E2E ${data.user.id.slice(0, 6)}`,
    role,
    email,
  });

  return {
    userId: data.user.id,
    email,
    password,
    cleanup: async () => {
      await admin.from('profiles').delete().eq('id', data.user!.id);
      await admin.auth.admin.deleteUser(data.user!.id);
    },
  };
}

/** Sign the given user in via the browser page using password auth. */
export async function signInWithPassword(page: Page, email: string, password: string) {
  // Inject a session by calling signInWithPassword directly against Supabase, then
  // setting the returned tokens as cookies the same way @supabase/ssr expects.
  const response = await page.request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey!, 'Content-Type': 'application/json' },
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`signInWithPassword failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();

  // Two cookies: sb-<project-ref>-auth-token and refresh-token. The project ref
  // is the subdomain of SUPABASE_URL (http://127.0.0.1:54321 → '127').
  const projectRef = new URL(url!).hostname.split('.')[0] || 'local';
  const cookieValue = encodeURIComponent(
    JSON.stringify({ access_token: body.access_token, refresh_token: body.refresh_token }),
  );

  await page.context().addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    },
  ]);
}
```

- [ ] **Step 2: Verify helpers compile and import cleanly**

```bash
npx tsc --noEmit e2e/helpers.ts
```

Expected: no errors. (`tsc --noEmit` on a single file honours `tsconfig.json`; if it complains about missing types for Playwright, add `"include": ["e2e/**/*.ts"]` to `tsconfig.json` under `include`.)

- [ ] **Step 3: Do not commit yet**

This file is half the story; commit after the two specs land.

---

### Task D-2.2: E2E test — player sign-in + pick + reload

**Files:**
- Create: `e2e/player-pick.spec.ts`

**Context:** Covers spec §8.3 requirement #1: "sign in → pick a rider → reload → pick persists." Uses the Pixel 7 device project from `playwright.config.ts`. Runs against a dev server the test spawns via `webServer` config (we'll add that in a follow-up step if not present).

- [ ] **Step 1: Add `webServer` to `playwright.config.ts`**

Replace the file contents with:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,                // E2E shares one DB; keep serial
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium-mobile', use: { ...devices['Pixel 7'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
```

- [ ] **Step 2: Create `e2e/player-pick.spec.ts`**

```ts
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

    // The picker shows "Tadej Pogačar" — click it.
    await page.getByRole('button', { name: /Pogačar/i }).click();

    // Wait for the confirm/save interaction. The form uses useActionState; after
    // submit the page re-renders with a "Current pick" section.
    await expect(page.getByText(/Current pick/i)).toBeVisible();
    await expect(page.getByText(/Pogačar/i)).toBeVisible();

    // Reload and assert the pick persists.
    await page.reload();
    await expect(page.getByText(/Current pick/i)).toBeVisible();
    await expect(page.getByText(/Pogačar/i)).toBeVisible();

    // Belt-and-suspenders: confirm the DB row exists.
    const { data } = await admin
      .from('stage_picks')
      .select('rider_id')
      .eq('user_id', user.userId)
      .eq('stage_id', STAGE_9_ID);
    expect(data?.[0]?.rider_id).toBe(RIDER_POG);
  });
});
```

- [ ] **Step 3: Run E2E locally**

```bash
npx playwright install chromium
npx playwright test e2e/player-pick.spec.ts --project=chromium-mobile
```

Expected: 1 passed. If the selector `button, name: /Pogačar/` misses, inspect the real rider picker UI and update accordingly — do not bypass by using CSS/test IDs when role+name works.

- [ ] **Step 4: Do not commit yet**

---

### Task D-2.3: E2E test — admin publish → leaderboard

**Files:**
- Create: `e2e/admin-publish.spec.ts`

**Context:** Covers spec §8.3 requirement #2: "publish a stage with stubbed data → leaderboard shows expected points." The test seeds a player pick via the admin client, then logs in as a second (admin) user, navigates to `/admin/stages/9`, fills the top 3, clicks Publish, and asserts the leaderboard on `/` shows the expected 25 points (or 50 if Stage 9 is double-points per seed).

- [ ] **Step 1: Create the spec**

```ts
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

    // The stage form has 3+ slots; fill positions 1/2/3 with Pog/Ayu/Eve.
    // Use the rider name text visible in the existing picker component.
    await page.getByLabel(/position 1/i).click();
    await page.getByRole('option', { name: /Pogačar/i }).click();
    await page.getByLabel(/position 2/i).click();
    await page.getByRole('option', { name: /Ayuso/i }).click();
    await page.getByLabel(/position 3/i).click();
    await page.getByRole('option', { name: /Evenepoel/i }).click();

    await page.getByRole('button', { name: /Publish/i }).click();

    await expect(page.getByText(/published/i).first()).toBeVisible();

    // Switch accounts: sign in as the player and check the leaderboard.
    await page.context().clearCookies();
    await signInWithPassword(page, player.email, player.password);
    await page.goto('/');

    // The leaderboard should show 50 points (Pogačar at position 1, Stage 9 is 2×).
    await expect(page.getByText(/50/).first()).toBeVisible();
  });
});
```

> If the rider picker in `src/app/admin/stages/[stageNumber]/form.tsx` doesn't use `<label>` + `<combobox>` roles, inspect the live DOM and adjust the selectors. The test should still use role+name queries, not brittle CSS. If the picker is a non-standard widget, add `aria-label` props to the form fields during this task rather than reaching for test IDs.

- [ ] **Step 2: Run**

```bash
npx playwright test e2e/admin-publish.spec.ts --project=chromium-mobile
```

Expected: 1 passed. If the admin form fields don't match, pause and adjust the form (adding aria-labels) — this reveals a genuine accessibility gap.

- [ ] **Step 3: Add scripts + commit all E2E work**

Append to `package.json` scripts:

```json
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed",
    "e2e:install": "playwright install chromium"
```

Commit everything:

```bash
git add e2e/ playwright.config.ts package.json package-lock.json
git commit -m "test(e2e): playwright smoke for player pick round-trip and admin publish"
```

---

### Task D-2.4: Wire E2E into CI (optional gate)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Context:** E2E tests are slow (dev server startup + browser). Add them as a third job that runs in parallel with the others. If they prove flaky we can gate them to `workflow_dispatch` only; default is every PR.

- [ ] **Step 1: Append the `e2e` job**

Add after the `integration` job in `.github/workflows/ci.yml`:

```yaml
  e2e:
    name: playwright smoke
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Start local Supabase
        run: supabase start

      - name: Prepare env
        run: |
          URL=$(supabase status --output json | jq -r '.API_URL')
          ANON=$(supabase status --output json | jq -r '.ANON_KEY')
          SERVICE=$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY')
          cat > .env.local <<EOF
          NEXT_PUBLIC_SUPABASE_URL=$URL
          NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
          SUPABASE_SERVICE_ROLE_KEY=$SERVICE
          CRON_SECRET=ci-e2e-secret
          NEXT_PUBLIC_APP_URL=http://localhost:3000
          EOF

      - name: Run E2E
        run: npx playwright test --project=chromium-mobile

      - name: Stop Supabase
        if: always()
        run: supabase stop

      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add playwright e2e job running against local supabase"
```

- [ ] **Step 3: Push + watch**

```bash
git push origin main
gh run watch
```

Expected: all three jobs green. If e2e times out on webServer boot, lengthen `webServer.timeout` in `playwright.config.ts` to 180_000.

---

## Phase 3 — PWA

### Task D-3.1: Manifest + icons

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

**Context:** Minimal PWA manifest. Short name, theme matches the shadcn dark-blue default (`#020617`). Icons generated once — any square PNG will do for v1; we can polish the art later. Apple-touch-icon is 180×180.

- [ ] **Step 1: Write the manifest**

```json
{
  "name": "Quiniela Giro",
  "short_name": "Quiniela",
  "description": "Private Giro d'Italia pickem game",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#020617",
  "theme_color": "#020617",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Save to `public/manifest.webmanifest`.

- [ ] **Step 2: Generate placeholder icons**

Fastest path: use ImageMagick with a filled square + centered text. Run:

```bash
magick -size 512x512 xc:'#020617' \
  -fill white -gravity center -pointsize 220 -annotate 0 'QG' \
  public/icon-512.png
magick public/icon-512.png -resize 192x192 public/icon-192.png
magick public/icon-512.png -resize 180x180 public/apple-touch-icon.png
```

If ImageMagick is unavailable, any three square PNGs at the correct sizes work. Do not ship placeholder `.gitkeep` or empty files.

- [ ] **Step 3: Verify icons load**

```bash
npm run dev
# visit http://localhost:3000/icon-192.png in a browser → image renders
# visit http://localhost:3000/manifest.webmanifest → JSON displays
```

- [ ] **Step 4: Commit**

```bash
git add public/manifest.webmanifest public/icon-192.png public/icon-512.png public/apple-touch-icon.png
git commit -m "feat(pwa): add web app manifest and icons"
```

---

### Task D-3.2: Wire manifest + theme-color in root layout

**Files:**
- Modify: `src/app/layout.tsx`

**Context:** Next.js 16 App Router reads PWA metadata from the exported `metadata` and `viewport` objects. `manifest` goes in `metadata`; `themeColor` goes in `viewport`.

- [ ] **Step 1: Read the current layout**

```bash
sed -n '1,40p' src/app/layout.tsx
```

- [ ] **Step 2: Add manifest + theme-color to the exported metadata**

In `src/app/layout.tsx`, ensure the exports include:

```ts
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  // ...existing fields (title, description)...
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Quiniela',
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
};
```

If the file already has `metadata` or `viewport` exports, merge — don't overwrite unrelated fields.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds. Next's Metadata API warns if `themeColor` is in the wrong export — heed any warning.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(pwa): link manifest, apple-touch icon, theme color from root layout"
```

---

### Task D-3.3: Service worker via Serwist

**Files:**
- Modify: `package.json` (add dep)
- Create: `src/app/sw.ts`
- Modify: `next.config.ts`
- Create: `src/app/offline/page.tsx`

**Context:** Serwist is the Next.js 16-compatible successor to next-pwa. It runs at build time, compiles `src/app/sw.ts` into a `/sw.js` artifact in `public/`, and registers it on the client. No offline picks per spec §6.3 — we cache static assets only, and serve an offline fallback page when the user is completely disconnected.

- [ ] **Step 1: Install Serwist**

```bash
npm install -D serwist @serwist/next
```

- [ ] **Step 2: Create the service worker entry**

Write `src/app/sw.ts`:

```ts
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
import type { SerwistGlobalConfig, PrecacheEntry } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
```

- [ ] **Step 3: Wrap `next.config.ts` with Serwist**

Read the current config:

```bash
cat next.config.ts
```

Then replace with (merging any existing settings):

```ts
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  // ...merge existing config here
};

export default withSerwist(nextConfig);
```

If `next.config.ts` doesn't exist (Next.js 16 still supports `.js`), create it with only the Serwist wrapper plus a bare `NextConfig = {}`.

- [ ] **Step 4: Create the offline fallback page**

Write `src/app/offline/page.tsx`:

```tsx
export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          Reconnect to check the leaderboard or submit a pick. Picks aren&apos;t available offline.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Build + manually verify service worker artefact**

```bash
npm run build
ls -la public/sw.js
```

Expected: `public/sw.js` exists and is ≤ a few KB (source-mapped precache manifest is small for our asset set).

- [ ] **Step 6: Smoke test with production build**

```bash
npm run build && npm start &
sleep 3
curl -sf http://localhost:3000/sw.js | head -5
curl -sf http://localhost:3000/offline | grep -q "You"
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add src/app/sw.ts src/app/offline/page.tsx next.config.ts package.json package-lock.json
git commit -m "feat(pwa): add serwist service worker with static-asset cache and offline fallback"
```

---

### Task D-3.4: Manual install-prompt smoke (mobile)

**Files:** none

**Context:** Only a real device (or Chrome DevTools' Lighthouse PWA audit) can tell us whether the install prompt fires. This is the only manual step in Plan D before prod deploy.

- [ ] **Step 1: Boot prod build**

```bash
npm run build && npm start
```

- [ ] **Step 2: Chrome DevTools → Lighthouse → PWA audit**

On `http://localhost:3000`, run the PWA audit. Expected: "Installable" passes. If any check fails (manifest missing fields, sw not reached, icons not resolvable), fix the underlying issue — do not bypass.

- [ ] **Step 3: Optional — real mobile install**

On an iPhone or Android device connected to the same network, visit `http://<dev-host>:3000`. On Android Chrome, the install prompt appears after interaction. On iOS Safari, Share → Add to Home Screen uses the manifest icons.

- [ ] **Step 4: Note any cosmetic issues** in `docs/pre-race-checklist.md` (created in Phase 5). No code change here unless something's actually broken.

---

## Phase 4 — Production deploy

> Phase 4 is USER-DRIVEN through dashboards. Each task lists the exact steps and what to verify. No code changes except where noted.

### Task D-4.1: Supabase production project

**Files:** none (dashboard work)

**Context:** Create a managed Supabase project so prod has its own Postgres + Auth + SMTP. Provisioning via the Vercel Marketplace integration auto-syncs the key env vars into the Vercel project, which is the happy path we'll use in D-4.3.

- [ ] **Step 1: Install Supabase via Vercel Marketplace**

- Go to https://vercel.com/marketplace → search "Supabase" → Install.
- Pick the team + project you'll create in D-4.2 (or create a new one there).
- Region: pick the one closest to your 34 users. For Mexico/LATAM, `us-east-1` is usually fine.
- Project name: `quiniela-prod`.
- Save the **database password** somewhere secure (1Password) — you can't recover it.

- [ ] **Step 2: Push migrations to prod**

Get the project ref (from the Supabase dashboard URL: `https://supabase.com/dashboard/project/<REF>`). Then:

```bash
npx supabase link --project-ref <REF>
# Will prompt for the database password from Step 1.
npx supabase db push
```

Expected: all migrations in `supabase/migrations/` apply cleanly.

- [ ] **Step 3: Do NOT push seed.sql**

`supabase/seed.sql` contains dev fixtures (dev-admin, dev-player, 5 riders, Giro 2026 edition with 3 stages). We want those dev rows in local dev only. Production should start empty, then have a real edition seeded through the admin UI (or a dedicated prod seed script, deferred).

If you DO want a minimal prod seed (just the edition + admin profile), write it as a one-shot SQL snippet to paste into the Supabase SQL editor rather than committing it to `seed.sql`.

- [ ] **Step 4: Verify**

In the Supabase dashboard → SQL editor:

```sql
select count(*) from public.profiles;  -- 0
select table_name from information_schema.tables where table_schema = 'public';
-- expect: editions, stages, riders, stage_picks, gc_picks, points_jersey_picks,
--         stage_results, final_classifications, invites, audit_log,
--         scrape_errors, pick_reminders_sent, cron_runs, profiles, leaderboard_view
```

---

### Task D-4.2: Vercel project

**Files:** none (dashboard work — unless you add `package.json` > `engines`, see below)

**Context:** Link the GitHub repo to Vercel. Framework detection picks up Next.js 16 automatically. Production builds on pushes to `main`; preview builds per PR.

- [ ] **Step 1: Create the Vercel project**

- Dashboard → Add New → Project → Import `quiniela` repo.
- Framework Preset: Next.js (auto-detected).
- Root Directory: `./`.
- Build Command: `next build` (default).
- Output Directory: `.next` (default).
- Install Command: `npm ci` (default).

- [ ] **Step 2: Pin Node version (optional but recommended)**

Add to `package.json`:

```json
  "engines": {
    "node": ">=24.0.0"
  }
```

Commit:

```bash
git add package.json
git commit -m "chore: pin node >=24 to match vercel fluid-compute default"
```

- [ ] **Step 3: Verify preview deployment**

Push any no-op change or open a draft PR. Confirm Vercel builds a preview URL. Visit it — expect the sign-in page to render. (Sign-in won't work yet because the Supabase env vars aren't set; that's D-4.3.)

---

### Task D-4.3: Production env vars

**Files:** none (Vercel dashboard)

**Context:** The Supabase Marketplace integration already wrote `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a few others into the Vercel project. We need to add the rest by hand.

- [ ] **Step 1: Generate a strong `CRON_SECRET`**

```bash
openssl rand -hex 32
```

Copy the output.

- [ ] **Step 2: Add env vars via Vercel dashboard**

Settings → Environment Variables. Add each for **Production** scope (and also Preview if you want previews to be fully functional):

| Key | Value | Notes |
|---|---|---|
| `CRON_SECRET` | (from Step 1) | Vercel Cron sends this as the Authorization header automatically |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` | Use the real domain from D-4.4; for now, use the Vercel URL |
| `RESEND_API_KEY` | (from resend.com) | If using Resend; otherwise leave unset and Supabase SMTP fallback is used |
| `EMAIL_FROM` | `Quiniela <no-reply@yourdomain.com>` | Must match a verified Resend sender |
| `PCS_USER_AGENT` | `QuinielaScraper/1.0 (+mailto:you@yourdomain.com)` | Identifying UA for PCS scraping etiquette |

- [ ] **Step 3: Or via CLI**

```bash
vercel env add CRON_SECRET production
# paste the secret when prompted
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production
vercel env add PCS_USER_AGENT production
```

- [ ] **Step 4: Redeploy with fresh env**

```bash
vercel --prod
```

Or push any commit to `main`.

---

### Task D-4.4: Custom domain

**Files:** none (DNS + Vercel dashboard)

**Context:** Point your domain at the Vercel project. Vercel provisions Let's Encrypt automatically.

- [ ] **Step 1: Add domain in Vercel**

Settings → Domains → Add. Enter `quiniela.yourdomain.com` (or whatever you own).

- [ ] **Step 2: Create DNS record**

Follow Vercel's prompt — usually a `CNAME` pointing at `cname.vercel-dns.com`. Apex domains need an `A 76.76.21.21` instead (or use Vercel's DNS).

- [ ] **Step 3: Wait for issuance (usually <2 min)**

`curl -sI https://quiniela.yourdomain.com` should return 200 and a valid cert.

- [ ] **Step 4: Update `NEXT_PUBLIC_APP_URL` to the real domain**

If you used the `*.vercel.app` URL earlier, update the env var now and redeploy.

---

### Task D-4.5: Supabase auth redirect whitelist

**Files:** none (Supabase dashboard)

**Context:** Magic-link sign-ins redirect to `/auth/callback` on your domain. Supabase rejects URLs not explicitly whitelisted. Our local setup already lists `localhost:3000` and `127.0.0.1:3000`; we need to add the prod domain.

- [ ] **Step 1: Dashboard → Authentication → URL Configuration**

- Site URL: `https://quiniela.yourdomain.com`
- Redirect URLs (additional): `https://quiniela.yourdomain.com/auth/callback`

Save.

- [ ] **Step 2: Verify**

Open an incognito window, hit `https://quiniela.yourdomain.com/sign-in`, enter your email, click the link in your inbox. You should land on `/` signed in. If you land on `?error=invalid_redirect_url`, the whitelist is wrong — fix and retry.

---

### Task D-4.6: Create first admin + production smoke

**Files:** none (Supabase SQL editor + manual test)

**Context:** Plan B's invite flow requires an admin to generate invites. The very first admin has no predecessor, so we bootstrap by flipping a profile row manually.

- [ ] **Step 1: Sign in as yourself**

Use the production app's `/sign-in` flow. This creates an `auth.users` row.

- [ ] **Step 2: Promote to admin via SQL**

In Supabase dashboard → SQL editor:

```sql
update public.profiles
   set role = 'admin'
 where email = 'you@yourdomain.com';
```

- [ ] **Step 3: Seed the first edition**

In the admin UI (`/admin/edition`), create the active edition OR run SQL:

```sql
insert into public.editions (slug, name, start_date, end_date, is_active)
values ('giro-2026', 'Giro d''Italia 2026', '2026-05-09', '2026-05-31', true);
```

Add stages by hand (or via the admin page when you build it), or via SQL. The admin UI already supports flipping `counts_for_scoring` / `double_points` per stage.

- [ ] **Step 4: Smoke the crons**

```bash
curl -H "Authorization: Bearer <CRON_SECRET from Vercel>" \
  https://quiniela.yourdomain.com/api/cron/scrape-pcs | jq
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://quiniela.yourdomain.com/api/cron/send-reminders | jq
```

Expected: 200 responses with JSON summaries. The scrape may hit Cloudflare on PCS and record errors in `scrape_errors` — visit `/admin/errors` to confirm the dashboard surfaces them. That's expected behavior outside the Giro window; the scrape runs for real starting 2026-05-09.

- [ ] **Step 5: Verify Vercel's automatic cron is live**

Vercel dashboard → project → Crons. Both `/api/cron/scrape-pcs` (`*/15 * * * *`) and `/api/cron/send-reminders` (`0 * * * *`) are listed. The first firing happens on the next quarter-hour.

---

## Phase 5 — Pre-race checklist + final sanity

### Task D-5.1: Pre-race operational checklist

**Files:**
- Create: `docs/pre-race-checklist.md`

**Context:** A runbook we consult 48 hours before the first stage. Covers the "operational readiness" section of spec §8.4 plus the first-edition bootstrap steps.

- [ ] **Step 1: Write the checklist**

```markdown
# Pre-race operational checklist

Run through this 48 hours before the first counted stage.

## T-48h: Data setup

- [ ] Active edition exists in `public.editions` with correct `start_date`, `end_date`, `is_active = true`
- [ ] All 21 stages in `public.stages` with correct `start_time` (UTC!)
- [ ] ~10 stages flagged `counts_for_scoring = true`; subset flagged `double_points = true`
- [ ] Manually trigger `/api/cron/scrape-pcs` (curl + bearer) and verify the `startlist` target succeeds → `riders` table has 170+ rows
- [ ] At least 2 admins exist (`role = 'admin'` in `public.profiles`)
- [ ] All 34 invites sent via `/admin/invites`; at least one player has completed sign-up round-trip

## T-24h: Dry-run

- [ ] Publish a dummy `stage_results` row for a non-counted stage (e.g. Stage 2) as a drill. Confirm `/admin/errors` logs the audit row. Immediately `resetStageToUpcoming` and delete the audit trace if desired.
- [ ] Confirm `/` leaderboard loads for a non-admin user within 2 seconds.
- [ ] Confirm `/picks` loads for a player within 2 seconds and rider picker is usable on a phone.
- [ ] Confirm Mailpit/Resend logs show at least one email delivered from a previous invite.

## T-2h: Final checks

- [ ] Both cron jobs show `last_succeeded_at` within the last 2h on `/admin` dashboard
- [ ] No open rows in `scrape_errors` newer than 2h
- [ ] DNS resolving: `dig +short quiniela.yourdomain.com`
- [ ] HTTPS cert valid: `curl -sI https://quiniela.yourdomain.com | grep -i strict-transport-security`

## Incident playbook

**PCS scrape fails for N consecutive runs:**
- Check `/admin/errors` for specific target (stage-N, startlist, final-gc)
- If parser broke (PCS redesigned their HTML): roll back to the last green deploy with `vercel rollback <url>`, patch parser locally against fresh fixture, push fix
- If Cloudflare blocks: update `PCS_USER_AGENT` env var; consider adding 429 backoff

**Reminder cron sends no emails:**
- Check `RESEND_API_KEY` valid and `EMAIL_FROM` is a verified sender domain
- Check `SUPABASE_SMTP_*` fallback if Resend not configured
- Manually trigger `/api/cron/send-reminders` and inspect JSON response

**Player can't sign in:**
- Confirm Supabase Auth → URL Configuration still lists `https://quiniela.yourdomain.com/auth/callback`
- Check Supabase logs for specific user (Dashboard → Auth → Logs)

**Leaderboard shows 0 for a confirmed pick:**
- SQL: `select * from leaderboard_view where user_id = '<id>'` — if empty, the `profiles` row is missing or `deleted_at` is set
- SQL: `select * from stage_results where stage_id = '<id>'` — if empty, admin didn't publish

**Rollback:**
```
vercel rollback <previous-deployment-url>
```
Database migrations are forward-only; if a migration broke prod, restore from Supabase backup (Dashboard → Database → Backups).

## Post-race

- [ ] Publish final GC classification (3 rows) via `/admin/classifications`
- [ ] Publish points jersey winner (1 row) via `/admin/classifications`
- [ ] Verify final `leaderboard_view` row for the winning user
- [ ] Flip `edition.is_active = false` to prevent further writes
- [ ] Archive Mailpit / email logs
```

- [ ] **Step 2: Commit**

```bash
git add docs/pre-race-checklist.md
git commit -m "docs: add pre-race operational checklist and incident playbook"
```

---

### Task D-5.2: Final repo-wide sanity

**Files:** none (verification only)

**Context:** One last everything-green check.

- [ ] **Step 1: Run the full local test matrix**

```bash
npm run typecheck
npm run lint
npx vitest run --reporter=dot
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/ --reporter=dot
npm run build
npx playwright test --project=chromium-mobile
```

Expected: every command exits 0. Any failure is a blocker.

- [ ] **Step 2: Inspect git status**

```bash
git status
git log --oneline 4870a65..HEAD | wc -l
```

Expected: clean working tree. Roughly 12-18 Plan D commits.

- [ ] **Step 3: Verify prod is green**

```bash
curl -sf https://quiniela.yourdomain.com | head -5
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  https://quiniela.yourdomain.com/api/cron/scrape-pcs | jq '.ok'
```

Both should return success.

- [ ] **Step 4: Close out**

No commit. This task is pure verification. If everything passes, Plan D is complete.

---

## Self-review

**Spec coverage:**

| Spec section | Plan D task |
|---|---|
| §2.2 Deployment (Vercel + Supabase) | D-4.1, D-4.2, D-4.3, D-4.4 |
| §6.3 PWA (manifest + SW) | D-3.1, D-3.2, D-3.3, D-3.4 |
| §7 Scraping etiquette (User-Agent env var) | D-4.3 |
| §8.3 E2E (Playwright smoke × 2) | D-2.2, D-2.3 |
| §8.4 CI (GitHub Actions) | D-1.1, D-1.2 |
| §8.4 Operational readiness | D-5.1 |

Plan C carry-over gaps (from final review):
- Server-only bare literal cleanup → D-0.1
- notifyAdmins failure surfaced → D-0.2
- Concurrent reminder test → D-0.3

**Placeholder scan:** Every task has exact file paths, complete code, and a commit step. No "implement similar to…" references.

**Type consistency:** `createTestUser` / `signInWithPassword` signatures in `e2e/helpers.ts` mirror `src/test/integration/helpers.ts` so knowledge transfers. `ScrapeOptions.emailer` signature is reused from Plan C.

**Scope discipline:** No new product features. All work is testing, deploy, or operational hardening.

---

## Deliverables at end of Plan D

- ✅ Bare `'server-only'` fixed; scrape email failure visible; concurrent reminder test in place
- ✅ GitHub Actions CI running on every PR (typecheck, lint, unit, build, integration, E2E)
- ✅ Playwright smoke covering player pick round-trip and admin publish → leaderboard
- ✅ PWA installable (manifest, icons, service worker, offline fallback)
- ✅ Production Vercel deploy live on custom domain with TLS
- ✅ Supabase production project with migrations applied and auth whitelist configured
- ✅ Vercel Cron firing both scrape and reminder jobs
- ✅ Pre-race operational checklist committed

After Plan D, the project is race-ready. The only remaining work is content (edition calendar, stage flags, invites) handled via the admin UI.
