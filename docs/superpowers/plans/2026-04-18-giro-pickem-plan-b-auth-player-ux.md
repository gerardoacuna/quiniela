# Quiniela Giro Pickem — Plan B: Auth & Player UX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Supabase magic-link authentication, build the full player experience (Home / Picks / Board / Me), and land the three pick-submission server actions so an authenticated user can play the full flow locally against the Supabase dev stack.

**Architecture:** Next.js 16 App Router with Supabase SSR cookies. Authenticated routes live under a `(app)` route group gated by middleware + a server-rendered layout guard. Server Actions handle all writes with RLS-aware Supabase clients and reuse the pure-logic validators from Plan A. shadcn/ui + Tailwind for component primitives. Real integration tests run against the locally-running Supabase stack.

**Tech stack (continuing from Plan A):** Next.js 16, TypeScript, `@supabase/ssr`, `@supabase/supabase-js`, shadcn/ui, Tailwind v4, Vitest, cheerio (already installed).

**Reference spec:** `docs/superpowers/specs/2026-04-17-giro-pickem-design.md` (especially §§4.1–4.3, §6.1)

**Reference completed plan:** `docs/superpowers/plans/2026-04-17-giro-pickem-plan-a-foundation.md`

**Commit policy:** One commit per task (revert to normal TDD cadence — Phase 0 single-commit rule from Plan A does not apply).

**What is NOT in Plan B** (stays in Plan C/D):
- Admin UI beyond a minimal invite-generation form (needed so we can test signup end-to-end).
- PCS scraper cron route (Plan C).
- Reminder emails (Plan C).
- Publish-results admin flow — but Plan B *does* seed published results for one stage so the leaderboard has visible data.
- PWA manifest, service worker (Plan D).
- Playwright specs (Plan D).

---

## File structure created by Plan B

```
quiniela/
├── middleware.ts                                          (new)
├── components.json                                        (shadcn config, new)
├── supabase/
│   └── seed.sql                                           (extended: dev admin + invite + published results)
├── src/
│   ├── app/
│   │   ├── layout.tsx                                     (replaced: Inter font, Toaster)
│   │   ├── page.tsx                                       (replaced: redirect to /home or /sign-in)
│   │   ├── globals.css                                    (extended: shadcn tokens)
│   │   ├── sign-in/
│   │   │   └── page.tsx                                   (new: magic-link request form)
│   │   ├── auth/
│   │   │   └── callback/route.ts                          (new)
│   │   ├── onboarding/
│   │   │   ├── page.tsx                                   (new: display name form)
│   │   │   └── actions.ts                                 (new: completeOnboarding)
│   │   ├── (app)/
│   │   │   ├── layout.tsx                                 (new: auth guard + bottom tabs)
│   │   │   ├── home/page.tsx                              (new: next-stage card + top-5 leaderboard)
│   │   │   ├── picks/
│   │   │   │   ├── page.tsx                               (new: list of counted stages + GC + Jersey)
│   │   │   │   ├── stage/[stageNumber]/page.tsx           (new: rider picker for one stage)
│   │   │   │   ├── gc/page.tsx                            (new: GC top-3 picker)
│   │   │   │   └── jersey/page.tsx                        (new: jersey picker)
│   │   │   ├── board/page.tsx                             (new: full leaderboard)
│   │   │   ├── me/page.tsx                                (new: profile + pick recap + sign out)
│   │   │   └── stage/[stageNumber]/page.tsx               (new: post-lock detail with everyone's picks)
│   │   └── admin/
│   │       └── invites/
│   │           ├── page.tsx                               (new: MINIMAL admin invite generator)
│   │           └── actions.ts                             (new: generateInvite action)
│   ├── components/
│   │   ├── ui/                                            (shadcn primitives: button, card, input, label, sheet, badge, separator)
│   │   ├── bottom-tabs.tsx                                (new)
│   │   ├── countdown-badge.tsx                            (new)
│   │   ├── rider-picker.tsx                               (new: client component)
│   │   ├── leaderboard-table.tsx                          (new)
│   │   └── sign-out-button.tsx                            (new)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                                  (new: browser)
│   │   │   ├── server.ts                                  (new: server components + actions)
│   │   │   └── admin.ts                                   (new: service-role, server-only)
│   │   ├── actions/
│   │   │   ├── result.ts                                  (new: ActionResult discriminated union)
│   │   │   ├── picks.ts                                   (new: submitStagePick, submitGcPicks, submitJerseyPick)
│   │   │   └── invites.ts                                 (new: generateInvite helper)
│   │   ├── auth/
│   │   │   └── require-user.ts                            (new: getServerUser helper + profile fetch)
│   │   ├── time/
│   │   │   └── countdown.ts                               (new: formatCountdown util + tests)
│   │   └── queries/
│   │       ├── stages.ts                                  (new: listCountedStages, getStageWithResults)
│   │       ├── picks.ts                                   (new: getUserStagePicks, getUserGcPicks, getUserJerseyPick)
│   │       ├── riders.ts                                  (new: listActiveRiders)
│   │       └── leaderboard.ts                             (new: getLeaderboard)
│   └── test/
│       ├── integration/
│       │   ├── helpers.ts                                 (new: test-user factory using admin client)
│       │   ├── submit-stage-pick.test.ts                  (new)
│       │   ├── submit-gc-picks.test.ts                    (new)
│       │   ├── no-reuse-enforcement.test.ts               (new)
│       │   ├── rls-denials.test.ts                        (new)
│       │   └── leaderboard-flow.test.ts                   (new)
│       └── fixtures/
│           └── (unchanged from Plan A)
```

---

## Phase 0 — Auth infrastructure

### Task B0.1: Supabase browser and server clients

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`

**Context:** `@supabase/ssr` (already in deps) provides the canonical way to wire Supabase into Next App Router. Three clients:
- `client.ts` — browser runtime, reads anon key, runs in client components.
- `server.ts` — server runtime, reads cookies via `next/headers`, used by server components + server actions.
- `admin.ts` — service-role, bypasses RLS, **must only be imported from server-only modules**. Used for bootstrapping (onboarding, invite lookup) where RLS would otherwise lock us out.

- [ ] **Step 1: Browser client**

Write `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Server client**

Write `src/lib/supabase/server.ts`:
```ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: Next.js forbids set here.
            // Middleware will refresh the session; this is expected.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Admin (service-role) client**

Write `src/lib/supabase/admin.ts`:
```ts
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

Install the `server-only` package: `npm install server-only`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/ package.json package-lock.json
git commit -m "feat(auth): add Supabase browser, server, and admin clients"
```

---

### Task B0.2: Middleware for session refresh

**Files:**
- Create: `middleware.ts` (repo root)

**Context:** Supabase SSR requires middleware to refresh the session on every request before Server Components read cookies. Without this, the first request after token expiry would see a stale session.

- [ ] **Step 1: Write middleware**

Write `middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session (writes new cookies if it expired).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): add middleware to refresh Supabase session on every request"
```

---

### Task B0.3: Server-side auth helper

**Files:**
- Create: `src/lib/auth/require-user.ts`

**Context:** Server components and actions need a uniform way to (a) fetch the current user or (b) redirect to sign-in if there isn't one. Centralizing avoids boilerplate.

- [ ] **Step 1: Write helper**

Write `src/lib/auth/require-user.ts`:
```ts
import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function getServerUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getServerUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function requireProfile(): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getServerUser>>>; profile: ProfileRow }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!profile || profile.deleted_at) redirect('/onboarding');
  return { user, profile };
}

