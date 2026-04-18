# Quiniela — Giro d'Italia Pickem

Private, invite-only pickem game for a group of 34 friends.

## Stack

Next.js 16 (App Router) · TypeScript · Supabase (DB + Auth) · Vercel · Tailwind · shadcn/ui · Vitest · Playwright.

## Local setup

```bash
npm install
cp .env.local.example .env.local
npx supabase start          # boots local Postgres + Studio on :54323
npx supabase db reset       # applies migrations + seed
npm run dev                 # http://localhost:3000
```

## Scripts

- `npm run dev` — Next dev server
- `npm run build` — production build
- `npm test` — run Vitest
- `npm run test:watch` — Vitest watch
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — Next lint

## Design docs

- Spec: `docs/superpowers/specs/2026-04-17-giro-pickem-design.md`
- Plans: `docs/superpowers/plans/`
