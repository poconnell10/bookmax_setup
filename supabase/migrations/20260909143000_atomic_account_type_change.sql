-- Atomic Customer <-> Internal account-type conversion.
--
-- The application previously performed the transition as three independent
-- PostgREST writes (internal_staff upsert, implementation_users disable,
-- access_audit_events insert). A failure on any later write left the earlier
-- ones committed, producing a converted identity with no governance record.
--
-- This function performs the whole transition inside one statement, so an
-- exception anywhere rolls the entire transition back and the original
-- authorization state survives untouched.
--
-- Depends on 20260909003254_access_account_type_changed.sql, which is what
-- permits the ACCOUNT_TYPE_CHANGED audit value. Without that migration this
-- function raises on the audit insert and rolls the conversion back, which is
-- the intended safe failure.
--
-- Authorization is enforced here, server-side, against internal_staff. UI
-- gating and API-layer checks are never the only guard. Email domain is not
-- consulted; eligibility remains an application-layer policy.

create or replace function public.access_change_account_type(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_account_type text,
  p_role text default null,
  p_implementation_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_staff_role text;
  v_staff_status text;
  v_membership_id uuid;
  v_membership_implementation uuid;
  v_membership_status text;
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
    if p_implementation_id is null then
      raise exception 'invalid_input: customer access requires an implementation'
        using errcode = '22023';
    end if;

    if not exists (select 1 from public.implementations where id = p_implementation_id) then
      raise exception 'not_found: implementation does not exist'
        using errcode = 'P0002';
    end if;

    if v_staff_role is not null then
      delete from public.internal_staff where user_id = p_target_user_id;
    end if;

    if v_membership_id is not null then
      update public.implementation_users
        set implementation_id = p_implementation_id,
            status = 'active'
      where id = v_membership_id;
    else
      insert into public.implementation_users (implementation_id, user_id, role, status)
      values (p_implementation_id, p_target_user_id, 'customer', 'active');
    end if;

    v_new := jsonb_build_object(
      'accountType', 'customer',
      'role', 'customer',
      'status', 'active',
      'implementationId', p_implementation_id
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
  'Atomic Customer <-> Internal conversion. Membership transition and ACCOUNT_TYPE_CHANGED audit commit together or not at all.';

-- Keep the function off the public Data API. Only the server, acting as
-- service_role after its own JWT + Admin checks, may call it.
revoke all on function public.access_change_account_type(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.access_change_account_type(uuid, uuid, text, text, uuid)
  to service_role;
