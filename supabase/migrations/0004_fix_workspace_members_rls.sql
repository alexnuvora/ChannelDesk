-- Fix recursive workspace membership RLS and provide safe self-membership lookup.

drop policy if exists "members can view workspace membership" on public.workspace_members;

create policy "users can view own workspace memberships"
on public.workspace_members
for select
to authenticated
using ((select auth.uid()) = user_id);
