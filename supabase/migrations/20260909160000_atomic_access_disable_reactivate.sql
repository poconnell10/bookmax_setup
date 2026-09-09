-- Atomic Disable / Reactivate access.
--
-- Both paths previously performed two independent PostgREST writes with the
-- audit event last: the authorization status change (internal_staff.status or
-- implementation_users.status), then ACCESS_DISABLED / ACCESS_REACTIVATED. A
-- failure on the audit write left the access change committed with no
-- governance record, behind a failed API response.
--
-- Each function below performs the whole operation inside one statement, so an
-- exception anywhere rolls the operation back and the caller's authorization
-- state is left exactly as it was.
--
-- Semantics are preserved from the application at 93eeeba, not redefined:
--   * internal_staff takes precedence over implementation_users, matching
--     resolveAuthorization, which treats any internal_staff row as
--     authoritative regardless of its status.
--   * the role, the implementation reference and the auth identity are never
--     changed; only a status moves.
--   * no row is ever deleted, so history survives.
--   * the audit payload shape is byte-for-byte the shape the application wrote.
--
-- The one addition is in access_reactivate: when an internal_staff row is
-- reactivated and a customer membership is also present, the membership is
-- disabled. This enforces the already-approved invariant that only one
-- authorization path may be active at a time. Without it, reactivating a
-- disabled staff row for an identity whose membership had been re-provisioned
-- would leave both rows active.
--
-- Authorization is enforced here, server-side, against internal_staff, using
-- the same rule as access_change_account_type: the actor must be role='admin'
-- and status='active'. The internal_staff_last_admin trigger remains the
-- backstop preventing the last active Admin from being disabled, and now fires
-- inside the same transaction.

create or replace function public.access_disable(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_staff_role text;
  v_membership_id uuid;
  v_previous jsonb;
  v_new jsonb;
begin
  select role, status
    into v_actor_role, v_actor_status
  from public.internal_staff
  where user_id = p_actor_user_id;

  if v_actor_role is distinct from 'admin' or v_actor_status is distinct from 'active' then
    raise exception 'forbidden: only an active Admin can disable access'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'not_found: target identity does not exist'
      using errcode = 'P0002';
  end if;

  select role into v_staff_role
  from public.internal_staff
  where user_id = p_target_user_id;

  select id into v_membership_id
  from public.implementation_users
  where user_id = p_target_user_id;

  if v_staff_role is not null then
    update public.internal_staff
      set status = 'disabled',
          provisioned_by = p_actor_user_id,
          updated_at = now()
    where user_id = p_target_user_id;
  elsif v_membership_id is not null then
    update public.implementation_users
      set status = 'disabled'
    where id = v_membership_id;
  else
    raise exception 'invalid_input: this user has no access to disable'
      using errcode = '22023';
  end if;

  v_previous := jsonb_build_object('status', 'active', 'role', coalesce(v_staff_role, 'customer'));
  v_new := jsonb_build_object('status', 'disabled');

  insert into public.access_audit_events (
    event_type, actor_user_id, target_user_id, previous_state, new_state
  )
  values (
    'ACCESS_DISABLED', p_actor_user_id, p_target_user_id, v_previous, v_new
  );

  return jsonb_build_object('previousState', v_previous, 'newState', v_new);
end;
$$;

create or replace function public.access_reactivate(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_staff_role text;
  v_membership_id uuid;
  v_previous jsonb;
  v_new jsonb;
begin
  select role, status
    into v_actor_role, v_actor_status
  from public.internal_staff
  where user_id = p_actor_user_id;

  if v_actor_role is distinct from 'admin' or v_actor_status is distinct from 'active' then
    raise exception 'forbidden: only an active Admin can reactivate access'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'not_found: target identity does not exist'
      using errcode = 'P0002';
  end if;

  select role into v_staff_role
  from public.internal_staff
  where user_id = p_target_user_id;

  select id into v_membership_id
  from public.implementation_users
  where user_id = p_target_user_id;

  if v_staff_role is not null then
    update public.internal_staff
      set status = 'active',
          provisioned_by = p_actor_user_id,
          updated_at = now()
    where user_id = p_target_user_id;

    -- Only one authorization path may be active. The membership row and its
    -- implementation reference are preserved; the row is disabled, not deleted.
    if v_membership_id is not null then
      update public.implementation_users
        set status = 'disabled'
      where id = v_membership_id;
    end if;
  elsif v_membership_id is not null then
    update public.implementation_users
      set status = 'active'
    where id = v_membership_id;
  else
    raise exception 'invalid_input: this user has no access to reactivate'
      using errcode = '22023';
  end if;

  v_previous := jsonb_build_object('status', 'disabled');
  v_new := jsonb_build_object('status', 'active', 'role', coalesce(v_staff_role, 'customer'));

  insert into public.access_audit_events (
    event_type, actor_user_id, target_user_id, previous_state, new_state
  )
  values (
    'ACCESS_REACTIVATED', p_actor_user_id, p_target_user_id, v_previous, v_new
  );

  return jsonb_build_object('previousState', v_previous, 'newState', v_new);
end;
$$;

comment on function public.access_disable(uuid, uuid) is
  'Atomic Disable. Authorization status change and ACCESS_DISABLED audit commit together or not at all.';

comment on function public.access_reactivate(uuid, uuid) is
  'Atomic Reactivate. Authorization status change and ACCESS_REACTIVATED audit commit together or not at all.';

-- Keep both functions off the public Data API. Only the server, acting as
-- service_role after its own JWT + Admin checks, may call them.
revoke all on function public.access_disable(uuid, uuid) from public, anon, authenticated;
revoke all on function public.access_reactivate(uuid, uuid) from public, anon, authenticated;

grant execute on function public.access_disable(uuid, uuid) to service_role;
grant execute on function public.access_reactivate(uuid, uuid) to service_role;
