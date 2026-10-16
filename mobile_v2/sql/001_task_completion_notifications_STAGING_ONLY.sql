-- V2 staging migration: review and test on a cloned Supabase project before applying to production.
-- Completion notifications for manager who assigned the task.
-- No historical attendance or existing task data is changed.
create schema if not exists energy_internal;
revoke all on schema energy_internal from public, anon, authenticated;

create or replace function energy_internal.notify_task_completion()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done'
     and new.created_by is not null and new.created_by <> new.employee_id then
    insert into public.notifications (user_id, title, message, type, link)
    values (
      new.created_by,
      'تم إنجاز مهمة',
      'الموظف أنجز المهمة: ' || left(new.title, 140),
      'task_completed',
      '/tasks'
    );
  end if;
  return new;
end;
$$;
revoke all on function energy_internal.notify_task_completion() from public, anon, authenticated;

drop trigger if exists energy_task_completion_notice on public.performance_tasks;
create trigger energy_task_completion_notice
after update of status on public.performance_tasks
for each row execute function energy_internal.notify_task_completion();

-- Protect the employee task update path: do not allow arbitrary field edits.
-- The current self-update RLS policy is row-scoped but not column-scoped.
-- Before enabling in production, audit all clients that currently write performance_tasks.
-- REVOKE UPDATE ON public.performance_tasks FROM authenticated;
-- GRANT UPDATE (status, completed_at, evidence_note) ON public.performance_tasks TO authenticated;
-- Managers need privileged server-side mutations (role checked) for full task management.
