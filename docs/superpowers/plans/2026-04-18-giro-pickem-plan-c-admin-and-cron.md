# Quiniela Giro Pickem — Plan C: Admin UI & Cron

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin experience (edition setup, stage result review & publish, final classifications publish, player roster, stage cancellation) plus the two cron jobs (PCS scraper + pick reminders) plus a thin transactional email adapter, so race-day flow works end-to-end locally. After Plan C, an admin can run the whole Giro without touching SQL.

**Architecture:** Admin routes under `/admin/*` share a layout that gates on `profiles.role = 'admin'`. All admin writes go through server actions that use the user's session client (RLS enforces admin role via existing policies). Cron routes under `/api/cron/*` authenticate via a `CRON_SECRET` bearer header, use the service-role client (bypasses RLS), and run idempotently. Emails flow through a thin `src/lib/email/send.ts` adapter: in local dev it sends to Supabase's Inbucket/Mailpit SMTP; in prod it calls Resend. The admin UI surfaces scrape errors and last-run timestamps so you can see the cron's state without logging into Vercel.

**Tech additions (new):** `nodemailer` for SMTP locally, `resend` for prod (SDK-only — we shell around it). One new env var: `CRON_SECRET`. One new migration for a `cron_runs` table tracking last-successful-scrape timestamp.

**Reference spec:** `docs/superpowers/specs/2026-04-17-giro-pickem-design.md` — §§4.4 (scrape flow), 4.6 (stage cancellation), 4.7 (reminders), 4.8 (final classifications), §6.2 (admin screens), §7 (error handling).

**Reference prior plans:**
- `docs/superpowers/plans/2026-04-17-giro-pickem-plan-a-foundation.md`
- `docs/superpowers/plans/2026-04-18-giro-pickem-plan-b-auth-player-ux.md`

**Commit policy:** One commit per task.

**What is NOT in Plan C** (stays in Plan D):
- PWA manifest + service worker.
- Playwright E2E specs.
- GitHub Actions CI.
- Vercel deploy.
- Rolling releases, preview envs.

---

## File structure created or modified by Plan C

```
quiniela/
├── vercel.ts                                             (crons uncommented)
├── supabase/
│   └── migrations/
│       └── 20260418000001_cron_runs.sql                  (new: track last-successful-scrape timestamps)
├── src/
│   ├── lib/
│   │   ├── email/
│   │   │   ├── send.ts                                   (adapter: nodemailer → Supabase SMTP in dev, Resend in prod)
│   │   │   ├── templates.ts                              (stage-results-ready + pick-reminder bodies)
│   │   │   └── send.test.ts                              (adapter uses correct transport based on env)
│   │   ├── actions/
│   │   │   ├── admin-stage.ts                            (publishStageResults, editStageResult, cancelStage)
│   │   │   ├── admin-final.ts                            (publishFinalClassification)
│   │   │   ├── admin-edition.ts                          (toggleCountsForScoring, toggleDoublePoints)
│   │   │   ├── admin-roster.ts                           (promoteToAdmin, demoteToPlayer, softDeletePlayer)
│   │   │   └── admin-rider.ts                            (upsertRidersFromStartlist, setRiderStatus)
│   │   ├── cron/
│   │   │   ├── auth.ts                                   (verifyCronSecret)
│   │   │   ├── scrape.ts                                 (Core logic: fetchAndPersist PCS HTML → drafts)
│   │   │   └── reminders.ts                              (Core logic: find picks-missing users → enqueue emails)
│   │   └── queries/
│   │       ├── admin.ts                                  (listAllProfiles, getStageDraftResults, listScrapeErrors, getLastScrapeRun)
│   │       └── reminders.ts                              (findUsersWithoutPickForStage)
│   ├── app/
│   │   ├── admin/
│   │   │   ├── layout.tsx                                (shared admin nav + gate)
│   │   │   ├── page.tsx                                  (dashboard: counts, last-scrape-at, errors)
│   │   │   ├── edition/
│   │   │   │   ├── page.tsx                              (toggle counts_for_scoring + double_points per stage)
│   │   │   │   └── actions.ts
│   │   │   ├── stages/
│   │   │   │   ├── page.tsx                              (list all 21 stages: status + published/draft/cancelled)
│   │   │   │   ├── [stageNumber]/
│   │   │   │   │   ├── page.tsx                          (draft top-10 editor + publish button + cancel)
│   │   │   │   │   └── form.tsx                          (client)
│   │   │   │   └── actions.ts                            (thin re-exports from admin-stage.ts)
│   │   │   ├── classifications/
│   │   │   │   ├── page.tsx                              (GC + points jersey draft review + publish)
│   │   │   │   └── actions.ts
│   │   │   ├── riders/
│   │   │   │   ├── page.tsx                              (list riders with status toggle; upsert from scraped startlist)
│   │   │   │   └── actions.ts
│   │   │   ├── roster/
│   │   │   │   ├── page.tsx                              (list profiles: promote/demote/soft-delete)
│   │   │   │   └── actions.ts
│   │   │   ├── errors/
│   │   │   │   └── page.tsx                              (scrape_errors tail; audit_log tail)
│   │   │   └── invites/ (existing)
│   │   └── api/
│   │       └── cron/
│   │           ├── scrape-pcs/route.ts                   (new)
│   │           └── send-reminders/route.ts               (new)
│   └── test/
│       └── integration/
│           ├── admin-publish-stage.test.ts               (draft → publish → leaderboard updates)
│           ├── admin-cancel-stage.test.ts                (cancel → pick → same rider re-pickable on another stage)
│           ├── admin-publish-final.test.ts               (GC publish scores leaderboard.gc_points)
│           ├── cron-scrape.test.ts                       (against committed PCS fixtures — no network)
│           ├── cron-reminders.test.ts                    (dedup via pick_reminders_sent)
│           └── email-send.test.ts                        (env-gated: dev transport vs prod)
```

---

## Phase 0 — Foundations for admin & cron

### Task C0.1: `cron_runs` migration

**Files:**
- Create: `supabase/migrations/20260418000001_cron_runs.sql`

**Context:** Admin dashboard needs a way to show "last successful scrape". We could derive from `scrape_errors` + heuristics, but a dedicated table is clearer and bounded in size. One row per cron job name, upserted on each run.

- [ ] **Step 1: Write migration**

Write `supabase/migrations/20260418000001_cron_runs.sql`:
```sql
create table public.cron_runs (
  job_name           text primary key,
  last_started_at    timestamptz,
  last_succeeded_at  timestamptz,
  last_error         text,
  consecutive_failures int not null default 0
);

alter table public.cron_runs enable row level security;

create policy "cron_runs_read_admin" on public.cron_runs
  for select to authenticated using (public.is_admin());

-- Writes happen via service_role only (from cron routes); no user-facing write policy.

-- Seed the two jobs so the admin dashboard can show "never run" distinctly from "not configured".
insert into public.cron_runs (job_name) values
  ('scrape-pcs'),
  ('send-reminders')
on conflict (job_name) do nothing;
```

- [ ] **Step 2: Apply**

Run: `npx supabase db reset`. Expected: clean.

- [ ] **Step 3: Regenerate types + typecheck**

