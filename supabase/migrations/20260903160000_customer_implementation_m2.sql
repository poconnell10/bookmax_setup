-- M2: PMS selection, connection intake, and submission.
-- Local migration only. Do not apply to remote without explicit approval.

alter table public.implementations drop constraint if exists implementations_status_check;
alter table public.implementations add constraint implementations_status_check check (
  status in ('started', 'property_complete', 'submitted')
);

create table if not exists public.implementation_intake (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint implementation_intake_implementation_id_key unique (implementation_id),
  constraint implementation_intake_implementation_id_fkey
    foreign key (implementation_id)
    references public.implementations (id)
    on delete cascade
);

create table if not exists public.implementation_submissions (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  record jsonb not null,
  submitted_at timestamptz not null default now(),
  constraint implementation_submissions_implementation_id_key unique (implementation_id),
  constraint implementation_submissions_implementation_id_fkey
    foreign key (implementation_id)
    references public.implementations (id)
    on delete cascade
);

drop trigger if exists implementation_intake_set_updated_at on public.implementation_intake;
create trigger implementation_intake_set_updated_at
  before update on public.implementation_intake
  for each row
  execute function public.set_updated_at();

comment on table public.implementation_intake is
  'Draft PMS and connection intake for customer setup. One row per implementation.';
comment on table public.implementation_submissions is
  'Immutable submission snapshot after customer review.';

alter table public.implementation_intake enable row level security;
alter table public.implementation_submissions enable row level security;

revoke all on table public.implementation_intake from anon, authenticated, public;
revoke all on table public.implementation_submissions from anon, authenticated, public;

grant select on table public.implementation_intake to authenticated;
grant select on table public.implementation_submissions to authenticated;
grant all on table public.implementation_intake to service_role;
grant all on table public.implementation_submissions to service_role;

drop policy if exists implementation_intake_select_own on public.implementation_intake;
create policy implementation_intake_select_own
  on public.implementation_intake
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = implementation_intake.implementation_id
        and u.user_id = auth.uid()
    )
  );

drop policy if exists implementation_submissions_select_own on public.implementation_submissions;
create policy implementation_submissions_select_own
  on public.implementation_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = implementation_submissions.implementation_id
        and u.user_id = auth.uid()
    )
  );
