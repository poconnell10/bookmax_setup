-- Allow Admins to record explicit account-type conversions
-- (Customer ↔ Internal). Authorization remains auth.users.id + store rows,
-- never email domain.

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
      'ACCOUNT_TYPE_CHANGED'
    )
  );
