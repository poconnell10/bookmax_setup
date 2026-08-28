-- TEMPORARY M0 connectivity probe. Not BookMax production schema.
-- Do not use this table for customer, property, PMS, or credential data.

create table if not exists public.bookmax_connection_test (
  id uuid primary key default gen_random_uuid(),
  test_value text not null,
  created_at timestamptz not null default now()
);

comment on table public.bookmax_connection_test is
  'TEMPORARY M0 Vercel-to-Supabase connectivity probe. Not a production BookMax table.';

alter table public.bookmax_connection_test enable row level security;

revoke all on table public.bookmax_connection_test from anon, authenticated, public;
grant all on table public.bookmax_connection_test to service_role;
