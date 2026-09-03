-- M1: self-service customer implementation + property.
-- Local migration only. Do not apply to remote without explicit approval.
-- Identity is auth.users. Email is not used as a primary key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- implementations
-- ---------------------------------------------------------------------------

create table if not exists public.implementations (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint implementations_status_check check (
    status in ('started', 'property_complete')
  )
);

comment on table public.implementations is
  'Customer implementation records. One active implementation per customer in M1.';

-- ---------------------------------------------------------------------------
-- implementation_users
-- ---------------------------------------------------------------------------

create table if not exists public.implementation_users (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  user_id uuid not null,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  constraint implementation_users_implementation_id_fkey
    foreign key (implementation_id)
    references public.implementations (id)
    on delete cascade,
  constraint implementation_users_user_id_key unique (user_id),
  constraint implementation_users_role_check check (role in ('customer'))
);

create index if not exists implementation_users_implementation_id_idx
  on public.implementation_users (implementation_id);

comment on table public.implementation_users is
  'Associates authenticated users with implementations. M1 is one implementation per user.';

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  name text not null,
  city text not null,
  country text not null,
  contact_name text not null,
  job_title text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_implementation_id_key unique (implementation_id),
  constraint properties_implementation_id_fkey
    foreign key (implementation_id)
    references public.implementations (id)
    on delete cascade,
  constraint properties_name_nonempty check (length(trim(name)) > 0),
  constraint properties_city_nonempty check (length(trim(city)) > 0),
  constraint properties_country_nonempty check (length(trim(country)) > 0),
  constraint properties_contact_name_nonempty check (length(trim(contact_name)) > 0)
);

comment on table public.properties is
  'One property per M1 implementation. Linked by implementation_id, never by email.';

-- ---------------------------------------------------------------------------
-- updated_at helper (shared with invitation migration)
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

drop trigger if exists implementations_set_updated_at on public.implementations;
create trigger implementations_set_updated_at
  before update on public.implementations
  for each row
  execute function public.set_updated_at();

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- Authenticated customers may only read (and update property of) their own rows.
-- Privileged creates/upserts use service_role from server routes after JWT checks.
-- ---------------------------------------------------------------------------

alter table public.implementations enable row level security;
alter table public.implementation_users enable row level security;
alter table public.properties enable row level security;

revoke all on table public.implementations from anon, authenticated, public;
revoke all on table public.implementation_users from anon, authenticated, public;
revoke all on table public.properties from anon, authenticated, public;

grant select on table public.implementations to authenticated;
grant select on table public.implementation_users to authenticated;
grant select, update on table public.properties to authenticated;

grant all on table public.implementations to service_role;
grant all on table public.implementation_users to service_role;
grant all on table public.properties to service_role;

drop policy if exists implementation_users_select_own on public.implementation_users;
create policy implementation_users_select_own
  on public.implementation_users
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists implementations_select_own on public.implementations;
create policy implementations_select_own
  on public.implementations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = implementations.id
        and u.user_id = auth.uid()
    )
  );

drop policy if exists properties_select_own on public.properties;
create policy properties_select_own
  on public.properties
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = properties.implementation_id
        and u.user_id = auth.uid()
    )
  );

drop policy if exists properties_update_own on public.properties;
create policy properties_update_own
  on public.properties
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = properties.implementation_id
        and u.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = properties.implementation_id
        and u.user_id = auth.uid()
    )
  );
