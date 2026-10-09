-- Admin provisioning can create the customer's property in the same statement.
--
-- access_provision_customer gains two optional parameters, p_property_name and
-- p_contact_name. When both are supplied, the implementation, the membership,
-- the properties row, the status move to 'property_complete' and the
-- USER_PROVISIONED audit event commit together or not at all. When both are
-- null the behaviour is exactly the previous two-argument function.
--
-- The application calls this function through PostgREST with named arguments.
-- CREATE OR REPLACE with a longer argument list would leave the old
-- (uuid, uuid) function in place as a second overload, and a two-argument named
-- call would then match both and fail as ambiguous. The old signature is
-- therefore dropped and the function recreated, inside this one migration, so
-- exactly one function exists and existing two-argument callers resolve to it
-- with the new parameters defaulting to null.
--
-- New guard: provisioning is refused when the target has an internal_staff row
-- in ANY status. resolveAuthorization treats any staff row as authoritative, so
-- a disabled staff row would land a provisioned Customer on /access/denied.
--
-- implementation_intake is deliberately not written. PMS/POS connection stays
-- with the customer's /setup/pms step.

drop function if exists public.access_provision_customer(uuid, uuid);

create function public.access_provision_customer(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_property_name text default null,
  p_contact_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_staff_status text;
  v_membership_id uuid;
  v_membership_status text;
  v_implementation_id uuid;
  v_property_name text := nullif(trim(p_property_name), '');
  v_contact_name text := nullif(trim(p_contact_name), '');
  v_property_created boolean := false;
  v_previous jsonb;
  v_new jsonb;
begin
  if (v_property_name is null) <> (v_contact_name is null) then
    raise exception 'invalid_input: property name and contact name must be supplied together'
      using errcode = '22023';
  end if;

  select role, status
    into v_actor_role, v_actor_status
  from public.internal_staff
  where user_id = p_actor_user_id;

  if v_actor_role is distinct from 'admin' or v_actor_status is distinct from 'active' then
    raise exception 'forbidden: only an active Admin can provision Customer access'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'not_found: target identity does not exist'
      using errcode = 'P0002';
  end if;

  select status into v_staff_status
  from public.internal_staff
  where user_id = p_target_user_id;

  if v_staff_status = 'active' then
    raise exception 'invalid_input: this user already has BookMax access'
      using errcode = '22023';
  end if;

  if v_staff_status is not null then
    raise exception 'internal_account: this user has an internal account'
      using errcode = '22023';
  end if;

  select id, implementation_id, status
    into v_membership_id, v_implementation_id, v_membership_status
  from public.implementation_users
  where user_id = p_target_user_id;

  if v_membership_status = 'active' then
    raise exception 'invalid_input: this user already has BookMax access'
      using errcode = '22023';
  end if;

  v_previous := jsonb_build_object(
    'accountType',
    case when v_membership_id is not null then 'customer' else 'unassigned' end,
    'role',
    case when v_membership_id is not null then 'customer' end,
    'status',
    coalesce(v_membership_status, 'pending')
  );

  if v_membership_id is not null then
    -- An identity whose membership was disabled keeps the implementation it
    -- already had. Re-granting access must not strand its existing setup.
    update public.implementation_users
      set status = 'active'
    where id = v_membership_id;
  else
    insert into public.implementations (status)
    values ('started')
    returning id into v_implementation_id;

    insert into public.implementation_users (implementation_id, user_id, role, status)
    values (v_implementation_id, p_target_user_id, 'customer', 'active');
  end if;

  if v_property_name is not null then
    begin
      insert into public.properties (implementation_id, name, contact_name)
      values (v_implementation_id, v_property_name, v_contact_name);
    exception when unique_violation then
      raise exception 'property_exists: this implementation already has a property'
        using errcode = '23505';
    end;
    v_property_created := true;

    update public.implementations
      set status = 'property_complete'
    where id = v_implementation_id
      and status = 'started';
  end if;

  v_new := jsonb_build_object(
    'accountType', 'customer',
    'role', 'customer',
    'status', 'active',
    'implementationId', v_implementation_id,
    'propertyCreated', v_property_created
  );

  insert into public.access_audit_events (
    event_type, actor_user_id, target_user_id, previous_state, new_state
  )
  values (
    'USER_PROVISIONED', p_actor_user_id, p_target_user_id, v_previous, v_new
  );

  return jsonb_build_object('previousState', v_previous, 'newState', v_new);
end;
$$;

comment on function public.access_provision_customer(uuid, uuid, text, text) is
  'Customer provisioning. Creates or reactivates the identity own implementation and membership, optionally its properties row (status property_complete), and the USER_PROVISIONED audit together or not at all. Refuses any internal_staff row.';

alter function public.access_provision_customer(uuid, uuid, text, text) owner to postgres;

revoke all on function public.access_provision_customer(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.access_provision_customer(uuid, uuid, text, text)
  to service_role;
