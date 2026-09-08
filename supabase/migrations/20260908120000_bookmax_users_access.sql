-- BookMax Users & Access: authorization layer on top of existing OTP identity.
-- Additive only. Do not apply to Production without explicit CTO approval.
-- Admin bootstrap is QA-only and is NOT included in this schema file.

-- ---------------------------------------------------------------------------
-- internal_staff: admin role, active/disabled, provisioning metadata
-- ---------------------------------------------------------------------------

alter table public.internal_staff
  drop constraint if exists internal_staff_role_check;

alter table public.internal_staff
  add constraint internal_staff_role_check check (role in ('viewer', 'engineer', 'admin'));

alter table public.internal_staff
  add column if not exists status text not null default 'active';

alter table public.internal_staff
  drop constraint if exists internal_staff_status_check;

alter table public.internal_staff
  add constraint internal_staff_status_check check (status in ('active', 'disabled'));

alter table public.internal_staff
  add column if not exists updated_at timestamptz not null default now();

alter table public.internal_staff
  add column if not exists provisioned_by uuid null;

comment on table public.internal_staff is
  'BookMax internal operators. Authorization is this row + status=active, never email domain.';

-- ---------------------------------------------------------------------------
-- implementation_users: disable customer access without deleting membership
-- ---------------------------------------------------------------------------

alter table public.implementation_users
  add column if not exists status text not null default 'active';

alter table public.implementation_users
  drop constraint if exists implementation_users_status_check;

alter table public.implementation_users
  add constraint implementation_users_status_check check (status in ('active', 'disabled'));

-- ---------------------------------------------------------------------------
-- access_audit_events: provisioning / role / disable history. No secrets.
-- ---------------------------------------------------------------------------

create table if not exists public.access_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid not null,
  target_user_id uuid not null,
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint access_audit_events_event_type_check check (
    event_type in (
      'USER_PROVISIONED',
      'ROLE_CHANGED',
      'ACCESS_DISABLED',
      'ACCESS_REACTIVATED',
      'CUSTOMER_ASSIGNMENT_CHANGED'
    )
  ),
  constraint access_audit_events_previous_object check (jsonb_typeof(previous_state) = 'object'),
  constraint access_audit_events_new_object check (jsonb_typeof(new_state) = 'object')
);

comment on table public.access_audit_events is
  'Users & Access governance audit. Must never contain OTP, passwords, or PMS credentials.';

create index if not exists access_audit_events_target_idx
  on public.access_audit_events (target_user_id, created_at desc);

create index if not exists access_audit_events_actor_idx
  on public.access_audit_events (actor_user_id, created_at desc);

alter table public.access_audit_events enable row level security;
revoke all on table public.access_audit_events from anon, authenticated, public;
grant all on table public.access_audit_events to service_role;

-- Keep internal_staff closed to the Data API. Privileged routes use service_role
-- after JWT + admin checks. Re-assert in case grants drifted.
revoke all on table public.internal_staff from anon, authenticated, public;
grant all on table public.internal_staff to service_role;

-- ---------------------------------------------------------------------------
-- Last active Admin cannot be removed, downgraded, or disabled.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_last_admin_loss()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.status = 'active' then
      select count(*) into remaining
      from public.internal_staff
      where role = 'admin'
        and status = 'active'
        and user_id is distinct from old.user_id;
      if remaining = 0 then
        raise exception 'Cannot remove the last active Admin';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'admin' and old.status = 'active'
     and (new.role is distinct from 'admin' or new.status is distinct from 'active') then
    select count(*) into remaining
    from public.internal_staff
    where role = 'admin'
      and status = 'active'
      and user_id is distinct from old.user_id;
    if remaining = 0 then
      raise exception 'Cannot disable or downgrade the last active Admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists internal_staff_last_admin on public.internal_staff;
create trigger internal_staff_last_admin
  before update or delete on public.internal_staff
  for each row
  execute function public.prevent_last_admin_loss();
