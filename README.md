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


## Persistence

Application routes always use the Supabase-backed stores. Missing database
configuration or database failures are surfaced; they never select prototype
storage. Server startup rejects prototype/file configuration in production and
Vercel deployments and requires the Supabase public and server variables.

The legacy prototype adapter is available to local tooling only with
`NODE_ENV=development` and an explicit `BOOKMAX_PERSISTENCE=prototype` (or
`file`). It is not an alternative backend for application routes. Isolated
`NODE_ENV=test` runs use memory without reading or writing files.

Local submissions use asynchronous writes serialized within one process,
a private temporary file, and atomic replacement of
`data/poc-submissions.json`. Read and write failures are surfaced, and corrupt
files are not overwritten. Drafts and credential receipts remain process-local;
only submissions are saved. Run at most one local prototype process per data
directory. Multiple instances and all deployments require Supabase.