export async function requireAdmin() {
  const { user, profile } = await requireProfile();
  if (profile.role !== 'admin') redirect('/home');
  return { user, profile };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/require-user.ts
git commit -m "feat(auth): add requireUser/requireProfile/requireAdmin server helpers"
```

---

### Task B0.4: Sign-in page + magic link form

**Files:**
- Create: `src/app/sign-in/page.tsx`

**Context:** Simple form: user enters email, clicks button, we call `supabase.auth.signInWithOtp({ email })`. Supabase sends a magic link that goes to `/auth/callback?code=...`. For invite-required signup, we also check that an unused, unexpired invite exists for this email before sending the link; otherwise show "Ask an admin for an invite."

- [ ] **Step 1: Write page**

Write `src/app/sign-in/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setStatus({ error: error.message });
    else setStatus('sent');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Quiniela Giro</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email address you were invited with. We&apos;ll send you a sign-in link.
        </p>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={status === 'sending' || status === 'sent'}
          className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Check your inbox' : 'Send magic link'}
        </button>
        {typeof status === 'object' && 'error' in status && (
          <p className="text-sm text-red-600">{status.error}</p>
        )}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`. Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/sign-in/page.tsx
git commit -m "feat(auth): add sign-in page with magic-link request"
```

---

### Task B0.5: Auth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

**Context:** Supabase redirects here with `?code=...` after the user clicks the magic link. We exchange the code for a session (which writes cookies), then redirect based on profile state: no profile → `/onboarding`; otherwise → `/home`.

- [ ] **Step 1: Write route**

Write `src/app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  // Check profile state.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/sign-in?error=no_user`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, deleted_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.deleted_at) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}/home`);
}
```

- [ ] **Step 2: Build + typecheck**

Run: `npm run build && npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): add auth callback route that exchanges code and routes by profile state"
```

---

### Task B0.6: Onboarding (display name + invite claim)

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/actions.ts`

**Context:** First-time users land here after the magic link. We collect a display name, verify an invite exists for their email (admin client, since no profile means no RLS access to `invites` yet), mark the invite used, and create their profile. Subsequent sign-ins of the same email skip this page entirely.

- [ ] **Step 1: Write action**

Write `src/app/onboarding/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/actions/result';

const schema = z.object({
  displayName: z.string().trim().min(2).max(40),
});

export async function completeOnboarding(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ displayName: formData.get('displayName') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const user = await requireUser();
  const email = user.email ?? '';
  if (!email) return { ok: false, error: 'no_email_on_user' };

  const admin = createAdminClient();

  // Find a valid unused invite for this email.
  const { data: invite, error: inviteErr } = await admin
    .from('invites')
    .select('code, used_at, expires_at')
    .eq('email', email)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inviteErr) return { ok: false, error: inviteErr.message };
  if (!invite) return { ok: false, error: 'no_valid_invite' };

  // Create profile + mark invite used in parallel; tolerate duplicate-profile error on retry.
  const [profileRes, inviteRes] = await Promise.all([
    admin.from('profiles').insert({
      id: user.id,
      display_name: parsed.data.displayName,
      email,
      role: 'player',
    }),
    admin.from('invites').update({ used_at: new Date().toISOString() }).eq('code', invite.code),
  ]);

  if (profileRes.error && profileRes.error.code !== '23505') {
    return { ok: false, error: profileRes.error.message };
  }
  if (inviteRes.error) return { ok: false, error: inviteRes.error.message };

  redirect('/home');
}
```

- [ ] **Step 2: Write page**

Write `src/app/onboarding/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { completeOnboarding } from './actions';
import { OnboardingForm } from './form';

export default async function OnboardingPage() {
  const user = await getServerUser();
  if (!user) redirect('/sign-in');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) redirect('/home');

  return <OnboardingForm email={user.email ?? ''} action={completeOnboarding} />;
}
```

Also create `src/app/onboarding/form.tsx` (client component for the form with useActionState):
```tsx
'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/actions/result';

