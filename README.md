# BookMax Implementation Setup

Local application baseline for the BookMax implementation journey.

## Prerequisites

- Node.js 20.9 or later
- npm 10 or later

## Install

```bash
npm install
```

## Local run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/implementation/property`.

## Lint

```bash
npm run lint
```

## Type-check

```bash
npm run typecheck
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Environment

Public (browser and server):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only (Vercel / Next.js server routes, never `NEXT_PUBLIC_`):

- `SUPABASE_SECRET_KEY` (preferred)
- `SUPABASE_SERVICE_ROLE_KEY` (accepted fallback)

## Vercel

Set the variables above on the Vercel project before deploying. The privileged connectivity probe is `POST /api/supabase/connection-test`.

Apply `supabase/migrations/20260827212600_bookmax_connection_test.sql` in the Supabase SQL editor before running that probe. Do not apply it from this repository without approval.