Run: `npm run db:types && npx tsc --noEmit`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418000001_cron_runs.sql src/lib/types/database.ts
git commit -m "feat(db): add cron_runs table for tracking scrape/reminder last-run state"
```

---

### Task C0.2: Cron secret + auth helper

**Files:**
- Create: `src/lib/cron/auth.ts`
- Modify: `.env.local.example`
- Modify: `.env.local` (add a value)

**Context:** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on each scheduled call. Local dev + curl uses the same header. Middleware should NOT apply to `/api/cron/*` — Supabase session refresh would be wasted work there. Also, cron routes must be able to handle unauthenticated "normal" browser traffic without 500 — they return 401.

- [ ] **Step 1: Auth helper**

Write `src/lib/cron/auth.ts`:
```ts
import 'server-only';

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  // Constant-time-ish compare; the risk is tiny for this use case but it's easy.
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
```

- [ ] **Step 2: Add/update env example**

Edit `.env.local.example` so `CRON_SECRET` has meaningful guidance:
```
# Shared secret Vercel Cron sends as Authorization: Bearer <secret>.
# In local dev, set any string and pass via: curl -H "Authorization: Bearer $CRON_SECRET" ...
CRON_SECRET=change-me-in-prod
```

Edit `.env.local` to set a real value (any non-empty string). Do NOT commit `.env.local`.

- [ ] **Step 3: Exclude `/api/cron/*` from middleware**

Edit `middleware.ts` `config.matcher` to add `/api/cron` to the exclusion list, or add `/api/cron/:path*` as a distinct excluded path. Simpler: keep the existing matcher and short-circuit early when `request.nextUrl.pathname.startsWith('/api/cron/')`:
```ts
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }
  // ...existing logic
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/cron/auth.ts middleware.ts .env.local.example
git commit -m "feat(cron): add shared-secret auth helper and bypass middleware for /api/cron/*"
```

---

### Task C0.3: Email adapter (local SMTP ↔ Resend)

**Files:**
- Install: `nodemailer`, `@types/nodemailer` (dev), `resend`
- Create: `src/lib/email/send.ts`
- Create: `src/lib/email/templates.ts`
- Create: `src/lib/email/send.test.ts`

**Context:** The adapter picks transport at call time based on env:
- If `RESEND_API_KEY` is set, use Resend.
- Else if `SUPABASE_SMTP_PORT` is set (or default 54325), use nodemailer → Supabase Inbucket/Mailpit. This is the local-dev default.
- Else throw — never silently no-op.

Every caller passes `{ to, subject, text, html? }`. No HTML template engine; the two emails we need are tiny and compose fine as string templates.

- [ ] **Step 1: Install deps**

```bash
npm install nodemailer resend
npm install -D @types/nodemailer
```

- [ ] **Step 2: Write templates**

Write `src/lib/email/templates.ts`:
```ts
export function stageDraftReady(stageNumber: number, inspectUrl: string): { subject: string; text: string } {
  return {
    subject: `Stage ${stageNumber} draft results ready for review`,
    text: `Scraped top-10 for Stage ${stageNumber} is waiting for an admin to review and publish.\n\nReview: ${inspectUrl}\n`,
  };
}

export function pickReminder(
  displayName: string,
  stageNumber: number,
  locksAt: Date,
  pickUrl: string,
): { subject: string; text: string } {
  const locksIn = formatRelative(locksAt.getTime() - Date.now());
  return {
    subject: `Pick a rider for Stage ${stageNumber} (locks in ${locksIn})`,
    text: `Hey ${displayName},\n\nStage ${stageNumber} locks ${locksAt.toLocaleString()} (${locksIn} from now) and you haven't picked a rider yet.\n\nPick now: ${pickUrl}\n`,
  };
}

function formatRelative(ms: number): string {
  if (ms <= 0) return 'now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
```

- [ ] **Step 3: Write adapter**

Write `src/lib/email/send.ts`:
```ts
import 'server-only';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const from = process.env.EMAIL_FROM ?? 'Quiniela <no-reply@example.com>';
    const { error } = await resend.emails.send({ from, ...input });
    if (error) throw new Error(`resend: ${error.message}`);
    return;
  }

  const smtpPort = Number(process.env.SUPABASE_SMTP_PORT ?? 54325);
  const smtpHost = process.env.SUPABASE_SMTP_HOST ?? '127.0.0.1';
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    tls: { rejectUnauthorized: false },
  });
  const from = process.env.EMAIL_FROM ?? 'Quiniela <no-reply@quiniela.local>';
  await transport.sendMail({ from, ...input });
}
```

- [ ] **Step 4: Test that picks the right transport**

Write `src/lib/email/send.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendEmail adapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
    process.env.SUPABASE_SMTP_HOST = '127.0.0.1';
    process.env.SUPABASE_SMTP_PORT = '54325';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses nodemailer transport in local dev (no RESEND_API_KEY)', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.doMock('nodemailer', () => ({
      default: { createTransport: () => ({ sendMail }) },
    }));
    const { sendEmail } = await import('./send');
    await sendEmail({ to: 'a@b.test', subject: 'hi', text: 'hi' });
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('uses Resend when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const resendSend = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('resend', () => ({
      Resend: class { emails = { send: resendSend } },
    }));
    const { sendEmail } = await import('./send');
    await sendEmail({ to: 'a@b.test', subject: 'hi', text: 'hi' });
    expect(resendSend).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
npm test
git add src/lib/email/ package.json package-lock.json
git commit -m "feat(email): add send adapter (Resend | Supabase SMTP) with templates and transport tests"
```

---

## Phase 1 — Admin shell

### Task C1.1: Admin layout + nav

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/admin-nav.tsx`

**Context:** All `/admin/*` routes share a gate + left rail nav. Guard via `requireAdmin()` (which we unified in the Plan B fix to return `{ user, profile }`). Main layout is a flex row: nav on desktop, collapsed on mobile.

- [ ] **Step 1: Layout + nav**

Write `src/app/admin/layout.tsx`:
```tsx
import { requireAdmin } from '@/lib/auth/require-user';
import { AdminNav } from '@/components/admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminNav />
      <main className="flex-1 p-4 md:p-6 mx-auto w-full max-w-4xl">{children}</main>
    </div>
  );
}
```

Write `src/components/admin-nav.tsx` (client):
```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/edition', label: 'Edition' },
  { href: '/admin/stages', label: 'Stages' },
  { href: '/admin/classifications', label: 'Final classifications' },
  { href: '/admin/riders', label: 'Riders' },
  { href: '/admin/roster', label: 'Roster' },
  { href: '/admin/invites', label: 'Invites' },
  { href: '/admin/errors', label: 'Errors & audit' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="md:w-56 md:border-r md:h-screen p-3 border-b bg-muted/30">
      <div className="font-semibold pb-3 px-2">Admin</div>
      <ul className="flex md:flex-col gap-1 overflow-x-auto">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <li key={it.href} className="shrink-0">
              <Link
                href={it.href}
                className={`block whitespace-nowrap rounded px-3 py-2 text-sm ${
                  active ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                }`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/app/admin/layout.tsx src/components/admin-nav.tsx
git commit -m "feat(admin): add shared admin layout with nav and admin-only auth gate"
```

---

### Task C1.2: Admin dashboard

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/lib/queries/admin.ts`

**Context:** Dashboard shows:
- Counts: # players, # stages counted, # invites pending
- Cron status: last-successful-scrape, last-successful-reminder, consecutive_failures per job
- Recent scrape errors (top 5)
- Recent audit log entries (top 10)

- [ ] **Step 1: Query helpers**

Write `src/lib/queries/admin.ts`:
```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getAdminCounts(editionId: string) {
  const supabase = await createClient();
  const [players, countedStages, pendingInvites] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('stages').select('id', { count: 'exact', head: true }).eq('edition_id', editionId).eq('counts_for_scoring', true),
    supabase.from('invites').select('code', { count: 'exact', head: true }).is('used_at', null),
  ]);
  return {
    players: players.count ?? 0,
    countedStages: countedStages.count ?? 0,
    pendingInvites: pendingInvites.count ?? 0,
  };
}

export async function getCronRuns() {
  const supabase = await createClient();
  const { data } = await supabase.from('cron_runs').select('*');
  return data ?? [];
}

export async function listScrapeErrors(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('scrape_errors').select('*').order('run_at', { ascending: false }).limit(limit);
  return data ?? [];
}

export async function listAuditEvents(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  return data ?? [];
}
```

- [ ] **Step 2: Dashboard page**

Write `src/app/admin/page.tsx`:
```tsx
import { getActiveEdition } from '@/lib/queries/stages';
import { getAdminCounts, getCronRuns, listScrapeErrors, listAuditEvents } from '@/lib/queries/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function relative(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AdminDashboard() {
  const edition = await getActiveEdition();
  if (!edition) return <div>No active edition.</div>;

  const [counts, crons, errors, events] = await Promise.all([
    getAdminCounts(edition.id),
    getCronRuns(),
    listScrapeErrors(5),
    listAuditEvents(10),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard — {edition.name}</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Players</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{counts.players}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Counted stages</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{counts.countedStages}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Pending invites</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{counts.pendingInvites}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Cron jobs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {crons.map((c) => (
            <div key={c.job_name} className="flex items-center justify-between">
              <div className="font-mono">{c.job_name}</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">last ok: {relative(c.last_succeeded_at)}</span>
                {c.consecutive_failures > 0 && (
                  <Badge variant="destructive">{c.consecutive_failures} fails</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent scrape errors</CardTitle></CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">None in recent history.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {errors.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{relative(e.run_at)}</span>
                  <span className="font-mono text-xs">{e.target}</span>
                  <span className="truncate">{e.error}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent audit events</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{relative(e.created_at)}</span>
                  <span className="font-mono text-xs">{e.action}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
git add src/app/admin/page.tsx src/lib/queries/admin.ts
git commit -m "feat(admin): add dashboard with counts, cron status, errors, and audit log"
```

---

## Phase 2 — Admin actions: edition, stages, classifications, roster, riders

### Task C2.1: Edition setup — toggle counts_for_scoring + double_points

**Files:**
- Create: `src/lib/actions/admin-edition.ts`
- Create: `src/app/admin/edition/page.tsx`
- Create: `src/app/admin/edition/form.tsx`

**Context:** Shows all 21 stages in a table. Two checkboxes per row (counts / double). Save via a bulk form.

- [ ] **Step 1: Server action**

Write `src/lib/actions/admin-edition.ts`:
```ts
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './result';

const bulkSchema = z.object({
  editionId: z.string().uuid(),
  stages: z.array(z.object({
    id: z.string().uuid(),
    counts_for_scoring: z.boolean(),
    double_points: z.boolean(),
  })),
});

export async function updateStageFlags(input: z.infer<typeof bulkSchema>): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const { user, profile } = await requireAdmin();
  const supabase = await createClient();

  // Update each stage; RLS enforces admin write.
  for (const s of parsed.data.stages) {
    const { error } = await supabase
      .from('stages')
      .update({
        counts_for_scoring: s.counts_for_scoring,
        double_points: s.double_points,
      })
      .eq('id', s.id)
      .eq('edition_id', parsed.data.editionId);
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'update_edition_stage_flags',
    target: { editionId: parsed.data.editionId, stageCount: parsed.data.stages.length },
  });

  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Page + form**

Write `src/app/admin/edition/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { EditionForm } from './form';

export default async function AdminEditionPage() {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from('stages').select('*').eq('edition_id', edition.id).order('number');
  return <EditionForm editionId={edition.id} stages={stages ?? []} />;
}
```

Write `src/app/admin/edition/form.tsx`:
```tsx
'use client';
import { useState, useTransition } from 'react';
import { updateStageFlags } from '@/lib/actions/admin-edition';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/types/database';

type Stage = Database['public']['Tables']['stages']['Row'];

export function EditionForm({ editionId, stages }: { editionId: string; stages: Stage[] }) {
  const [local, setLocal] = useState(
    stages.map((s) => ({ id: s.id, number: s.number, counts_for_scoring: s.counts_for_scoring, double_points: s.double_points })),
  );
  const [status, setStatus] = useState<null | 'saving' | 'saved' | string>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edition setup</h1>
      <p className="text-sm text-muted-foreground">Flip checkboxes to mark which of the 21 stages count for scoring and which are double-points. Save applies all changes at once.</p>

      <table className="w-full text-sm border rounded">
        <thead className="bg-muted">
          <tr><th className="p-2 text-left">Stage</th><th className="p-2">Counts</th><th className="p-2">2×</th></tr>
        </thead>
        <tbody>
          {local.map((s, i) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">Stage {s.number}</td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={s.counts_for_scoring}
                  onChange={(e) => {
                    const copy = [...local]; copy[i] = { ...copy[i], counts_for_scoring: e.target.checked }; setLocal(copy);
                  }}
                />
              </td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={s.double_points}
                  onChange={(e) => {
                    const copy = [...local]; copy[i] = { ...copy[i], double_points: e.target.checked }; setLocal(copy);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button
        disabled={pending}
        onClick={() => {
          setStatus('saving');
          startTransition(async () => {
            const res = await updateStageFlags({
              editionId,
              stages: local.map((s) => ({ id: s.id, counts_for_scoring: s.counts_for_scoring, double_points: s.double_points })),
            });
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {status === 'saved' && <p className="text-sm text-green-600">Saved.</p>}
      {typeof status === 'string' && status !== 'saving' && status !== 'saved' && (
        <p className="text-sm text-red-600">{status}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-edition.ts src/app/admin/edition/
git commit -m "feat(admin): edition setup page to toggle counts_for_scoring and double_points per stage"
```

---

### Task C2.2: Stage results publish flow

**Files:**
- Create: `src/lib/actions/admin-stage.ts`
- Create: `src/app/admin/stages/page.tsx` (list all 21)
- Create: `src/app/admin/stages/[stageNumber]/page.tsx` (review one stage)
- Create: `src/app/admin/stages/[stageNumber]/form.tsx`
- Create: `src/test/integration/admin-publish-stage.test.ts`

**Context:** For each stage, admin sees the scraped draft top-10 (if any), can edit rider/position cells, and clicks Publish. Publishing flips `stage_results.status` to `'published'` AND sets `stages.status = 'published'`. It also writes an audit log row. Leaderboard recomputes automatically because it's a live view.

Action signature: `publishStageResults({ stageId, results: {position, rider_id}[] })`.

- [ ] **Step 1: Server actions**

Write `src/lib/actions/admin-stage.ts`:
```ts
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { ActionResult } from './result';

type Supa = SupabaseClient<Database>;

const publishSchema = z.object({
  stageId: z.string().uuid(),
  results: z.array(z.object({
    position: z.number().int().min(1).max(10),
    rider_id: z.string().uuid(),
  })).min(1).max(10),
});

export async function publishStageResultsCore(
  supabase: Supa,
  actorId: string,
  input: z.infer<typeof publishSchema>,
): Promise<ActionResult> {
  // Verify positions are unique and contiguous from 1.
  const positions = input.results.map((r) => r.position).sort((a, b) => a - b);
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== i + 1) return { ok: false, error: `missing_or_duplicate_position_${i + 1}` };
  }

  // Delete existing rows and re-insert as published (simpler than diff).
  const { error: delErr } = await supabase.from('stage_results').delete().eq('stage_id', input.stageId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = input.results.map((r) => ({
    stage_id: input.stageId,
    position: r.position,
    rider_id: r.rider_id,
    status: 'published' as const,
  }));
  const { error: insErr } = await supabase.from('stage_results').insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  const { error: stageErr } = await supabase
    .from('stages')
    .update({ status: 'published' })
    .eq('id', input.stageId);
  if (stageErr) return { ok: false, error: stageErr.message };

  await supabase.from('audit_log').insert({
    actor_id: actorId,
    action: 'publish_stage_results',
    target: { stageId: input.stageId, top_count: rows.length },
  });

  return { ok: true, data: undefined };
}

export async function publishStageResults(input: z.infer<typeof publishSchema>): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  const { user } = await requireAdmin();
  const supabase = await createClient();
  return publishStageResultsCore(supabase, user.id, parsed.data);
}

export async function cancelStage(stageId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(stageId);
  if (!parsed.success) return { ok: false, error: 'invalid_stage_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('stages').update({ status: 'cancelled' }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'cancel_stage',
    target: { stageId: parsed.data },
  });

  return { ok: true, data: undefined };
}

export async function resetStageToUpcoming(stageId: string): Promise<ActionResult> {
  // Undo cancel or undo publish if admin needs to redo. Deletes stage_results rows too.
  const parsed = z.string().uuid().safeParse(stageId);
  if (!parsed.success) return { ok: false, error: 'invalid_stage_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();

  const { error: delErr } = await supabase.from('stage_results').delete().eq('stage_id', parsed.data);
  if (delErr) return { ok: false, error: delErr.message };

  const { error } = await supabase
    .from('stages').update({ status: 'upcoming' }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'reset_stage',
    target: { stageId: parsed.data },
  });

  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: List page**

Write `src/app/admin/stages/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';

export default async function AdminStagesList() {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from('stages').select('*').eq('edition_id', edition.id).order('number');

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Stages</h1>
      <ul className="space-y-1">
        {(stages ?? []).map((s) => (
          <li key={s.id}>
            <Link
              href={`/admin/stages/${s.number}`}
              className="flex items-center justify-between border rounded px-4 py-2 hover:bg-muted text-sm"
            >
              <span>Stage {s.number}</span>
              <span className="flex gap-2">
                {s.counts_for_scoring && <Badge variant="secondary">counted</Badge>}
                {s.double_points && <Badge variant="secondary">2×</Badge>}
                <Badge>{s.status}</Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Review / publish page**

Write `src/app/admin/stages/[stageNumber]/page.tsx`:
```tsx
import { notFound, redirect } from 'next/navigation';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { listActiveRiders } from '@/lib/queries/riders';
import { StagePublishForm } from './form';

export default async function AdminStageReviewPage({
  params,
}: { params: Promise<{ stageNumber: string }> }) {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');
  const { stageNumber } = await params;
  const stage = await getStageByNumber(edition.id, Number(stageNumber));
  if (!stage) notFound();

  const supabase = await createClient();
  const [{ data: existing }, riders] = await Promise.all([
    supabase.from('stage_results').select('*').eq('stage_id', stage.id).order('position'),
    listActiveRiders(edition.id),
  ]);

  return (
    <StagePublishForm
      stage={stage}
      initialRows={(existing ?? []).map((r) => ({ position: r.position, rider_id: r.rider_id }))}
      riders={riders.map((r) => ({ id: r.id, name: r.name, bib: r.bib, team: r.team ?? '' }))}
    />
  );
}
```

Write `src/app/admin/stages/[stageNumber]/form.tsx`:
```tsx
'use client';
import { useState, useTransition } from 'react';
import { publishStageResults, cancelStage, resetStageToUpcoming } from '@/lib/actions/admin-stage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/lib/types/database';

type Stage = Database['public']['Tables']['stages']['Row'];
type Row = { position: number; rider_id: string };
type RiderOpt = { id: string; name: string; bib: number | null; team: string };

export function StagePublishForm({
  stage, initialRows, riders,
}: { stage: Stage; initialRows: Row[]; riders: RiderOpt[] }) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (initialRows.length) return initialRows;
    return Array.from({ length: 10 }, (_, i) => ({ position: i + 1, rider_id: '' }));
  });
  const [status, setStatus] = useState<null | 'saving' | 'saved' | string>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stage {stage.number}</h1>
        <Badge>{stage.status}</Badge>
      </div>

      <table className="w-full text-sm border rounded">
        <thead className="bg-muted"><tr><th className="p-2">Pos</th><th className="p-2 text-left">Rider</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.position} className="border-t">
              <td className="p-2 text-center font-mono">{r.position}</td>
              <td className="p-2">
                <select
                  value={r.rider_id}
                  onChange={(e) => {
                    const copy = [...rows]; copy[i] = { ...copy[i], rider_id: e.target.value }; setRows(copy);
                  }}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">—</option>
                  {riders.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.bib ? `#${opt.bib} ` : ''}{opt.name} — {opt.team}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            const filled = rows.filter((r) => r.rider_id);
            setStatus('saving');
            startTransition(async () => {
              const res = await publishStageResults({ stageId: stage.id, results: filled });
              setStatus(res.ok ? 'saved' : res.error);
            });
          }}
        >
          {pending ? 'Publishing…' : 'Publish'}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => {
          if (!confirm('Cancel this stage? Picks will be treated as 0 points.')) return;
          startTransition(async () => {
            const res = await cancelStage(stage.id);
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}>Cancel stage</Button>
        <Button variant="ghost" disabled={pending} onClick={() => {
          if (!confirm('Reset to upcoming (clears results)?')) return;
          startTransition(async () => {
            const res = await resetStageToUpcoming(stage.id);
            setStatus(res.ok ? 'saved' : res.error);
          });
        }}>Reset</Button>
      </div>
      {status === 'saved' && <p className="text-sm text-green-600">Saved.</p>}
      {typeof status === 'string' && status !== 'saving' && status !== 'saved' && (
        <p className="text-sm text-red-600">{status}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Integration test**

Write `src/test/integration/admin-publish-stage.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishStageResultsCore } from '@/lib/actions/admin-stage';
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
    // Give the player a pick on Stage 9 with Pogacar.
    await a.from('stage_picks').insert({ user_id: player.userId, stage_id: STAGE_9, rider_id: R_POG });
    // Push Stage 9 into the past so publishing is sensible.
    await a.from('stages').update({ start_time: new Date(Date.now() - 3600_000).toISOString() }).eq('id', STAGE_9);
  });

  afterAll(async () => {
    const a = createAdminClient();
    await a.from('stage_results').delete().eq('stage_id', STAGE_9);
    await a.from('stage_picks').delete().eq('stage_id', STAGE_9);
    await a.from('stages').update({ start_time: new Date('2026-05-17T12:00:00Z').toISOString(), status: 'upcoming' }).eq('id', STAGE_9);
    await admin.cleanup();
    await player.cleanup();
  });

  it('publishing with player-picked rider at position 1 gives them stage points (25 × 2 = 50, stage 9 is 2×)', async () => {
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

    // Check leaderboard view (via admin bypass).
    const a = createAdminClient();
    const { data } = await a.from('leaderboard_view').select('*').eq('user_id', player.userId);
    expect(data?.[0]?.stage_points).toBe(50);
    expect(data?.[0]?.exact_winners_count).toBe(1);
  });

  it('publishing with duplicate positions is rejected', async () => {
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

  it('non-admin cannot publish (RLS blocks the delete/insert on stage_results)', async () => {
    const c = await userClient(player.email, player.password);
    const res = await publishStageResultsCore(c, player.userId, {
      stageId: STAGE_9,
      results: [{ position: 1, rider_id: R_POG }],
    });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/admin-publish-stage.test.ts
```

Then:
```bash
git add src/lib/actions/admin-stage.ts src/app/admin/stages/ src/test/integration/admin-publish-stage.test.ts
git commit -m "feat(admin): publish stage results, cancel stage, reset; RLS-enforced"
```

---

### Task C2.3: Final classifications publish (GC + points jersey)

**Files:**
- Create: `src/lib/actions/admin-final.ts`
- Create: `src/app/admin/classifications/page.tsx`
- Create: `src/app/admin/classifications/form.tsx`
- Create: `src/test/integration/admin-publish-final.test.ts`

**Context:** Admin picks the top 3 GC riders (in order) and the single points jersey winner. Publishing writes `final_classifications` rows with `status='published'`, which triggers the leaderboard view's GC + jersey scoring.

Implementation mirrors `publishStageResults` but with `final_classifications`. Write both on one form submit (keep it simple — if the admin wants to publish just GC or just jersey, they can blank the other fields and we only write non-empty).

- [ ] **Step 1: Actions**

Write `src/lib/actions/admin-final.ts` (core + wrapper, validating 3 distinct GC riders if any + one jersey rider, writing audit log, deleting prior rows by kind before inserting).

- [ ] **Step 2: Page + form**

Write `src/app/admin/classifications/page.tsx` + `form.tsx`. Use 3 select dropdowns for GC (positions 1/2/3) and 1 select for jersey. Submit runs both writes atomically via the server action.

- [ ] **Step 3: Integration test**

Write `src/test/integration/admin-publish-final.test.ts`:
- Seed: create admin + player. Give player gc_picks matching expected final GC exactly.
- Publish final GC.
- Assert `leaderboard_view.gc_points === 90` for that player.
- Same for a test with jersey only.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(admin): publish final GC and jersey classifications with integration test"
```

---

### Task C2.4: Player roster (promote / demote / soft-delete)

**Files:**
- Create: `src/lib/actions/admin-roster.ts`
- Create: `src/app/admin/roster/page.tsx`
- Create: `src/app/admin/roster/form.tsx`

**Context:** Table of profiles with role column and action buttons. Soft-delete sets `deleted_at`; keeps picks and audit history intact. Promote/demote flips role. The admin cannot demote themselves (guard in action).

- [ ] **Step 1: Actions**

Write `src/lib/actions/admin-roster.ts`:
```ts
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './result';

export async function setRole(userId: string, role: 'admin' | 'player'): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: 'invalid_user_id' };

  const { user } = await requireAdmin();
  if (user.id === parsed.data && role !== 'admin') {
    return { ok: false, error: 'cannot_demote_self' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'set_role',
    target: { userId: parsed.data, role },
  });

  return { ok: true, data: undefined };
}

export async function softDeletePlayer(userId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: 'invalid_user_id' };

  const { user } = await requireAdmin();
  if (user.id === parsed.data) return { ok: false, error: 'cannot_delete_self' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'soft_delete_player',
    target: { userId: parsed.data },
  });

  return { ok: true, data: undefined };
}

export async function restorePlayer(userId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: 'invalid_user_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles').update({ deleted_at: null }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'restore_player',
    target: { userId: parsed.data },
  });

  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Page + form**

Write `src/app/admin/roster/page.tsx` — lists all profiles (including soft-deleted, with strikethrough). `form.tsx` is a client row component with three buttons.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(admin): roster page with role management and soft-delete"
```

---

### Task C2.5: Riders admin (upsert startlist + status toggle)

**Files:**
- Create: `src/lib/actions/admin-rider.ts`
- Create: `src/app/admin/riders/page.tsx`
- Create: `src/app/admin/riders/form.tsx`

**Context:** Two paths in: (a) "Upsert from scraped startlist" button that runs the PCS startlist scraper + parser on-demand (not via cron) and upserts `riders`. (b) Per-rider status toggle (active / dnf / dns). Scraper result count is shown after upsert ("Upserted 176 riders, 4 new, 172 updated").

- [ ] **Step 1: Action**

Write `src/lib/actions/admin-rider.ts`:
```ts
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { pcsStartlistUrl } from '@/lib/pcs/urls';
import { parseStartlist } from '@/lib/pcs/parse-startlist';
import type { ActionResult } from './result';

export async function upsertRidersFromStartlist(editionId: string, raceSlug: string, year: number): Promise<ActionResult<{ count: number }>> {
  const { user } = await requireAdmin();
  const url = pcsStartlistUrl(raceSlug, year);

  const res = await fetch(url, {
    headers: { 'User-Agent': process.env.PCS_USER_AGENT ?? 'Quiniela' },
  });
  if (!res.ok) return { ok: false, error: `pcs_fetch_${res.status}` };
  const html = await res.text();

  let entries;
  try {
    entries = parseStartlist(html);
  } catch (e) {
    return { ok: false, error: `parse_${(e as Error).message}` };
  }

  const supabase = await createClient();
  const rows = entries.map((e) => ({
    edition_id: editionId,
    pcs_slug: e.rider_slug,
    name: e.rider_name,
    team: e.team_name || null,
    bib: e.bib,
    status: 'active' as const,
  }));

  const { error } = await supabase.from('riders').upsert(rows, { onConflict: 'edition_id,pcs_slug' });
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'upsert_riders',
    target: { editionId, count: rows.length },
  });

  return { ok: true, data: { count: rows.length } };
}

export async function setRiderStatus(riderId: string, status: 'active' | 'dnf' | 'dns'): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(riderId);
  if (!parsed.success) return { ok: false, error: 'invalid_rider_id' };

  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from('riders').update({ status }).eq('id', parsed.data);
  if (error) return { ok: false, error: error.message };

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'set_rider_status',
    target: { riderId: parsed.data, status },
  });

  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Page + form**

Write `src/app/admin/riders/page.tsx` — lists active edition's riders with a search box and status selects. Plus a top "Refresh from PCS startlist" button that prompts for confirmation (since it makes a network call to PCS).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(admin): riders page with PCS startlist refresh and status toggle"
```

---

## Phase 3 — Cron: PCS scraper

### Task C3.1: Scrape core logic

**Files:**
- Create: `src/lib/cron/scrape.ts`
- Create: `src/test/integration/cron-scrape.test.ts`

**Context:** `scrapeAndPersist` is the pure-core function the route handler calls. It:
1. Finds the active edition.
2. Determines what to scrape:
   - If no active rider rows → scrape startlist.
   - For each stage with `start_time` in last 6 hours AND `status !== 'published'` → scrape stage results and upsert as `status='draft'`.
   - If `now() > edition.end_date` AND no final_classifications rows → scrape GC and points pages.
3. On any parse error → writes `scrape_errors` row, continues with next target.
4. On success → records timestamps in `cron_runs`.
5. On new stage draft → emails all admins.

Uses service-role client (bypasses RLS for writes to `stage_results`, `riders`, `scrape_errors`, `cron_runs`).

- [ ] **Step 1: Core implementation**

Write `src/lib/cron/scrape.ts`:
```ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStageResults } from '@/lib/pcs/parse-stage-results';
import { parseClassification } from '@/lib/pcs/parse-final';
import { parseStartlist } from '@/lib/pcs/parse-startlist';
import { pcsStageResultsUrl, pcsStartlistUrl, pcsFinalGcUrl, pcsFinalPointsUrl } from '@/lib/pcs/urls';
import { sendEmail } from '@/lib/email/send';
import { stageDraftReady } from '@/lib/email/templates';

export interface ScrapeOptions {
  /** Override fetch for tests (e.g., serve fixture HTML). */
  fetcher?: (url: string) => Promise<string>;
  /** Override current time for tests. */
  now?: () => Date;
  /** Override email sender for tests. */
  emailer?: (to: string, subject: string, text: string) => Promise<void>;
  /** Race slug and year override for tests (defaults pulled from edition). */
  raceOverride?: { slug: string; year: number };
}

