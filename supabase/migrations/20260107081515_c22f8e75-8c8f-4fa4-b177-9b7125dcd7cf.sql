-- Allow only admins to modify ZK attendance logs

-- 1) Helper function (avoids repeating logic in policies)
create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = 'admin'
  );
$$;

-- 2) Policies for UPDATE/DELETE
-- (SELECT policy already exists: "Authenticated users can view attendance logs")

drop policy if exists "Admins can update attendance logs" on public.zk_attendance_logs;
create policy "Admins can update attendance logs"
on public.zk_attendance_logs
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can delete attendance logs" on public.zk_attendance_logs;
create policy "Admins can delete attendance logs"
on public.zk_attendance_logs
for delete
to authenticated
using (public.is_admin(auth.uid()));
