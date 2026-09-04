-- Internal submission queue: staff authorization, workflow status, and audit.
-- Local migration only. Do not apply to remote without explicit approval.
-- Additive only. No credential values. No destructive changes.

-- ---------------------------------------------------------------------------
-- internal_staff
-- Authorized BookMax operators. Not customer membership.
-- ---------------------------------------------------------------------------

create table if not exists public.internal_staff (
  user_id uuid primary key,
  role text not null,
  created_at timestamptz not null default now(),
  constraint internal_staff_role_check check (role in ('viewer', 'engineer')),
  constraint internal_staff_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade
);

comment on table public.internal_staff is
  'BookMax internal operators. viewer: submission metadata. engineer: workflow + secure credential retrieval.';

-- ---------------------------------------------------------------------------
-- workflow columns on the existing immutable submission snapshot
-- Status lives beside the snapshot, never inside credential storage.
-- ---------------------------------------------------------------------------

alter table public.implementation_submissions
  add column if not exists workflow_status text not null default 'Submitted';

alter table public.implementation_submissions
  add column if not exists workflow_updated_at timestamptz not null default now();

alter table public.implementation_submissions
  add column if not exists workflow_updated_by uuid null;

alter table public.implementation_submissions
  drop constraint if exists implementation_submissions_workflow_status_check;

alter table public.implementation_submissions
  add constraint implementation_submissions_workflow_status_check check (
    workflow_status in ('Submitted', 'Under Review', 'Information Required', 'Ready')
  );

comment on column public.implementation_submissions.workflow_status is
  'Internal implementation workflow. Separate from the customer snapshot and from credential envelopes.';

create index if not exists implementation_submissions_submitted_at_idx
  on public.implementation_submissions (submitted_at desc);

-- ---------------------------------------------------------------------------
-- implementation_audit_events
-- No secret values. No envelopes. Actor + event + identifiers only.
-- ---------------------------------------------------------------------------

create table if not exists public.implementation_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid not null,
  implementation_id uuid null,
  submission_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint implementation_audit_events_event_type_check check (
    event_type in ('status_changed', 'credential_opened')
  ),
  constraint implementation_audit_events_implementation_id_fkey
    foreign key (implementation_id)
    references public.implementations (id)
    on delete set null,
  constraint implementation_audit_events_submission_id_fkey
    foreign key (submission_id)
    references public.implementation_submissions (id)
    on delete set null,
  constraint implementation_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.implementation_audit_events is
  'Internal workflow and credential-access audit. Metadata must never contain credential values.';

create index if not exists implementation_audit_events_created_at_idx
  on public.implementation_audit_events (created_at desc);

create index if not exists implementation_audit_events_actor_idx
  on public.implementation_audit_events (actor_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: Data API closed. Privileged server routes use service_role after JWT + staff checks.
-- ---------------------------------------------------------------------------

alter table public.internal_staff enable row level security;
alter table public.implementation_audit_events enable row level security;

revoke all on table public.internal_staff from anon, authenticated, public;
revoke all on table public.implementation_audit_events from anon, authenticated, public;

grant all on table public.internal_staff to service_role;
grant all on table public.implementation_audit_events to service_role;
