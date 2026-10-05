-- Approval records are readable by members, creatable by content editors, but only approvers can decide them.
drop policy if exists "editors manage approval_requests" on public.approval_requests;
create policy "editors create approval requests" on public.approval_requests for insert to authenticated
with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')));
create policy "approvers update approval requests" on public.approval_requests for update to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','approver')))
with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','approver')));
