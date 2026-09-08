-- Disabled customer must not retain PostgREST access via an existing JWT.
-- Membership remains; only status = active authorizes customer row access.
-- Apply to QA (rnnlceroqzmxovsynzni) only. Do not apply to Production without CTO approval.

drop policy if exists implementation_users_select_own on public.implementation_users;
create policy implementation_users_select_own
  on public.implementation_users
  for select
  to authenticated
  using (user_id = auth.uid() and status = 'active');

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
        and u.status = 'active'
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
        and u.status = 'active'
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
        and u.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = properties.implementation_id
        and u.user_id = auth.uid()
        and u.status = 'active'
    )
  );

drop policy if exists implementation_intake_select_own on public.implementation_intake;
create policy implementation_intake_select_own
  on public.implementation_intake
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = implementation_intake.implementation_id
        and u.user_id = auth.uid()
        and u.status = 'active'
    )
  );

drop policy if exists implementation_submissions_select_own on public.implementation_submissions;
create policy implementation_submissions_select_own
  on public.implementation_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.implementation_users u
      where u.implementation_id = implementation_submissions.implementation_id
        and u.user_id = auth.uid()
        and u.status = 'active'
    )
  );