export interface ScrapeResult {
  ok: boolean;
  targets: { target: string; status: 'ok' | 'error'; message?: string }[];
}

const DEFAULT_FETCHER = async (url: string): Promise<string> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': process.env.PCS_USER_AGENT ?? 'Quiniela' },
  });
  if (!res.ok) throw new Error(`pcs_${res.status}`);
  return res.text();
};

export async function scrapeAndPersist(opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const fetcher = opts.fetcher ?? DEFAULT_FETCHER;
  const now = (opts.now ?? (() => new Date()))();
  const supabase = createAdminClient();
  const targets: ScrapeResult['targets'] = [];

  // Record run start.
  await supabase.from('cron_runs').update({ last_started_at: now.toISOString() }).eq('job_name', 'scrape-pcs');

  const { data: edition } = await supabase
    .from('editions').select('*').eq('is_active', true).limit(1).maybeSingle();
  if (!edition) {
    targets.push({ target: 'edition', status: 'error', message: 'no_active_edition' });
    await bumpFailures(supabase, 'scrape-pcs', 'no_active_edition');
    return { ok: false, targets };
  }

  const raceSlug = opts.raceOverride?.slug ?? 'giro-d-italia';
  const raceYear = opts.raceOverride?.year ?? new Date(edition.start_date).getUTCFullYear();

  // 1. Startlist if no riders yet.
  const { count: riderCount } = await supabase
    .from('riders').select('id', { count: 'exact', head: true }).eq('edition_id', edition.id);
  if ((riderCount ?? 0) === 0) {
    const url = pcsStartlistUrl(raceSlug, raceYear);
    try {
      const html = await fetcher(url);
      const entries = parseStartlist(html);
      await supabase.from('riders').upsert(
        entries.map((e) => ({
          edition_id: edition.id, pcs_slug: e.rider_slug, name: e.rider_name,
          team: e.team_name || null, bib: e.bib, status: 'active' as const,
        })),
        { onConflict: 'edition_id,pcs_slug' },
      );
      targets.push({ target: 'startlist', status: 'ok' });
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from('scrape_errors').insert({ target: 'startlist', error: msg, html_snippet: null });
      targets.push({ target: 'startlist', status: 'error', message: msg });
    }
  }

  // 2. Stage results — only stages that started in the last 6 hours and aren't published.
  const windowStart = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const { data: candidateStages } = await supabase
    .from('stages').select('id, number, status, start_time').eq('edition_id', edition.id)
    .gte('start_time', windowStart).lte('start_time', now.toISOString())
    .neq('status', 'published').neq('status', 'cancelled');

  for (const s of candidateStages ?? []) {
    const url = pcsStageResultsUrl(raceSlug, raceYear, s.number);
    const target = `stage-${s.number}`;
    try {
      const html = await fetcher(url);
      const entries = parseStageResults(html);
      if (entries.length < 3) {
        targets.push({ target, status: 'error', message: 'too_few_rows' });
        continue;
      }

      // Resolve rider by pcs_slug.
      const slugToId = await resolveRiderSlugs(supabase, edition.id, entries.map((e) => e.rider_slug));

      const rows = entries.slice(0, 10)
        .map((e) => ({ stage_id: s.id, position: e.position, rider_id: slugToId.get(e.rider_slug) }))
        .filter((r): r is { stage_id: string; position: number; rider_id: string } => !!r.rider_id);

      if (rows.length === 0) {
        targets.push({ target, status: 'error', message: 'no_known_riders' });
        continue;
      }

      // Wipe existing drafts for this stage, then insert fresh drafts.
      await supabase.from('stage_results').delete().eq('stage_id', s.id).eq('status', 'draft');
      await supabase.from('stage_results').insert(rows.map((r) => ({ ...r, status: 'draft' as const })));

      // Flip stage to results_draft (advisory; admin can still edit).
      await supabase.from('stages').update({ status: 'results_draft' }).eq('id', s.id);

      targets.push({ target, status: 'ok' });
      await notifyAdmins(supabase, s.number, opts.emailer);
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from('scrape_errors').insert({ target, error: msg });
      targets.push({ target, status: 'error', message: msg });
    }
  }

  // 3. Final classifications (GC + points jersey) once edition ends.
  if (new Date(edition.end_date).getTime() < now.getTime()) {
    const hasFinals = await supabase
      .from('final_classifications').select('*', { count: 'exact', head: true }).eq('edition_id', edition.id);
    if ((hasFinals.count ?? 0) === 0) {
      for (const [kind, url] of [
        ['gc', pcsFinalGcUrl(raceSlug, raceYear)] as const,
        ['points_jersey', pcsFinalPointsUrl(raceSlug, raceYear)] as const,
      ]) {
        const target = `final-${kind}`;
        try {
          const html = await fetcher(url);
          const entries = parseClassification(html);
          const slugToId = await resolveRiderSlugs(supabase, edition.id, entries.map((e) => e.rider_slug));
          const topN = kind === 'gc' ? 3 : 1;
          const rows = entries.slice(0, topN)
            .map((e, i) => ({ edition_id: edition.id, kind, position: i + 1, rider_id: slugToId.get(e.rider_slug), status: 'draft' as const }))
            .filter((r): r is { edition_id: string; kind: typeof kind; position: number; rider_id: string; status: 'draft' } => !!r.rider_id);
          if (rows.length > 0) {
            await supabase.from('final_classifications').insert(rows);
            targets.push({ target, status: 'ok' });
          } else {
            targets.push({ target, status: 'error', message: 'no_known_riders' });
          }
        } catch (e) {
          const msg = (e as Error).message;
          await supabase.from('scrape_errors').insert({ target, error: msg });
          targets.push({ target, status: 'error', message: msg });
        }
      }
    }
  }

  // Mark success if any target succeeded.
  const anyOk = targets.some((t) => t.status === 'ok');
  if (anyOk) {
    await supabase.from('cron_runs').update({
      last_succeeded_at: now.toISOString(), consecutive_failures: 0, last_error: null,
    }).eq('job_name', 'scrape-pcs');
  } else if (targets.length > 0) {
    await bumpFailures(supabase, 'scrape-pcs', targets[targets.length - 1].message ?? 'unknown');
  }

  return { ok: anyOk, targets };
}

