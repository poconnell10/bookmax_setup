-- M3B.1: dedicated encrypted credential handoff.
-- Local migration only. Do not apply to remote without explicit approval.
-- Plaintext Client ID / client secret / application key must never be stored.

create table if not exists public.implementation_credentials (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  envelope jsonb not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint implementation_credentials_implementation_id_key unique (implementation_id),
  constraint implementation_credentials_implementation_id_fkey
    foreign key (implementation_id)
    references public.implementations (id)
    on delete cascade,
  constraint implementation_credentials_envelope_object check (jsonb_typeof(envelope) = 'object')
);

comment on table public.implementation_credentials is
  'AES-256-GCM credential envelopes. One row per implementation. No plaintext secrets.';

drop trigger if exists implementation_credentials_set_updated_at on public.implementation_credentials;
create trigger implementation_credentials_set_updated_at
  before update on public.implementation_credentials
  for each row
  execute function public.set_updated_at();

alter table public.implementation_credentials enable row level security;

revoke all on table public.implementation_credentials from anon, authenticated, public;
grant all on table public.implementation_credentials to service_role;
