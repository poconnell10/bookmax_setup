-- First-time Customer provisioning creates the customer's own implementation.
--
-- Customer authorization is an active public.implementation_users row, and
-- implementation_id is NOT NULL. Provisioning therefore required an
-- implementation that already existed, and no application path created one for
-- the identity being provisioned. The only selectable implementations belonged
-- to other customers, so onboarding a newly verified identity either could not
-- proceed or attached that identity to another tenant.
--
-- access_provision_customer closes that gap: the new implementation, the
-- membership and the USER_PROVISIONED audit event are written inside one
-- statement. An exception anywhere rolls all three back, so a failed grant can
-- never leave an orphaned implementation behind.
--
-- implementation_id stays NOT NULL. No new role is introduced. A customer who
-- has not created a property yet is simply an implementation at status
-- 'started' with no public.properties row, which the setup flow already treats
-- as "resume at the property step".
--
-- Authorization is enforced here, server-side, against internal_staff, using
-- the same rule as the other access functions: the actor must be role='admin'
-- and status='active'. SECURITY DEFINER with an empty search_path matches
-- 20260909193000, which the auth.users existence check requires.

create or replace function public.access_provision_customer(
  p_actor_user_id uuid,
  p_target_user_id uuid
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
  v_previous jsonb;
  v_new jsonb;
begin
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

  v_new := jsonb_build_object(
    'accountType', 'customer',
    'role', 'customer',
    'status', 'active',
    'implementationId', v_implementation_id
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

comment on function public.access_provision_customer(uuid, uuid) is
  'First-time Customer provisioning. Creates the identity own implementation (status started), its membership and the USER_PROVISIONED audit together or not at all. Never attaches the identity to an existing implementation.';

alter function public.access_provision_customer(uuid, uuid) owner to postgres;

revoke all on function public.access_provision_customer(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.access_provision_customer(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Converting an identity to Customer no longer requires a target implementation
-- when that identity has no membership yet.
--
-- Same defect as provisioning: an Internal identity being changed to Customer
-- had to be pointed at an implementation that already existed. When
-- p_implementation_id is null and no membership exists, a new implementation is
-- created inside the same transaction.
--
-- Explicit reassignment is preserved. A supplied p_implementation_id is still
-- validated and still moves an existing membership, so Manage keeps requiring
-- an explicit target when an Admin moves a Customer between implementations.
--
-- Everything else is carried over unchanged from 20260909143000: the Admin
-- check, the single-active-authorization-path invariant, the preserved
-- membership history, and the ACCOUNT_TYPE_CHANGED audit payload shape.
-- ---------------------------------------------------------------------------

create or replace function public.access_change_account_type(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_account_type text,
  p_role text default null,
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
  v_staff_role text;
  v_staff_status text;
  v_membership_id uuid;
  v_membership_implementation uuid;
  v_membership_status text;
  v_target_implementation uuid;
  v_previous jsonb;
  v_new jsonb;
begin
  if p_account_type is null or p_account_type not in ('internal', 'customer') then
    raise exception 'invalid_input: account type must be internal or customer'
      using errcode = '22023';
  end if;

  -- Caller authorization. Only an active Admin may convert an account type.
  select role, status
    into v_actor_role, v_actor_status
  from public.internal_staff
  where user_id = p_actor_user_id;

  if v_actor_role is distinct from 'admin' or v_actor_status is distinct from 'active' then
    raise exception 'forbidden: only an active Admin can change an account type'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'not_found: target identity does not exist'
      using errcode = 'P0002';
  end if;

  select role, status
    into v_staff_role, v_staff_status
  from public.internal_staff
  where user_id = p_target_user_id;

  select id, implementation_id, status
    into v_membership_id, v_membership_implementation, v_membership_status
  from public.implementation_users
  where user_id = p_target_user_id;

  v_previous := jsonb_build_object(
    'accountType',
    case
      when v_staff_role is not null then 'internal'
      when v_membership_id is not null then 'customer'
      else 'unassigned'
    end,
    'role',
    coalesce(v_staff_role, case when v_membership_id is not null then 'customer' end),
    'status',
    coalesce(v_staff_status, v_membership_status, 'pending'),
    'implementationId',
    v_membership_implementation
  );

  if p_account_type = 'internal' then
    if p_role is null or p_role not in ('viewer', 'engineer', 'admin') then
      raise exception 'invalid_input: role must be viewer, engineer, or admin'
        using errcode = '22023';
    end if;

    insert into public.internal_staff (user_id, role, status, provisioned_by, updated_at)
    values (p_target_user_id, p_role, 'active', p_actor_user_id, now())
    on conflict (user_id) do update
      set role = excluded.role,
          status = excluded.status,
          provisioned_by = excluded.provisioned_by,
          updated_at = excluded.updated_at;

    -- Only one authorization path may remain active. The membership row and its
    -- implementation reference are preserved for history; the row is disabled,
    -- never deleted.
    if v_membership_id is not null then
      update public.implementation_users
        set status = 'disabled'
      where id = v_membership_id;
    end if;

    v_new := jsonb_build_object(
      'accountType', 'internal',
      'role', p_role,
      'status', 'active'
    );
  else
    if p_implementation_id is not null
       and not exists (select 1 from public.implementations where id = p_implementation_id) then
      raise exception 'not_found: implementation does not exist'
        using errcode = 'P0002';
    end if;

    if v_staff_role is not null then
      delete from public.internal_staff where user_id = p_target_user_id;
    end if;

    if v_membership_id is not null then
      -- Reassignment stays explicit: without a target the identity keeps the
      -- implementation it already belongs to.
      v_target_implementation := coalesce(p_implementation_id, v_membership_implementation);
      update public.implementation_users
        set implementation_id = v_target_implementation,
            status = 'active'
      where id = v_membership_id;
    else
      if p_implementation_id is null then
        insert into public.implementations (status)
        values ('started')
        returning id into v_target_implementation;
      else
        v_target_implementation := p_implementation_id;
      end if;

      insert into public.implementation_users (implementation_id, user_id, role, status)
      values (v_target_implementation, p_target_user_id, 'customer', 'active');
    end if;

    v_new := jsonb_build_object(
      'accountType', 'customer',
      'role', 'customer',
      'status', 'active',
      'implementationId', v_target_implementation
    );
  end if;

  insert into public.access_audit_events (
    event_type, actor_user_id, target_user_id, previous_state, new_state
  )
  values (
    'ACCOUNT_TYPE_CHANGED', p_actor_user_id, p_target_user_id, v_previous, v_new
  );

  return jsonb_build_object('previousState', v_previous, 'newState', v_new);
end;
$$;

comment on function public.access_change_account_type(uuid, uuid, text, text, uuid) is
  'Atomic Customer <-> Internal conversion. Membership transition and ACCOUNT_TYPE_CHANGED audit commit together or not at all. A conversion to Customer with no existing membership and no target creates a new implementation.';

alter function public.access_change_account_type(uuid, uuid, text, text, uuid) owner to postgres;

revoke all on function public.access_change_account_type(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.access_change_account_type(uuid, uuid, text, text, uuid)
  to service_role;
