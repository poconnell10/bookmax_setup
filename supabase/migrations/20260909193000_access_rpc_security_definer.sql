-- Fix the privilege boundary that made every access RPC fail with 42501.
--
-- access_change_account_type, access_disable and access_reactivate were
-- SECURITY INVOKER. The application calls them through PostgREST as
-- service_role, and service_role has no SELECT on auth.users, so the target
-- existence check raised "permission denied for table users". The transaction
-- rolled back correctly and no partial state was ever written, but the
-- operation was impossible to complete: HTTP 503 on every attempt.
--
-- The earlier QA proofs ran through a superuser connection, which can read
-- auth.users, so the boundary was never exercised.
--
-- The fix is the narrowest one available: run the three functions as their
-- owner instead of the caller. This grants exactly the reads the function body
-- already performs, and nothing else. The alternative, granting service_role
-- general SELECT on auth.users, would widen access far beyond these three
-- call sites and is deliberately not used.
--
-- Safety properties preserved:
--   * the internal Admin authorization check inside each function is unchanged
--     and still runs server-side, so SECURITY DEFINER does not become a bypass
--   * EXECUTE stays revoked from public, anon and authenticated, and granted
--     only to service_role, so the elevated body is unreachable from the
--     public Data API
--   * search_path is pinned to empty so no caller-controlled schema can shadow
--     an object referenced inside the body; every reference is fully qualified
--   * the function bodies are otherwise byte-identical to the versions proven
--     in QA, so transactional behaviour and audit payloads do not change

alter function public.access_change_account_type(uuid, uuid, text, text, uuid)
  security definer
  set search_path = '';

alter function public.access_disable(uuid, uuid)
  security definer
  set search_path = '';

alter function public.access_reactivate(uuid, uuid)
  security definer
  set search_path = '';

-- Ownership determines the privileges the body runs with. postgres holds the
-- SELECT on auth.users that the target existence check needs.
alter function public.access_change_account_type(uuid, uuid, text, text, uuid) owner to postgres;
alter function public.access_disable(uuid, uuid) owner to postgres;
alter function public.access_reactivate(uuid, uuid) owner to postgres;

-- Re-assert the execute boundary. Ownership changes reset nothing here, but
-- stating it keeps the guarantee visible in one place.
revoke all on function public.access_change_account_type(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.access_disable(uuid, uuid) from public, anon, authenticated;
revoke all on function public.access_reactivate(uuid, uuid) from public, anon, authenticated;

grant execute on function public.access_change_account_type(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.access_disable(uuid, uuid) to service_role;
grant execute on function public.access_reactivate(uuid, uuid) to service_role;