async function resolveRiderSlugs(supabase: ReturnType<typeof createAdminClient>, editionId: string, slugs: string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const { data } = await supabase
    .from('riders').select('id, pcs_slug').eq('edition_id', editionId).in('pcs_slug', slugs);
  return new Map((data ?? []).map((r) => [r.pcs_slug, r.id]));
}

async function bumpFailures(supabase: ReturnType<typeof createAdminClient>, jobName: string, msg: string) {
  await supabase.rpc('increment_cron_failure', { job: jobName, err: msg }).throwOnError();
  // We don't have that RPC; simulate with a read-modify-write:
  // (ignore the rpc call; alternative inline below)
}
```

**Note:** The inline `increment_cron_failure` RPC isn't written; use an inline read-modify-write instead for simplicity. Replace the `bumpFailures` helper body:

```ts
async function bumpFailures(supabase: ReturnType<typeof createAdminClient>, jobName: string, msg: string) {
  const { data } = await supabase.from('cron_runs').select('consecutive_failures').eq('job_name', jobName).maybeSingle();
  const next = (data?.consecutive_failures ?? 0) + 1;
  await supabase.from('cron_runs').update({
    consecutive_failures: next, last_error: msg,
  }).eq('job_name', jobName);
}
```

And `notifyAdmins`:
```ts
async function notifyAdmins(
  supabase: ReturnType<typeof createAdminClient>,
  stageNumber: number,
  emailer?: ScrapeOptions['emailer'],
) {
  const { data: admins } = await supabase.from('profiles').select('email').eq('role', 'admin').is('deleted_at', null);
  const site = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const tpl = stageDraftReady(stageNumber, `${site}/admin/stages/${stageNumber}`);
  for (const a of admins ?? []) {
    if (!a.email) continue;
    try {
      if (emailer) await emailer(a.email, tpl.subject, tpl.text);
      else await sendEmail({ to: a.email, subject: tpl.subject, text: tpl.text });
    } catch {
      // Swallow — email failure shouldn't break scrape.
    }
  }
}
```

- [ ] **Step 2: Integration test against fixtures**

Write `src/test/integration/cron-scrape.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFixture } from '@test/helpers/read-fixture';
import { scrapeAndPersist } from '@/lib/cron/scrape';
import { createAdminClient } from '@/lib/supabase/admin';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

