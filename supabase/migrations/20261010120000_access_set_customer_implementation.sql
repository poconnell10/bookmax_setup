-- Manage access: an Admin attaches a Customer to an unattached implementation,
-- or starts a fresh one for them, as one transition.
--
-- access_set_customer_implementation(actor, target, implementation)
--   implementation not null  attach. The implementation must have no
--                            implementation_users row in any status, so a
--                            property is never taken from an existing customer,
--                            including a disabled one.
--   implementation null      fresh. If the Customer's current implementation
--                            is empty it is reused and nothing is written;
--                            otherwise a new 'started' implementation is created.
--
-- The membership move, the deletion of an implementation it leaves empty, and
-- the CUSTOMER_ASSIGNMENT_CHANGED audit event commit together or not at all.
-- "Empty" means no properties, implementation_intake, implementation_submissions,
-- implementation_credentials or implementation_audit_events rows, and no
-- remaining members.
--
-- Two Admins attaching the same implementation at once are serialized by the
-- row lock on that implementation; the second sees the first's membership and
-- is refused.
--
-- access_audit_events also gains CUSTOMER_PROPERTY_SAVED, written when an Admin
-- saves a Customer's property from /setup/property.
--
-- No table, column or RLS changes.

alter table public.access_audit_events
  drop constraint if exists access_audit_events_event_type_check;

alter table public.access_audit_events
  add constraint access_audit_events_event_type_check check (
    event_type in (
      'USER_PROVISIONED',
      'ROLE_CHANGED',
      'ACCESS_DISABLED',
      'ACCESS_REACTIVATED',
      'CUSTOMER_ASSIGNMENT_CHANGED',
      'ACCOUNT_TYPE_CHANGED',
      'CUSTOMER_PROPERTY_SAVED'
    )
  );

create function public.access_set_customer_implementation(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_implementation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_membership_id uuid;
  v_membership_status text;
  v_current uuid;
  v_target uuid;
  v_mode text;
  v_deleted boolean := false;
  v_previous jsonb;
  v_new jsonb;
begin
  select role, status
    into v_actor_role, v_actor_status
  from public.internal_staff
  where user_id = p_actor_user_id;

  if v_actor_role is distinct from 'admin' or v_actor_status is distinct from 'active' then
    raise exception 'forbidden: only an active Admin can change a Customer implementation'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'not_found: target identity does not exist'
      using errcode = 'P0002';
  end if;

  if exists (select 1 from public.internal_staff where user_id = p_target_user_id) then
    raise exception 'internal_account: this user has an internal account'
      using errcode = '22023';
  end if;

  select id, implementation_id, status
    into v_membership_id, v_current, v_membership_status
  from public.implementation_users
  where user_id = p_target_user_id
  for update;

  if v_membership_id is null or v_membership_status is distinct from 'active' then
    raise exception 'invalid_input: only an active Customer can change implementation'
      using errcode = '22023';
  end if;

  if p_implementation_id is not null then
    if p_implementation_id = v_current then
      raise exception 'invalid_input: this Customer is already attached to that implementation'
        using errcode = '22023';
    end if;

    perform 1 from public.implementations where id = p_implementation_id for update;
    if not found then
      raise exception 'not_found: implementation does not exist'
        using errcode = 'P0002';
    end if;

    if exists (select 1 from public.implementation_users where implementation_id = p_implementation_id) then
      raise exception 'implementation_taken: that implementation already belongs to a customer'
        using errcode = '23505';
    end if;

    v_target := p_implementation_id;
    v_mode := 'attached';
  else
    if not exists (select 1 from public.properties where implementation_id = v_current)
       and not exists (select 1 from public.implementation_intake where implementation_id = v_current)
       and not exists (select 1 from public.implementation_submissions where implementation_id = v_current)
       and not exists (select 1 from public.implementation_credentials where implementation_id = v_current)
       and not exists (select 1 from public.implementation_audit_events where implementation_id = v_current)
       and not exists (
         select 1 from public.implementation_users
         where implementation_id = v_current and id <> v_membership_id
       ) then
      return jsonb_build_object('mode', 'reused', 'implementationId', v_current);
    end if;

    insert into public.implementations (status)
    values ('started')
    returning id into v_target;
    v_mode := 'created';
  end if;

  update public.implementation_users
    set implementation_id = v_target
  where id = v_membership_id;

  if not exists (select 1 from public.properties where implementation_id = v_current)
     and not exists (select 1 from public.implementation_intake where implementation_id = v_current)
     and not exists (select 1 from public.implementation_submissions where implementation_id = v_current)
     and not exists (select 1 from public.implementation_credentials where implementation_id = v_current)
     and not exists (select 1 from public.implementation_audit_events where implementation_id = v_current)
     and not exists (select 1 from public.implementation_users where implementation_id = v_current) then
    delete from public.implementations where id = v_current;
    v_deleted := true;
  end if;

  v_previous := jsonb_build_object('implementationId', v_current);
  v_new := jsonb_build_object(
    'implementationId', v_target,
    'mode', v_mode,
    'previousImplementationDeleted', v_deleted
  );

  insert into public.access_audit_events (
    event_type, actor_user_id, target_user_id, previous_state, new_state
  )
  values (
    'CUSTOMER_ASSIGNMENT_CHANGED', p_actor_user_id, p_target_user_id, v_previous, v_new
  );

  return jsonb_build_object('mode', v_mode, 'implementationId', v_target);
end;
$$;

comment on function public.access_set_customer_implementation(uuid, uuid, uuid) is
  'Manage access. Attaches an active Customer to an implementation with no members, or starts a fresh one (reusing an empty current implementation). Membership move, deletion of an implementation left empty, and CUSTOMER_ASSIGNMENT_CHANGED audit commit together or not at all.';

alter function public.access_set_customer_implementation(uuid, uuid, uuid) owner to postgres;

revoke all on function public.access_set_customer_implementation(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.access_set_customer_implementation(uuid, uuid, uuid)
  to service_role;