export function OnboardingForm({
  email,
  action,
}: {
  email: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="text-sm text-muted-foreground">Pick a display name for the leaderboard.</p>
        <p className="text-xs text-muted-foreground">Signed in as {email}</p>
        <input
          type="text"
          name="displayName"
          required
          minLength={2}
          maxLength={40}
          placeholder="Jerry"
          className="w-full border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Continue'}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 3: ActionResult type (prerequisite — create if it doesn't exist)**

Create `src/lib/actions/result.ts`:
```ts
export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```

- [ ] **Step 4: Build**

Run: `npm run build`. Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/result.ts src/app/onboarding/
git commit -m "feat(auth): add onboarding page that claims invite and creates profile"
```

---

### Task B0.7: Dev admin + invite + published Stage 1 seed

**Files:**
- Modify: `supabase/seed.sql`

**Context:** To demo the full flow locally we need: a dev admin user, a seeded invite for that admin to generate more invites, a fresh player invite, and published Stage 1 results so the leaderboard has data. Seed creates an auth user directly via `auth.admin_create_user`-equivalent SQL (Supabase supports inserting into `auth.users` with a hashed password from seed context, or we can generate a known user via `gen_random_uuid`).

Supabase's seed runs as service-role, so we can insert into `auth.users` directly.

- [ ] **Step 1: Extend seed**

Append to `supabase/seed.sql`:
```sql
-- Dev auth users (password auth: bypass email flow for local dev).
-- The auth.users row needs encrypted_password. We use a fixed password 'devpass123' bcrypt-hashed.
-- Hash generated with: node -e "require('bcryptjs').hash('devpass123',10).then(console.log)"
-- (Supabase CLI ships with bcrypt-compatible crypt extension.)

insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role, instance_id, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000001', 'dev-admin@example.com', crypt('devpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000002', 'dev-player@example.com', crypt('devpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

-- Profiles for both.
insert into public.profiles (id, display_name, role, email) values
  ('30000000-0000-0000-0000-000000000001', 'Admin (dev)',  'admin',  'dev-admin@example.com'),
  ('30000000-0000-0000-0000-000000000002', 'Player (dev)', 'player', 'dev-player@example.com')
on conflict (id) do nothing;

-- Invite for local testing of the onboarding flow (use a fresh email).
insert into public.invites (code, created_by, email, expires_at) values
  ('dev-invite-0001', '30000000-0000-0000-0000-000000000001', 'dev-invitee@example.com', now() + interval '7 days')
on conflict (code) do nothing;

-- Move Stage 1 into the past so it's "locked" for UX testing.
update public.stages set
  start_time = now() - interval '1 day',
  status = 'published'
where id = '10000000-0000-0000-0000-000000000001';

-- Published top-10 for Stage 1 so leaderboard has data.
-- Uses the 5 seeded riders cycled through positions with a couple of null gaps.
insert into public.stage_results (stage_id, position, rider_id, status) values
  ('10000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-000000000001', 'published'),  -- Pogacar (1st -> 25pts)
  ('10000000-0000-0000-0000-000000000001', 2, '20000000-0000-0000-0000-000000000002', 'published'),  -- Ayuso   (2nd -> 15pts)
  ('10000000-0000-0000-0000-000000000001', 3, '20000000-0000-0000-0000-000000000003', 'published'),  -- Evenepoel (3rd -> 10pts)
  ('10000000-0000-0000-0000-000000000001', 4, '20000000-0000-0000-0000-000000000004', 'published'),  -- Roglic  (4th -> 8pts)
  ('10000000-0000-0000-0000-000000000001', 5, '20000000-0000-0000-0000-000000000005', 'published')   -- Ganna   (5th -> 6pts)
on conflict (stage_id, position) do nothing;

-- Give the dev player a Stage 1 pick so leaderboard shows them scoring.
insert into public.stage_picks (user_id, stage_id, rider_id) values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')
on conflict (user_id, stage_id) do nothing;
```

- [ ] **Step 2: Apply + verify**

Run:
```bash
npx supabase db reset
npx supabase db query "select count(*) from auth.users where email like 'dev-%'"
npx supabase db query "select user_id, display_name, total_points, exact_winners_count from public.leaderboard_view order by total_points desc limit 5"
```

Expected: 2 dev users. Leaderboard shows Player (dev) with 25 total, 1 exact winner; Admin (dev) with 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(seed): add dev admin/player users, invite, and published Stage 1 results"
```

---

## Phase 1 — Layout, navigation, shadcn/ui

### Task B1.1: Initialize shadcn/ui

**Files:**
- Create: `components.json`
- Modify: `src/app/globals.css` (shadcn tokens)
- Create: `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `separator.tsx`

**Context:** shadcn/ui drops components into your repo (you own them). We install the ones we actually need for Plan B. Pick the `new-york` style, `slate` base color, CSS variables.

- [ ] **Step 1: Run shadcn init**

Run:
```bash
npx shadcn@latest init -y --style new-york --base-color slate --cssVars yes
```

If prompted for more, accept defaults. This creates `components.json` and rewrites `globals.css` with shadcn tokens.

- [ ] **Step 2: Add the 6 primitives we need**

Run:
```bash
npx shadcn@latest add button card input label badge separator
```

- [ ] **Step 3: Verify build**

Run: `npm run build`. Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add components.json src/app/globals.css src/components/ui/ src/lib/utils.ts package.json package-lock.json
git commit -m "chore(ui): init shadcn/ui and add button/card/input/label/badge/separator"
```

---

### Task B1.2: Root layout with Inter font

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace root layout**

Write `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Quiniela Giro',
  description: 'Giro d\u2019Italia pickem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-background text-foreground">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace root page with redirect**

Write `src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/require-user';

export default async function RootPage() {
  const user = await getServerUser();
  redirect(user ? '/home' : '/sign-in');
}
```

- [ ] **Step 3: Build**

Run: `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat(layout): wire Inter font and redirect root to /home or /sign-in"
```

---

### Task B1.3: Authed route group layout + bottom tabs

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/bottom-tabs.tsx`
- Create: `src/app/(app)/home/page.tsx` (placeholder)
- Create: `src/app/(app)/picks/page.tsx` (placeholder)
- Create: `src/app/(app)/board/page.tsx` (placeholder)
- Create: `src/app/(app)/me/page.tsx` (placeholder)

**Context:** The `(app)` route group wraps all authenticated player routes with a guard + tab bar, while `/sign-in`, `/onboarding`, `/admin/*`, `/auth/callback` live outside and don't get the tab bar.

- [ ] **Step 1: Bottom tabs component**

Write `src/components/bottom-tabs.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/picks', label: 'Picks', Icon: List },
  { href: '/board', label: 'Board', Icon: Trophy },
  { href: '/me', label: 'Me', Icon: User },
];

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ul className="mx-auto max-w-md grid grid-cols-4">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center py-3 text-xs ${
                  active ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

Install `lucide-react`:
```bash
npm install lucide-react
```

- [ ] **Step 2: App layout with guard**

Write `src/app/(app)/layout.tsx`:
```tsx
import { requireProfile } from '@/lib/auth/require-user';
import { BottomTabs } from '@/components/bottom-tabs';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto max-w-md">{children}</main>
      <BottomTabs />
    </div>
  );
}
```

- [ ] **Step 3: Placeholder pages**

Create 4 files, each with identical shape (adjust title):

`src/app/(app)/home/page.tsx`:
```tsx
export default function HomePage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Home</h1><p className="text-muted-foreground">Placeholder — filled in by Task B4.1</p></div>;
}
```

Same for `picks/page.tsx`, `board/page.tsx`, `me/page.tsx` (change title).

- [ ] **Step 4: Build + start dev server + smoke test**

Run: `npm run build`. Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/ src/components/bottom-tabs.tsx package.json package-lock.json
git commit -m "feat(layout): add (app) route group with auth guard, bottom tabs, placeholder pages"
```

---

## Phase 2 — Pure query helpers + server actions

### Task B2.1: Query helpers (stages, picks, riders, leaderboard)

**Files:**
- Create: `src/lib/queries/stages.ts`
- Create: `src/lib/queries/picks.ts`
- Create: `src/lib/queries/riders.ts`
- Create: `src/lib/queries/leaderboard.ts`

**Context:** Each query is a thin typed wrapper around Supabase's `.from().select()`. Server components import from these instead of reaching into Supabase directly, giving us one place to evolve query shapes and letting Plan C swap in prepared RPCs if needed.

- [ ] **Step 1: stages.ts**

Write `src/lib/queries/stages.ts`:
```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

export type StageRow = Database['public']['Tables']['stages']['Row'];
export type StageResultRow = Database['public']['Tables']['stage_results']['Row'];

export async function getActiveEdition() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCountedStages(editionId: string): Promise<StageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('edition_id', editionId)
    .eq('counts_for_scoring', true)
    .order('number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getStageByNumber(editionId: string, number: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('edition_id', editionId)
    .eq('number', number)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublishedStageResults(stageId: string): Promise<StageResultRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_results')
    .select('*')
    .eq('stage_id', stageId)
    .eq('status', 'published')
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: picks.ts**

Write `src/lib/queries/picks.ts`:
```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getUserStagePicks(userId: string, editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_picks')
    .select('id, stage_id, rider_id, created_at, updated_at, stages!inner(number, status, start_time, edition_id)')
    .eq('user_id', userId)
    .eq('stages.edition_id', editionId);
  if (error) throw error;
  return data ?? [];
}

export async function getUserGcPicks(userId: string, editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gc_picks')
    .select('*')
    .eq('user_id', userId)
    .eq('edition_id', editionId)
    .order('position');
  if (error) throw error;
  return data ?? [];
}