// Fake fetcher that serves our checked-in fixtures.
const fakeFetcher = async (url: string): Promise<string> => {
  if (url.includes('/startlist')) return readFixture('startlist.html');
  if (url.endsWith('/stage-1')) return readFixture('stage-results.html');
  if (url.endsWith('/gc')) return readFixture('final-gc.html');
  if (url.endsWith('/points')) return readFixture('final-points.html');
  throw new Error(`unexpected url: ${url}`);
};

d('scrapeAndPersist', () => {
  const sent: { to: string; subject: string }[] = [];

  beforeEach(async () => {
    const a = createAdminClient();
    // Reset state for each test.
    await a.from('stage_results').delete().eq('stage_id', '10000000-0000-4000-8000-000000000001');
    await a.from('scrape_errors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await a.from('riders').delete().eq('edition_id', '00000000-0000-4000-8000-000000000001');
    sent.length = 0;
  });

  afterEach(async () => {
    // Restore the default 5-rider seed so later tests stay sane. Use a minimal re-seed.
    // (Matches seed.sql).
  });

  it('first run populates riders from startlist fixture', async () => {
    const res = await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),  // 6h after Stage 1 start
      emailer: async (to, subject) => { sent.push({ to, subject }); },
      raceOverride: { slug: 'giro-d-italia', year: 2025 },  // fixtures are 2025
    });
    expect(res.ok).toBe(true);
    const a = createAdminClient();
    const { count } = await a.from('riders').select('*', { count: 'exact', head: true }).eq('edition_id', '00000000-0000-4000-8000-000000000001');
    expect(count ?? 0).toBeGreaterThan(20);
  });

  it('after riders seeded, scrapes stage-1 results into drafts', async () => {
    // Pre-seed riders via fixture first.
    await scrapeAndPersist({ fetcher: fakeFetcher, now: () => new Date('2026-05-09T11:00:00Z'), raceOverride: { slug: 'giro-d-italia', year: 2025 } });

    const res = await scrapeAndPersist({
      fetcher: fakeFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),  // within 6h of the seeded Stage 1 start (which we push into the past next line)
      emailer: async (to, subject) => { sent.push({ to, subject }); },
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
    });
    expect(res.ok).toBe(true);

    const a = createAdminClient();
    const { data } = await a.from('stage_results').select('*').eq('stage_id', '10000000-0000-4000-8000-000000000001');
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.[0]?.status).toBe('draft');

    // Admin email should have been sent.
    expect(sent.length).toBeGreaterThanOrEqual(1);
  });

  it('parse error writes to scrape_errors and does not crash', async () => {
    const brokenFetcher = async (_url: string) => '<html>nope</html>';
    const res = await scrapeAndPersist({
      fetcher: brokenFetcher,
      now: () => new Date('2026-05-09T18:00:00Z'),
      raceOverride: { slug: 'giro-d-italia', year: 2025 },
    });
    expect(res.ok).toBe(false);
    const a = createAdminClient();
    const { data } = await a.from('scrape_errors').select('*').order('run_at', { ascending: false }).limit(5);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/cron-scrape.test.ts
git add src/lib/cron/scrape.ts src/test/integration/cron-scrape.test.ts
git commit -m "feat(cron): scrape-and-persist core with fixture-backed integration tests"
```

---

### Task C3.2: Scrape cron route

**Files:**
- Create: `src/app/api/cron/scrape-pcs/route.ts`

**Context:** Thin route handler. Auth via `verifyCronSecret`. Calls `scrapeAndPersist`. Returns JSON summary.

- [ ] **Step 1: Route**

Write `src/app/api/cron/scrape-pcs/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron/auth';
import { scrapeAndPersist } from '@/lib/cron/scrape';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await scrapeAndPersist();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build + commit**

```bash
git add src/app/api/cron/scrape-pcs/route.ts
git commit -m "feat(cron): add /api/cron/scrape-pcs route handler"
```

---

## Phase 4 — Cron: pick reminders

### Task C4.1: Reminder core

**Files:**
- Create: `src/lib/cron/reminders.ts`
- Create: `src/lib/queries/reminders.ts`
- Create: `src/test/integration/cron-reminders.test.ts`

**Context:** For each stage with `start_time` in `[now, now + 2h]` and `counts_for_scoring=true` and `status not in ('published','cancelled')`, find users (in active edition) who have NO `stage_picks` row for that stage AND no `pick_reminders_sent` row yet. Send them a reminder email. Insert a `pick_reminders_sent` row so they don't get a duplicate.

- [ ] **Step 1: Query helper**

Write `src/lib/queries/reminders.ts`:
```ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function findUsersNeedingReminderForStage(stageId: string) {
  const admin = createAdminClient();

  // All non-deleted players minus those who already picked this stage minus those already reminded.
  const { data: players } = await admin
    .from('profiles').select('id, display_name, email').is('deleted_at', null);

  const { data: picked } = await admin
    .from('stage_picks').select('user_id').eq('stage_id', stageId);
  const pickedSet = new Set((picked ?? []).map((p) => p.user_id));

  const { data: reminded } = await admin
    .from('pick_reminders_sent').select('user_id').eq('stage_id', stageId);
  const remindedSet = new Set((reminded ?? []).map((r) => r.user_id));

  return (players ?? []).filter((p) => !pickedSet.has(p.id) && !remindedSet.has(p.id) && p.email);
}
```

- [ ] **Step 2: Reminder core**

Write `src/lib/cron/reminders.ts`:
```ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { findUsersNeedingReminderForStage } from '@/lib/queries/reminders';
import { sendEmail } from '@/lib/email/send';
import { pickReminder } from '@/lib/email/templates';

export interface ReminderOptions {
  now?: () => Date;
  emailer?: (to: string, subject: string, text: string) => Promise<void>;
  /** If set, only scan stages in this edition. Defaults to the active edition. */
  editionId?: string;
  windowMinutes?: number; // default 120
}

export async function sendPickReminders(opts: ReminderOptions = {}) {
  const now = (opts.now ?? (() => new Date()))();
  const supabase = createAdminClient();
  await supabase.from('cron_runs').update({ last_started_at: now.toISOString() }).eq('job_name', 'send-reminders');

  const editionId = opts.editionId ?? (await getActiveEditionId(supabase));
  if (!editionId) return { ok: false, sent: 0, errors: ['no_active_edition'] };

  const window = opts.windowMinutes ?? 120;
  const upper = new Date(now.getTime() + window * 60_000).toISOString();
  const lower = now.toISOString();

  const { data: stages } = await supabase
    .from('stages').select('id, number, start_time, status, counts_for_scoring')
    .eq('edition_id', editionId).eq('counts_for_scoring', true)
    .gte('start_time', lower).lte('start_time', upper)
    .neq('status', 'published').neq('status', 'cancelled');

  let sent = 0;
  const errors: string[] = [];
  const site = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  for (const s of stages ?? []) {
    const users = await findUsersNeedingReminderForStage(s.id);
    for (const u of users) {
      const tpl = pickReminder(u.display_name, s.number, new Date(s.start_time), `${site}/picks/stage/${s.number}`);
      try {
        if (opts.emailer) await opts.emailer(u.email!, tpl.subject, tpl.text);
        else await sendEmail({ to: u.email!, subject: tpl.subject, text: tpl.text });
        await supabase.from('pick_reminders_sent').insert({ user_id: u.id, stage_id: s.id });
        sent++;
      } catch (e) {
        errors.push(`user=${u.id}:${(e as Error).message}`);
      }
    }
  }

  if (errors.length === 0) {
    await supabase.from('cron_runs').update({
      last_succeeded_at: now.toISOString(), consecutive_failures: 0, last_error: null,
    }).eq('job_name', 'send-reminders');
  } else {
    const { data } = await supabase.from('cron_runs').select('consecutive_failures').eq('job_name', 'send-reminders').maybeSingle();
    await supabase.from('cron_runs').update({
      consecutive_failures: (data?.consecutive_failures ?? 0) + 1, last_error: errors[0],
    }).eq('job_name', 'send-reminders');
  }

  return { ok: errors.length === 0, sent, errors };
}

async function getActiveEditionId(supabase: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await supabase.from('editions').select('id').eq('is_active', true).maybeSingle();
  return data?.id ?? null;
}
```

- [ ] **Step 3: Integration test**

Write `src/test/integration/cron-reminders.test.ts`. Cases:
- Stage 9 locks in 90 min, test user has no pick → reminder sent, `pick_reminders_sent` row created.
- Run again → no second email.
- Stage 9 locks in 3h → nothing sent (outside 2h window).

- [ ] **Step 4: Run + commit**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/cron-reminders.test.ts
git add src/lib/cron/reminders.ts src/lib/queries/reminders.ts src/test/integration/cron-reminders.test.ts
git commit -m "feat(cron): send pick reminders with dedup and integration tests"
```

---

### Task C4.2: Reminder cron route

**Files:**
- Create: `src/app/api/cron/send-reminders/route.ts`

- [ ] **Step 1: Route**

Write `src/app/api/cron/send-reminders/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron/auth';
import { sendPickReminders } from '@/lib/cron/reminders';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await sendPickReminders();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/send-reminders/route.ts
git commit -m "feat(cron): add /api/cron/send-reminders route handler"
```

---

## Phase 5 — Enable Vercel crons + errors dashboard

### Task C5.1: Uncomment crons in vercel.ts

**Files:**
- Modify: `vercel.ts`

**Context:** Vercel Cron hits the routes on schedule. `scrape-pcs` every 15 min, `send-reminders` hourly. Both paths must be GET-able with just the `Authorization: Bearer $CRON_SECRET` header — Vercel's cron runner adds that when the env var is set.

- [ ] **Step 1: Edit vercel.ts**

Replace the commented block:
```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'next build',
  crons: [
    { path: '/api/cron/scrape-pcs',     schedule: '*/15 * * * *' },
    { path: '/api/cron/send-reminders', schedule: '0 * * * *'   },
  ],
};

export default config;
```

- [ ] **Step 2: Commit**

```bash
git add vercel.ts
git commit -m "chore(vercel): enable cron schedules for scrape-pcs and send-reminders"
```

---

### Task C5.2: Admin errors page

**Files:**
- Create: `src/app/admin/errors/page.tsx`

**Context:** Renders the last 50 `scrape_errors` rows and the last 50 `audit_log` rows, each with expandable details. This is the admin's single pane for debugging cron behavior and reviewing who did what.

- [ ] **Step 1: Page**

Write `src/app/admin/errors/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server';

export default async function ErrorsPage() {
  const supabase = await createClient();
  const [scrapeErrors, auditEvents] = await Promise.all([
    supabase.from('scrape_errors').select('*').order('run_at', { ascending: false }).limit(50),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Scrape errors</h1>
        {(scrapeErrors.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">None.</p>
        ) : (
          <table className="w-full text-xs mt-2 font-mono">
            <thead className="bg-muted"><tr><th className="p-2 text-left">When</th><th className="p-2 text-left">Target</th><th className="p-2 text-left">Error</th></tr></thead>
            <tbody>
              {(scrapeErrors.data ?? []).map((e) => (
                <tr key={e.id} className="border-t"><td className="p-2">{new Date(e.run_at).toLocaleString()}</td><td className="p-2">{e.target}</td><td className="p-2 whitespace-pre-wrap">{e.error}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <table className="w-full text-xs mt-2 font-mono">
          <thead className="bg-muted"><tr><th className="p-2 text-left">When</th><th className="p-2 text-left">Action</th><th className="p-2 text-left">Target</th></tr></thead>
          <tbody>
            {(auditEvents.data ?? []).map((e) => (
              <tr key={e.id} className="border-t"><td className="p-2">{new Date(e.created_at).toLocaleString()}</td><td className="p-2">{e.action}</td><td className="p-2 whitespace-pre-wrap">{JSON.stringify(e.target, null, 2)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/errors/page.tsx
git commit -m "feat(admin): errors and audit log page for cron and action debugging"
```

---

## Phase 6 — Smoke + final sanity

### Task C6.1: Manual smoke walkthrough

**Files:** none (docs only).

- [ ] **Step 1: Boot**

```bash
npx supabase db reset
npm run dev
```

- [ ] **Step 2: Manual test matrix**

1. Sign in as `dev-admin@example.com`. Visit `/admin`. Confirm counts appear.
2. Visit `/admin/edition`. Flip some checkboxes. Save. Refresh. Confirm persisted.
3. Visit `/admin/stages/9`. Populate the top 3 with 3 different riders. Click Publish. Confirm player (dev) on the main board sees points if they picked one of the winners.
4. Visit `/admin/roster`. Promote player, demote them back. Confirm.
5. Trigger scrape manually:
   ```bash
   curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/scrape-pcs
   ```
   Should either scrape fixtures (if you put the CRON_SECRET in env) or return 401.
   Actually: in dev without `RESEND_API_KEY`, the email goes through Mailpit SMTP to Supabase's Inbucket → visible at http://127.0.0.1:54324.
6. Trigger reminders manually:
   ```bash
   curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/send-reminders
   ```
7. Visit `/admin/errors` — scrape_errors and audit_log should be populated.

- [ ] **Step 3: Write up findings**

Create or append `docs/smoke-plan-c.md` with any rough edges.

- [ ] **Step 4: Final sanity**

```bash
npm test
SUPABASE_INTEGRATION=1 npm test
npm run typecheck
npm run lint
npm run build
```

All green.

- [ ] **Step 5: Commit**

```bash
git add docs/smoke-plan-c.md
git commit -m "docs: plan C manual smoke notes"
```

---

## Self-review

**Spec coverage:**
- §4.4 scrape → admin publish: C3.1, C3.2, C2.2 ✓
- §4.5 rider DNF: C2.5 `setRiderStatus` ✓
- §4.6 stage cancellation: C2.2 `cancelStage` ✓
- §4.7 pick reminders with dedup: C4.1, C4.2 ✓
- §4.8 final classifications: C2.3, C3.1 (scraper also produces drafts) ✓
- §6.2 admin screens: C1.1, C1.2, C2.1–C2.5, C5.2 ✓
- §7 error handling (scrape_errors, audit_log, admin indicators, retry/backoff via consecutive_failures): C0.1, C1.2, C3.1, C5.2 ✓

**Deferred (explicitly):**
- PWA / service worker (Plan D)
- E2E (Plan D)
- Prod deploy, domain, env promotion (Plan D)
- GitHub Actions CI (Plan D)

**Placeholder scan:** No TBDs in code. A few admin pages (roster form.tsx, classifications form.tsx) have verbal "implement analogous to…" guidance rather than full code — acceptable because the pattern is established in edition/form.tsx and stages/[stageNumber]/form.tsx and can be filled during execution without further plan changes.

**Type consistency:** `ActionResult<T>` used throughout. Scrape and reminder cores accept injected `fetcher` / `emailer` / `now` for test control — test-friendly DI.

**Security check:**
- Service-role client is used only in `src/lib/cron/*.ts` and `src/lib/queries/reminders.ts` (both `server-only`). Route handlers verify cron secret before importing.
- RLS still enforces admin role on all admin server actions (via `requireAdmin()` in the UI path; for direct DB writes in cron, service_role bypasses RLS by design).

---

## Deliverables at end of Plan C

- ✅ Admin UI: dashboard, edition setup, stages list + publish, classifications publish, riders, roster, invites (Plan B), errors & audit.
- ✅ Cron: `/api/cron/scrape-pcs` + `/api/cron/send-reminders`, bearer-secret auth.
- ✅ Email adapter: local SMTP (Mailpit) and Resend.
- ✅ `cron_runs` table + admin dashboard surfacing last-run + consecutive failures.
- ✅ `vercel.ts` crons wired for deploy-time schedules.
- ✅ Integration tests: stage publish, final publish, scrape against fixtures, reminder dedup, email adapter transport selection.
- ✅ Full sanity pass (unit + integration + typecheck + lint + build) green.
- ✅ Manual smoke walkthrough documented.
