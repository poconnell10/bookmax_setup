-- M1 Phase 1: BookMax implementation invitation + draft + submission.
-- Local migration only. Do not apply to remote without explicit approval.
-- Raw invitation tokens are NEVER stored; only SHA-256 token_hash.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- implementation_invitation
-- ---------------------------------------------------------------------------

create table if not exists public.implementation_invitation (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  invited_email text not null,
  contact_name text not null,
  property_name text not null,
  country text not null,
  hotel_group_or_brand text null,
  status text not null,
  expires_at timestamptz not null,
  auth_user_id uuid null,
  verified_at timestamptz null,
  submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint implementation_invitation_token_hash_key unique (token_hash),
  constraint implementation_invitation_status_check check (
    status in (
      'invited',
      'opened',
      'verified',
      'in_progress',
      'submitted',
      'expired',
      'revoked'
    )
  ),
  constraint implementation_invitation_email_nonempty check (length(trim(invited_email)) > 0),
  constraint implementation_invitation_contact_nonempty check (length(trim(contact_name)) > 0),
  constraint implementation_invitation_property_nonempty check (length(trim(property_name)) > 0),
  constraint implementation_invitation_country_nonempty check (length(trim(country)) > 0)
);

create index if not exists implementation_invitation_invited_email_idx
  on public.implementation_invitation (lower(invited_email));

create index if not exists implementation_invitation_status_idx
  on public.implementation_invitation (status);

create index if not exists implementation_invitation_auth_user_id_idx
  on public.implementation_invitation (auth_user_id)
  where auth_user_id is not null;

comment on table public.implementation_invitation is
  'Customer implementation invitations. Stores token_hash only; raw URL token is a bearer secret returned once at creation.';

comment on column public.implementation_invitation.token_hash is
  'SHA-256 hex digest of the raw invitation bearer token. Raw token must never be persisted.';

comment on column public.implementation_invitation.auth_user_id is
  'Authoritative ownership after OTP bind. Must equal auth.uid() for authenticated customer access.';

-- ---------------------------------------------------------------------------
-- implementation_draft
-- ---------------------------------------------------------------------------

create table if not exists public.implementation_draft (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint implementation_draft_invitation_id_key unique (invitation_id),
  constraint implementation_draft_invitation_id_fkey
    foreign key (invitation_id)
    references public.implementation_invitation (id)
    on delete cascade
);

create index if not exists implementation_draft_invitation_id_idx
  on public.implementation_draft (invitation_id);

comment on table public.implementation_draft is
  'One active draft payload per implementation invitation.';

-- ---------------------------------------------------------------------------
-- implementation_submission
-- ---------------------------------------------------------------------------

create table if not exists public.implementation_submission (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  record jsonb not null,
  submitted_at timestamptz not null default now(),
  constraint implementation_submission_invitation_id_key unique (invitation_id),
  constraint implementation_submission_invitation_id_fkey
    foreign key (invitation_id)
    references public.implementation_invitation (id)
    on delete restrict
);

create index if not exists implementation_submission_invitation_id_idx
  on public.implementation_submission (invitation_id);

comment on table public.implementation_submission is
  'Final customer submission snapshot. One final submission per invitation.';

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists implementation_invitation_set_updated_at on public.implementation_invitation;
create trigger implementation_invitation_set_updated_at
  before update on public.implementation_invitation
  for each row
  execute function public.set_updated_at();

drop trigger if exists implementation_draft_set_updated_at on public.implementation_draft;
create trigger implementation_draft_set_updated_at
  before update on public.implementation_draft
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- Ownership after bind: invitation.auth_user_id = auth.uid()
-- No USING (true) / WITH CHECK (true). No email-domain policies.
-- Invitation create/bind and privileged writes use service_role only.
-- ---------------------------------------------------------------------------

alter table public.implementation_invitation enable row level security;
alter table public.implementation_draft enable row level security;
alter table public.implementation_submission enable row level security;

revoke all on table public.implementation_invitation from anon, authenticated, public;
revoke all on table public.implementation_draft from anon, authenticated, public;
revoke all on table public.implementation_submission from anon, authenticated, public;

grant select on table public.implementation_invitation to authenticated;
grant select, insert, update on table public.implementation_draft to authenticated;
grant select on table public.implementation_submission to authenticated;

grant all on table public.implementation_invitation to service_role;
grant all on table public.implementation_draft to service_role;
grant all on table public.implementation_submission to service_role;

-- Authenticated customers may read only invitations bound to their auth user.
drop policy if exists implementation_invitation_select_own on public.implementation_invitation;
create policy implementation_invitation_select_own
  on public.implementation_invitation
  for select
  to authenticated
  using (auth_user_id is not null and auth_user_id = auth.uid());

-- No authenticated insert/update/delete on invitations.
-- Binding auth_user_id, status transitions, and property identity are service_role only.

-- Drafts: select/insert/update only for invitations owned by auth.uid().
drop policy if exists implementation_draft_select_own on public.implementation_draft;
create policy implementation_draft_select_own
  on public.implementation_draft
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_invitation i
      where i.id = invitation_id
        and i.auth_user_id is not null
        and i.auth_user_id = auth.uid()
    )
  );

drop policy if exists implementation_draft_insert_own on public.implementation_draft;
create policy implementation_draft_insert_own
  on public.implementation_draft
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.implementation_invitation i
      where i.id = invitation_id
        and i.auth_user_id is not null
        and i.auth_user_id = auth.uid()
        and i.status in ('verified', 'in_progress')
    )
  );

drop policy if exists implementation_draft_update_own on public.implementation_draft;
create policy implementation_draft_update_own
  on public.implementation_draft
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_invitation i
      where i.id = invitation_id
        and i.auth_user_id is not null
        and i.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.implementation_invitation i
      where i.id = invitation_id
        and i.auth_user_id is not null
        and i.auth_user_id = auth.uid()
        and i.status in ('verified', 'in_progress')
    )
  );

-- Submissions: read own only. Inserts are service_role (server submit path).
drop policy if exists implementation_submission_select_own on public.implementation_submission;
create policy implementation_submission_select_own
  on public.implementation_submission
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_invitation i
      where i.id = invitation_id
        and i.auth_user_id is not null
        and i.auth_user_id = auth.uid()
    )
  );