export async function getUserJerseyPick(userId: string, editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('points_jersey_picks')
    .select('*')
    .eq('user_id', userId)
    .eq('edition_id', editionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStagePicksForStage(stageId: string) {
  // Only callable when stage.start_time <= now() due to RLS — used by post-lock detail view.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_picks')
    .select('user_id, rider_id, profiles!inner(display_name), riders!inner(name, pcs_slug)')
    .eq('stage_id', stageId);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 3: riders.ts**

Write `src/lib/queries/riders.ts`:
```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function listActiveRiders(editionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('riders')
    .select('id, name, team, bib, pcs_slug, status')
    .eq('edition_id', editionId)
    .order('bib', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 4: leaderboard.ts**

Write `src/lib/queries/leaderboard.ts`:
```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { assignRanks, type LeaderboardRow } from '@/lib/scoring';

export async function getLeaderboard(): Promise<ReturnType<typeof assignRanks>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('*')
    .order('total_points', { ascending: false })
    .order('exact_winners_count', { ascending: false });
  if (error) throw error;
  return assignRanks((data ?? []).filter((r): r is LeaderboardRow => !!r.user_id && !!r.edition_id && !!r.display_name) as LeaderboardRow[]);
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`. If the leaderboard view's generated types make columns nullable, tighten the filter in `getLeaderboard` to satisfy the `LeaderboardRow` non-nullable fields. (Views in Postgres are frequently typed as all-nullable by Supabase's codegen.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/
git commit -m "feat(queries): add stages/picks/riders/leaderboard query helpers"
```

---

### Task B2.2: submitStagePick server action (TDD)

**Files:**
- Create: `src/lib/actions/picks.ts`
- Create: `src/test/integration/submit-stage-pick.test.ts`
- Create: `src/test/integration/helpers.ts`

**Context:** The action must:
1. Require an authenticated user.
2. Validate input with Zod.
3. Load the stage — reject if stage already locked (`start_time <= now()`) or cancelled.
4. Load the rider — reject if not active or wrong edition.
5. Load all of the user's existing picks → run `validateNoReuse` → reject if conflict.
6. Upsert the pick.
7. Return `ActionResult<{ stagePickId: string }>`.

Integration test runs against the live local Supabase with a seeded test user.

- [ ] **Step 1: Test helpers**

Write `src/test/integration/helpers.ts`:
```ts
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

/**
 * Creates a fresh auth user + profile and returns a server client authenticated as them,
 * plus a cleanup function.
 */
export async function createTestUser(role: 'player' | 'admin' = 'player') {
  const admin = createAdminClient();
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'test-password-123';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error('no user created');

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    display_name: `Test ${created.user.id.slice(0, 6)}`,
    role,
    email,
  });
  if (profileErr) throw profileErr;

  // Sign in to get an access token.
  const { data: sess, error: sessErr } = await admin.auth.admin.generateLink({
    type: 'magiclink', email,
  });
  if (sessErr) throw sessErr;

  return {
    userId: created.user.id,
    email,
    cleanup: async () => {
      await admin.from('profiles').delete().eq('id', created.user!.id);
      await admin.auth.admin.deleteUser(created.user!.id);
    },
  };
}

/** Upsert stage start_time/status for a test; returns stage row. */
export async function setStageState(stageId: string, state: {
  start_time?: string | null;
  status?: Database['public']['Enums']['stage_status'];
  counts_for_scoring?: boolean;
  double_points?: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('stages').update(state).eq('id', stageId);
  if (error) throw error;
}
```

- [ ] **Step 2: Write integration test**

Create `vitest.integration.config.ts` or extend the default config to include integration tests. For simplicity: add an env-gated describe that only runs when `SUPABASE_INTEGRATION=1`.

Write `src/test/integration/submit-stage-pick.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { submitStagePick } from '@/lib/actions/picks';
import { createTestUser, setStageState } from './helpers';

const STAGE_9 = '10000000-0000-0000-0000-000000000002'; // double-points, upcoming per seed
const RIDER_POGACAR = '20000000-0000-0000-0000-000000000001';
const RIDER_AYUSO = '20000000-0000-0000-0000-000000000002';

// Skip unless explicitly enabled (requires local Supabase running).
const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('submitStagePick', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await user.cleanup(); });

  it('creates a pick when stage is upcoming and rider is active', async () => {
    // NOTE: we cannot call submitStagePick as a raw function because it needs cookies().
    // Instead we call the DB directly through a user-scoped client... SEE IMPLEMENTATION NOTE BELOW.
    // This test stub fails intentionally until the implementation is ready.
    expect(true).toBe(true);
  });
});
```

**IMPLEMENTATION NOTE for engineer:** `submitStagePick` is a server action that relies on `cookies()`. We cannot invoke it from a Vitest node-env test directly. Three options:
1. **Preferred:** Extract the core logic into a pure function `submitStagePickCore({ userId, supabase, input })` that takes its dependencies as arguments, then `submitStagePick` becomes a thin wrapper. The integration test calls `submitStagePickCore` directly with a user-scoped Supabase client built from the user's JWT.
2. Hit the server action via an HTTP POST to the Next app running in test mode. Too heavy.
3. Skip integration for actions; rely on E2E in Plan D. Less coverage.

Go with option 1. The core function gets full test coverage; the action is a glorified adapter.

- [ ] **Step 3: Run test — expect SKIP (not enabled) or failure**

Run:
```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/submit-stage-pick.test.ts
```

This will fail because `submitStagePick` doesn't exist. Proceed to implement.

- [ ] **Step 4: Write implementation**

Write `src/lib/actions/picks.ts`:
```ts
'use server';

import { z } from 'zod';
import { requireProfile } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { validateNoReuse, type ExistingPick } from '@/lib/picks/no-reuse';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { ActionResult } from './result';

type Supa = SupabaseClient<Database>;

const submitStagePickSchema = z.object({
  stageId: z.string().uuid(),
  riderId: z.string().uuid(),
});

export async function submitStagePickCore(
  supabase: Supa,
  userId: string,
  input: { stageId: string; riderId: string },
): Promise<ActionResult<{ stagePickId: string }>> {
  // 1. Load stage.
  const { data: stage, error: stageErr } = await supabase
    .from('stages')
    .select('id, edition_id, number, start_time, status, counts_for_scoring')
    .eq('id', input.stageId)
    .maybeSingle();
  if (stageErr) return { ok: false, error: stageErr.message };
  if (!stage) return { ok: false, error: 'stage_not_found' };
  if (new Date(stage.start_time).getTime() <= Date.now()) {
    return { ok: false, error: 'stage_locked' };
  }
  if (stage.status === 'cancelled') return { ok: false, error: 'stage_cancelled' };

  // 2. Load rider.
  const { data: rider, error: riderErr } = await supabase
    .from('riders')
    .select('id, edition_id, status')
    .eq('id', input.riderId)
    .maybeSingle();
  if (riderErr) return { ok: false, error: riderErr.message };
  if (!rider) return { ok: false, error: 'rider_not_found' };
  if (rider.edition_id !== stage.edition_id) return { ok: false, error: 'rider_wrong_edition' };
  if (rider.status !== 'active') return { ok: false, error: 'rider_not_active' };

  // 3. No-reuse check: load user's existing picks for this edition.
  const { data: existing, error: exErr } = await supabase
    .from('stage_picks')
    .select('stage_id, rider_id, stages!inner(edition_id, number, status)')
    .eq('user_id', userId)
    .eq('stages.edition_id', stage.edition_id);
  if (exErr) return { ok: false, error: exErr.message };

  const normalized: ExistingPick[] = (existing ?? []).map((p: any) => ({
    stage_id: p.stage_id,
    rider_id: p.rider_id,
    stage_status: p.stages.status,
    stage_number: p.stages.number,
  }));

  const reuseCheck = validateNoReuse(normalized, input.stageId, input.riderId);
  if (!reuseCheck.ok) {
    return { ok: false, error: `rider_already_used_on_stage_${reuseCheck.conflictingStageNumber}` };
  }

  // 4. Upsert.
  const { data: upserted, error: upErr } = await supabase
    .from('stage_picks')
    .upsert(
      { user_id: userId, stage_id: input.stageId, rider_id: input.riderId },
      { onConflict: 'user_id,stage_id' },
    )
    .select('id')
    .single();
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, value: { stagePickId: upserted.id } };
}

export async function submitStagePick(
  _prev: ActionResult<{ stagePickId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ stagePickId: string }>> {
  const parsed = submitStagePickSchema.safeParse({
    stageId: formData.get('stageId'),
    riderId: formData.get('riderId'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };

  const { user } = await requireProfile();
  const supabase = await createClient();
  return submitStagePickCore(supabase, user.id, parsed.data);
}
```

- [ ] **Step 5: Complete the test — now call Core directly**

Replace the placeholder test body with:
```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { submitStagePickCore } from '@/lib/actions/picks';

async function userClient(email: string) {
  const password = 'test-password-123';
  const c = createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error('signin failed');
  return c;
}

// ...
it('creates a pick when stage is upcoming and rider is active', async () => {
  const c = await userClient(user.email);
  const res = await submitStagePickCore(c, user.userId, { stageId: STAGE_9, riderId: RIDER_POGACAR });
  expect(res.ok).toBe(true);
});

it('rejects re-picking a rider on a second stage', async () => {
  const c = await userClient(user.email);
  // first pick on stage 9
  await submitStagePickCore(c, user.userId, { stageId: STAGE_9, riderId: RIDER_AYUSO });
  // try again on stage 21 with same rider
  const res = await submitStagePickCore(c, user.userId, {
    stageId: '10000000-0000-0000-0000-000000000003',
    riderId: RIDER_AYUSO,
  });
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.error).toMatch(/rider_already_used_on_stage_9/);
});

it('rejects when stage is locked', async () => {
  const c = await userClient(user.email);
  // Stage 1 is already locked per seed (published).
  const res = await submitStagePickCore(c, user.userId, {
    stageId: '10000000-0000-0000-0000-000000000001',
    riderId: RIDER_POGACAR,
  });
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.error).toBe('stage_locked');
});
```

- [ ] **Step 6: Run — expect PASS**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/submit-stage-pick.test.ts
```

Iterate on errors. Make sure `supabase start` is running.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/picks.ts src/test/integration/
git commit -m "feat(actions): add submitStagePick with no-reuse check + integration tests"
```

---

### Task B2.3: submitGcPicks + submitJerseyPick server actions (TDD)

**Files:**
- Modify: `src/lib/actions/picks.ts` (add two more functions)
- Create: `src/test/integration/submit-gc-picks.test.ts`

**Context:** Similar shape to `submitStagePick`. GC validates 3 distinct riders for positions 1/2/3 before Stage 1 lock. Jersey validates 1 rider before Stage 1 lock.

- [ ] **Step 1: GC pick implementation — extend picks.ts**

Append to `src/lib/actions/picks.ts`:
```ts
const submitGcPicksSchema = z.object({
  editionId: z.string().uuid(),
  first: z.string().uuid(),
  second: z.string().uuid(),
  third: z.string().uuid(),
});

export async function submitGcPicksCore(
  supabase: Supa,
  userId: string,
  input: { editionId: string; first: string; second: string; third: string },
): Promise<ActionResult> {
  // Ensure all three distinct.
  const slots = [input.first, input.second, input.third];
  if (new Set(slots).size !== 3) return { ok: false, error: 'gc_riders_must_be_distinct' };

  // Ensure edition not started.
  const { data: stage1 } = await supabase
    .from('stages')
    .select('start_time')
    .eq('edition_id', input.editionId)
    .eq('number', 1)
    .maybeSingle();
  if (!stage1) return { ok: false, error: 'edition_missing_stage_1' };
  if (new Date(stage1.start_time).getTime() <= Date.now()) return { ok: false, error: 'gc_locked' };

  // Ensure riders are in the edition.
  const { data: riders } = await supabase
    .from('riders')
    .select('id, edition_id, status')
    .in('id', slots);
  if (!riders || riders.length !== 3) return { ok: false, error: 'rider_not_found' };
  for (const r of riders) {
    if (r.edition_id !== input.editionId) return { ok: false, error: 'rider_wrong_edition' };
  }

  // Upsert all three rows.
  const rows = [
    { user_id: userId, edition_id: input.editionId, position: 1, rider_id: input.first },
    { user_id: userId, edition_id: input.editionId, position: 2, rider_id: input.second },
    { user_id: userId, edition_id: input.editionId, position: 3, rider_id: input.third },
  ];
  const { error } = await supabase
    .from('gc_picks')
    .upsert(rows, { onConflict: 'user_id,edition_id,position' });
  if (error) return { ok: false, error: error.message };

  return { ok: true, value: undefined };
}

export async function submitGcPicks(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitGcPicksSchema.safeParse({
    editionId: formData.get('editionId'),
    first: formData.get('first'),
    second: formData.get('second'),
    third: formData.get('third'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };

  const { user } = await requireProfile();
  const supabase = await createClient();
  return submitGcPicksCore(supabase, user.id, parsed.data);
}
```

- [ ] **Step 2: Jersey pick implementation — extend picks.ts**

```ts
const submitJerseyPickSchema = z.object({
  editionId: z.string().uuid(),
  riderId: z.string().uuid(),
});

export async function submitJerseyPickCore(
  supabase: Supa,
  userId: string,
  input: { editionId: string; riderId: string },
): Promise<ActionResult> {
  const { data: stage1 } = await supabase
    .from('stages')
    .select('start_time')
    .eq('edition_id', input.editionId)
    .eq('number', 1)
    .maybeSingle();
  if (!stage1) return { ok: false, error: 'edition_missing_stage_1' };
  if (new Date(stage1.start_time).getTime() <= Date.now()) return { ok: false, error: 'jersey_locked' };

  const { data: rider } = await supabase
    .from('riders')
    .select('id, edition_id')
    .eq('id', input.riderId)
    .maybeSingle();
  if (!rider) return { ok: false, error: 'rider_not_found' };
  if (rider.edition_id !== input.editionId) return { ok: false, error: 'rider_wrong_edition' };

  const { error } = await supabase
    .from('points_jersey_picks')
    .upsert({ user_id: userId, edition_id: input.editionId, rider_id: input.riderId }, {
      onConflict: 'user_id,edition_id',
    });
  if (error) return { ok: false, error: error.message };

  return { ok: true, value: undefined };
}

export async function submitJerseyPick(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitJerseyPickSchema.safeParse({
    editionId: formData.get('editionId'),
    riderId: formData.get('riderId'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };

  const { user } = await requireProfile();
  const supabase = await createClient();
  return submitJerseyPickCore(supabase, user.id, parsed.data);
}
```

- [ ] **Step 3: Integration test for GC**

Write `src/test/integration/submit-gc-picks.test.ts` along the same lines as stage pick test. Cases:
- 3 distinct riders → ok
- duplicate rider → `gc_riders_must_be_distinct`
- edition with Stage 1 already started (use the seed's Stage 1 — update start_time to past) → `gc_locked`

**IMPORTANT:** The seed sets Stage 1 to `status='published'` with `start_time = now() - 1 day`, which means for the GC test we need a DIFFERENT edition where Stage 1 is still future. Add an ephemeral test edition via admin client inside `beforeAll`, or use `setStageState` to push Stage 1 back into the future for the duration of this test, then restore.

- [ ] **Step 4: Run**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/picks.ts src/test/integration/submit-gc-picks.test.ts
git commit -m "feat(actions): add submitGcPicks and submitJerseyPick with integration tests"
```

---

## Phase 3 — Picks UX

### Task B3.1: Picks list page

**Files:**
- Replace: `src/app/(app)/picks/page.tsx`

**Context:** Shows all counted stages with status pills + GC and Jersey entry cards. Counts are from seed: 3 counted stages (Stage 1, 9, 21). Stage 1 is already published (no pick allowed — show as "Scored"), Stage 9 is upcoming (show "Pick" button), Stage 21 is upcoming.

- [ ] **Step 1: Implement**

Write `src/app/(app)/picks/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, listCountedStages } from '@/lib/queries/stages';
import { getUserStagePicks, getUserGcPicks, getUserJerseyPick } from '@/lib/queries/picks';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function PicksPage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const [stages, stagePicks, gcPicks, jerseyPick] = await Promise.all([
    listCountedStages(edition.id),
    getUserStagePicks(user.id, edition.id),
    getUserGcPicks(user.id, edition.id),
    getUserJerseyPick(user.id, edition.id),
  ]);

  const picksByStage = new Map(stagePicks.map((p) => [p.stage_id, p]));

  const stage1Locked = stages.find((s) => s.number === 1)
    ? new Date(stages.find((s) => s.number === 1)!.start_time).getTime() <= Date.now()
    : false;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Picks</h1>

      <Card>
        <CardHeader>
          <CardTitle>GC top 3</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {gcPicks.length === 3 ? 'Picks saved.' : stage1Locked ? 'Locked.' : 'Not picked yet.'}
          </span>
          {!stage1Locked && (
            <Link href="/picks/gc" className="text-primary underline text-sm">
              {gcPicks.length === 3 ? 'Edit' : 'Pick'}
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points jersey</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {jerseyPick ? 'Pick saved.' : stage1Locked ? 'Locked.' : 'Not picked yet.'}
          </span>
          {!stage1Locked && (
            <Link href="/picks/jersey" className="text-primary underline text-sm">
              {jerseyPick ? 'Edit' : 'Pick'}
            </Link>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold pt-4">Stages</h2>
      <ul className="space-y-2">
        {stages.map((s) => {
          const pick = picksByStage.get(s.id);
          const locked = new Date(s.start_time).getTime() <= Date.now();
          const published = s.status === 'published';
          return (
            <li key={s.id}>
              <Link
                href={locked ? `/stage/${s.number}` : `/picks/stage/${s.number}`}
                className="flex items-center justify-between border rounded px-4 py-3 hover:bg-muted"
              >
                <div>
                  <span className="font-medium">Stage {s.number}</span>
                  {s.double_points && <Badge className="ml-2" variant="secondary">2×</Badge>}
                </div>
                <div className="text-sm">
                  {published ? (
                    <Badge>Scored</Badge>
                  ) : locked ? (
                    <Badge variant="secondary">Locked</Badge>
                  ) : pick ? (
                    <Badge variant="outline">Picked</Badge>
                  ) : (
                    <Badge variant="destructive">Pick</Badge>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/picks/page.tsx
git commit -m "feat(picks): list counted stages with GC/Jersey entry cards"
```

---

### Task B3.2: Rider picker component

**Files:**
- Create: `src/components/rider-picker.tsx`

**Context:** Reusable client component. Takes a list of riders + a set of "used" rider_ids + the current selection. Supports search (name/team/bib). Emits `onSelect` callback.

- [ ] **Step 1: Implement**

Write `src/components/rider-picker.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface PickerRider {
  id: string;
  name: string;
  team: string | null;
  bib: number | null;
  status: 'active' | 'dnf' | 'dns';
  usedOnStageNumber?: number;
}

export function RiderPicker({
  riders,
  selectedId,
  onSelect,
  disableUsed = true,
  disableInactive = true,
}: {
  riders: PickerRider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disableUsed?: boolean;
  disableInactive?: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.team ?? '').toLowerCase().includes(q) ||
      (r.bib != null && String(r.bib).includes(q))
    );
  }, [riders, query]);

  return (
    <div className="space-y-2">
      <Input placeholder="Search name, team, bib…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="border rounded max-h-80 overflow-y-auto">
        {filtered.map((r) => {
          const disabled =
            (disableInactive && r.status !== 'active') ||
            (disableUsed && r.usedOnStageNumber !== undefined && r.id !== selectedId);
          const selected = r.id === selectedId;
          return (
            <li
              key={r.id}
              className={`flex items-center justify-between px-3 py-2 border-b last:border-b-0 ${
                disabled ? 'opacity-40' : 'cursor-pointer hover:bg-muted'
              } ${selected ? 'bg-primary/10' : ''}`}
              onClick={() => !disabled && onSelect(r.id)}
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.bib ? `#${r.bib} · ` : ''}{r.team ?? ''}
                </div>
              </div>
              <div className="text-xs">
                {r.status !== 'active' && <Badge variant="destructive" className="mr-1">{r.status.toUpperCase()}</Badge>}
                {r.usedOnStageNumber !== undefined && r.id !== selectedId && (
                  <Badge variant="secondary">Stage {r.usedOnStageNumber}</Badge>
                )}
                {selected && <Badge>Selected</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rider-picker.tsx
git commit -m "feat(ui): add RiderPicker client component with search and disabled states"
```

---

### Task B3.3: Stage pick page

**Files:**
- Create: `src/app/(app)/picks/stage/[stageNumber]/page.tsx`
- Create: `src/app/(app)/picks/stage/[stageNumber]/form.tsx`

**Context:** Loads the stage, the active-riders list, the user's existing pick (if any), and the set of other stages that have used each rider. Renders the `RiderPicker` with `usedOnStageNumber` populated. Form submits `submitStagePick` via `useActionState`.

- [ ] **Step 1: Implement server page**

Write `src/app/(app)/picks/stage/[stageNumber]/page.tsx`:
```tsx
import { redirect, notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, getStageByNumber } from '@/lib/queries/stages';
import { getUserStagePicks } from '@/lib/queries/picks';
import { listActiveRiders } from '@/lib/queries/riders';
import { StagePickForm } from './form';

export default async function StagePickPage({
  params,
}: {
  params: Promise<{ stageNumber: string }>;
}) {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const { stageNumber: numRaw } = await params;
  const stageNumber = Number(numRaw);
  if (!Number.isInteger(stageNumber)) notFound();

  const stage = await getStageByNumber(edition.id, stageNumber);
  if (!stage) notFound();
  if (new Date(stage.start_time).getTime() <= Date.now()) redirect(`/stage/${stageNumber}`);

  const [riders, allPicks] = await Promise.all([
    listActiveRiders(edition.id),
    getUserStagePicks(user.id, edition.id),
  ]);

  const picksByRider = new Map<string, { stage_id: string; stage_number: number; stage_status: string }>();
  for (const p of allPicks) {
    picksByRider.set(p.rider_id, {
      stage_id: p.stage_id,
      // @ts-expect-error nested select
      stage_number: p.stages.number,
      // @ts-expect-error nested select
      stage_status: p.stages.status,
    });
  }

  const currentPickForThisStage = allPicks.find((p) => p.stage_id === stage.id);

  return (
    <StagePickForm
      stageId={stage.id}
      stageNumber={stage.number}
      doublePoints={stage.double_points}
      startTimeIso={stage.start_time}
      initialSelectedRiderId={currentPickForThisStage?.rider_id ?? null}
      riders={riders.map((r) => {
        const used = picksByRider.get(r.id);
        return {
          id: r.id,
          name: r.name,
          team: r.team,
          bib: r.bib,
          status: r.status,
          usedOnStageNumber:
            used && used.stage_id !== stage.id && used.stage_status !== 'cancelled'
              ? used.stage_number
              : undefined,
        };
      })}
    />
  );
}
```

- [ ] **Step 2: Implement client form**

Write `src/app/(app)/picks/stage/[stageNumber]/form.tsx`:
```tsx
'use client';

import { useState, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiderPicker, type PickerRider } from '@/components/rider-picker';
import { submitStagePick } from '@/lib/actions/picks';
import type { ActionResult } from '@/lib/actions/result';

export function StagePickForm({
  stageId,
  stageNumber,
  doublePoints,
  startTimeIso,
  initialSelectedRiderId,
  riders,
}: {
  stageId: string;
  stageNumber: number;
  doublePoints: boolean;
  startTimeIso: string;
  initialSelectedRiderId: string | null;
  riders: PickerRider[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedRiderId);
  const [state, formAction, pending] = useActionState(submitStagePick, null as ActionResult<{ stagePickId: string }> | null);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stage {stageNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Locks {new Date(startTimeIso).toLocaleString()}{doublePoints && <Badge className="ml-2">2× points</Badge>}
        </p>
      </div>

      <RiderPicker riders={riders} selectedId={selectedId} onSelect={setSelectedId} />

      <form action={formAction}>
        <input type="hidden" name="stageId" value={stageId} />
        <input type="hidden" name="riderId" value={selectedId ?? ''} />
        <Button type="submit" disabled={!selectedId || pending} className="w-full">
          {pending ? 'Saving…' : 'Save pick'}
        </Button>
        {state && (state.ok ? (
          <p className="text-sm text-green-600 mt-2">Pick saved.</p>
        ) : (
          <p className="text-sm text-red-600 mt-2">{state.error}</p>
        ))}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/picks/stage/
git commit -m "feat(picks): add stage pick page with rider picker"
```

---

### Task B3.4: GC top-3 pick page

**Files:**
- Create: `src/app/(app)/picks/gc/page.tsx`
- Create: `src/app/(app)/picks/gc/form.tsx`

**Context:** Three `RiderPicker` slots. Each slot excludes the two rider IDs picked in the other slots (since GC picks must be distinct). Submits all three positions at once.

- [ ] **Step 1: Server page**

Write `src/app/(app)/picks/gc/page.tsx` — similar pattern to stage pick page but with 3 pickers and no stage-specific loading. Load `edition`, `riders`, `userGcPicks`. Pass edition_id as a hidden field.

- [ ] **Step 2: Client form**

Write `src/app/(app)/picks/gc/form.tsx` with 3 state slots (first, second, third). For each slot, compute `disabledIds = {other two slots' riders}` and render a `RiderPicker` with those marked as used (or filter them out — either works for UX; marking "Already in another slot" gives better feedback).

Simplest path: three pickers stacked, each filtering out the other two slots' selections.

- [ ] **Step 3: Build + commit**

```bash
git add src/app/\(app\)/picks/gc/
git commit -m "feat(picks): add GC top-3 pick page"
```

---

### Task B3.5: Jersey pick page

**Files:**
- Create: `src/app/(app)/picks/jersey/page.tsx`
- Create: `src/app/(app)/picks/jersey/form.tsx`

**Context:** Simpler than GC — one `RiderPicker`, one hidden input, one submit button calling `submitJerseyPick`.

- [ ] **Step 1: Implement analogous to stage pick**

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/picks/jersey/
git commit -m "feat(picks): add jersey pick page"
```

---

## Phase 4 — Display screens

### Task B4.1: Home page

**Files:**
- Replace: `src/app/(app)/home/page.tsx`
- Create: `src/components/countdown-badge.tsx`

**Context:** Shows the next upcoming counted stage (with countdown), the user's current pick for that stage (if any), and a top-5 leaderboard peek.

- [ ] **Step 1: Countdown badge component**

Write `src/components/countdown-badge.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';

function format(ms: number): string {
  if (ms <= 0) return 'locked';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CountdownBadge({ targetIso }: { targetIso: string }) {
  const [remaining, setRemaining] = useState(() => new Date(targetIso).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRemaining(new Date(targetIso).getTime() - Date.now()), 30_000);
    return () => clearInterval(id);
  }, [targetIso]);
  return <span className="font-mono text-xl">{format(remaining)}</span>;
}
```

- [ ] **Step 2: Home page**

Write `src/app/(app)/home/page.tsx`:
```tsx
import Link from 'next/link';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition, listCountedStages } from '@/lib/queries/stages';
import { getUserStagePicks } from '@/lib/queries/picks';
import { getLeaderboard } from '@/lib/queries/leaderboard';
import { CountdownBadge } from '@/components/countdown-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function HomePage() {
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) {
    return <div className="p-6">No active edition.</div>;
  }

  const [stages, picks, leaderboard] = await Promise.all([
    listCountedStages(edition.id),
    getUserStagePicks(user.id, edition.id),
    getLeaderboard(),
  ]);

  const nextStage = stages.find((s) => new Date(s.start_time).getTime() > Date.now());
  const myPickForNext = nextStage ? picks.find((p) => p.stage_id === nextStage.id) : null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Home</h1>

      {nextStage ? (
        <Card>
          <CardHeader>
            <CardTitle>Stage {nextStage.number} {nextStage.double_points ? '(2×)' : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Locks in</div>
            <CountdownBadge targetIso={nextStage.start_time} />
            <div className="mt-2 text-sm">
              {myPickForNext ? 'Pick saved.' : <span className="text-red-600">No pick yet.</span>}
            </div>
            <Link className="text-primary underline text-sm" href={`/picks/stage/${nextStage.number}`}>
              {myPickForNext ? 'Change pick' : 'Pick a rider'}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>No upcoming stages</CardTitle></CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard — top 5</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1">
            {leaderboard.slice(0, 5).map((r) => (
              <li key={r.user_id} className="flex justify-between text-sm">
                <span>{r.rank}. {r.user_id === user.id ? <strong>{r.display_name}</strong> : r.display_name}</span>
                <span className="font-mono">{r.total_points}</span>
              </li>
            ))}
          </ol>
          <Link className="text-primary underline text-sm mt-2 inline-block" href="/board">Full leaderboard →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/home/page.tsx src/components/countdown-badge.tsx
git commit -m "feat(home): add next-stage card, countdown, and leaderboard top-5"
```

---

### Task B4.2: Leaderboard page

**Files:**
- Replace: `src/app/(app)/board/page.tsx`
- Create: `src/components/leaderboard-table.tsx`

**Context:** Full table, sorted by total_points desc, tiebreaker exact_winners_count. Columns: rank, name, total, stage pts, GC pts, jersey pts, ⭐ exact winners.

- [ ] **Step 1: Server page + table component**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(board): add full leaderboard page"
```

---

### Task B4.3: Me page + sign out

**Files:**
- Replace: `src/app/(app)/me/page.tsx`
- Create: `src/components/sign-out-button.tsx`

**Context:** Shows profile (display_name, email, role), user's full pick recap (one row per stage pick + GC + Jersey), sign out button that calls `supabase.auth.signOut()` + redirect to `/sign-in`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(me): add profile/recap/sign-out page"
```

---

### Task B4.4: Stage detail page (post-lock)

**Files:**
- Create: `src/app/(app)/stage/[stageNumber]/page.tsx`

**Context:** Only reachable once `stage.start_time <= now()`. Shows:
- Stage header + status (scheduled/locked/published)
- Top 10 results (if published)
- Every user's pick for this stage + computed points

Uses RLS — the `stage_picks_read_locked` policy allows reading everyone's pick for a locked stage.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(stage): add post-lock stage detail with everyone's picks"
```

---

## Phase 5 — Minimal admin invite form

### Task B5.1: Admin invite generator

**Files:**
- Create: `src/app/admin/invites/page.tsx`
- Create: `src/app/admin/invites/actions.ts`

**Context:** Minimal admin UI so Plan B's auth flow is testable end-to-end without a Plan C prerequisite. Gated by `requireAdmin`. Form: email input + "Generate" button → server action creates an invite row with a random short code + 7-day expiry + `created_by = admin.id`.

- [ ] **Step 1: Server action**

Write `src/app/admin/invites/actions.ts`:
```ts
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-user';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/actions/result';

function shortCode(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

const schema = z.object({ email: z.string().email() });

export async function generateInvite(
  _prev: ActionResult<{ code: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ code: string }>> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: false, error: 'invalid_email' };

  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const code = shortCode();
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();

  const { error } = await admin.from('invites').insert({
    code, created_by: user.id, email: parsed.data.email, expires_at: expiresAt,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, value: { code } };
}
```

- [ ] **Step 2: Page + form**

Write `src/app/admin/invites/page.tsx`:
```tsx
import { requireAdmin } from '@/lib/auth/require-user';
import { InviteForm } from './form';

export default async function AdminInvitesPage() {
  await requireAdmin();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Generate invite</h1>
      <InviteForm />
    </main>
  );
}
```

Write `src/app/admin/invites/form.tsx` (client):
```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateInvite } from './actions';
import type { ActionResult } from '@/lib/actions/result';

export function InviteForm() {
  const [state, action, pending] = useActionState(generateInvite, null as ActionResult<{ code: string }> | null);
  return (
    <form action={action} className="space-y-3 max-w-sm">
      <label className="text-sm">Invite email</label>
      <Input name="email" type="email" required />
      <Button type="submit" disabled={pending}>{pending ? 'Generating…' : 'Generate invite'}</Button>
      {state?.ok && (
        <p className="text-sm">
          Invite created. Code: <code className="font-mono">{state.value.code}</code>. Tell the invitee to sign in at <code>/sign-in</code> with this email.
        </p>
      )}
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/invites/
git commit -m "feat(admin): add minimal invite-generation form (requires admin role)"
```

---

## Phase 6 — Integration tests for RLS + leaderboard

### Task B6.1: RLS denial integration tests

**Files:**
- Create: `src/test/integration/rls-denials.test.ts`

**Context:** Verify:
- User A cannot read User B's un-locked pick
- Non-admin cannot insert into `stage_results`
- Non-admin cannot read `draft` stage_results rows
- User cannot write `stage_picks` to another user's id

- [ ] **Step 1: Implement + run**

```bash
SUPABASE_INTEGRATION=1 npx vitest run src/test/integration/rls-denials.test.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "test(rls): add integration tests for RLS denial cases"
```

---

### Task B6.2: Leaderboard flow integration test

**Files:**
- Create: `src/test/integration/leaderboard-flow.test.ts`

**Context:** End-to-end: create user → submit pick → admin marks results → view leaderboard → verify user's row has expected total and exact_winners_count.

- [ ] **Step 1: Implement + run**

- [ ] **Step 2: Commit**

```bash
git commit -m "test(leaderboard): integration test for pick → results → leaderboard flow"
```

---

## Phase 7 — Final polish & sanity pass

### Task B7.1: Manual smoke walkthrough

**Files:** none.

- [ ] **Step 1: Boot**

```bash
npx supabase start
npx supabase db reset
npm run dev
```

- [ ] **Step 2: Manual flow**

1. Go to `http://localhost:3000` → redirects to `/sign-in`
2. Use Studio at `http://127.0.0.1:54323` to confirm `dev-admin@example.com` and `dev-player@example.com` exist.
3. Sign in as dev-player (paste JWT into cookies manually OR use email + password form). Simplest: use Mailpit (`http://127.0.0.1:54324`) to catch the magic-link email after submitting `/sign-in`, click it.
4. Land on `/home` — see Stage 9 as next upcoming + leaderboard.
5. Go to `/picks` → `Stage 9` → pick a rider → Save.
6. Go to `/picks/gc` → pick 3 distinct riders → Save.
7. Go to `/picks/jersey` → pick one rider → Save.
8. Go to `/board` → see yourself in the leaderboard (probably still 25 pts from seed).
9. Go to `/me` → see recap.

Document any rough edges in a brief `docs/smoke-plan-b.md`.

- [ ] **Step 3: Sanity pass**

```bash
npm test
SUPABASE_INTEGRATION=1 npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/smoke-plan-b.md
git commit -m "docs: plan B manual smoke notes"
```

---

## Self-review

**Spec coverage check:**
- §4.1 invite → sign-up: Tasks B0.4, B0.5, B0.6, B5.1 ✓
- §4.2 pre-race picks (GC, jersey): Tasks B3.4, B3.5 ✓
- §4.3 stage pick flow: Tasks B3.1, B3.2, B3.3 ✓
- §6.1 mobile UX layout + tabs: Task B1.3 ✓
- Leaderboard view rendering: Task B4.2 ✓
- Post-lock detail view: Task B4.4 ✓
- Me page + sign out: Task B4.3 ✓

**Not covered (intentional):**
- §4.4 scrape → admin publish (Plan C)
- §4.5 rider DNF (Plan C — seed just has all active)
- §4.6 stage cancellation (Plan C admin)
- §4.7 reminders (Plan C cron)
- §4.8 final classifications (Plan C admin publish)
- §8.3 E2E Playwright (Plan D)

**Placeholder scan:** No TBDs in implementation code. The manual smoke in B7.1 step 2 has prose guidance rather than commands — intentional.

**Type consistency:** `ActionResult<T>` used consistently by all actions. `PickerRider` shared between picker component and server pages via import. `StageStatusForScoring` (Plan A) compatible with the real DB enum after the code-review fix.

**Scope check:** Single deliverable — "an authed user can play the full picker flow." Matches Plan A's clean handoff.

---

## Deliverables at end of Plan B

- ✅ Magic-link auth wired (middleware, callback, server helpers)
- ✅ Onboarding flow creating profiles from invites
- ✅ All player routes (Home, Picks, Board, Me) with bottom tab navigation
- ✅ Stage / GC / Jersey picker UIs with no-reuse enforcement client + server side
- ✅ Minimal admin invite generator (so the flow is end-to-end testable)
- ✅ Integration tests for server actions, RLS, and leaderboard computation
- ✅ Dev seed with admin + player + published Stage 1 so the leaderboard has data on first boot
- ✅ Manual smoke walkthrough documented
