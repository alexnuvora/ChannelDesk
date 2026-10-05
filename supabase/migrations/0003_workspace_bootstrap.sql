-- Atomic workspace bootstrap for authenticated users.
-- SECURITY DEFINER is required only for this controlled bootstrap path because
-- workspace_members RLS cannot authorize a user before their first membership exists.
create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication required';
  end if;
  if length(trim(workspace_name)) < 2 then
    raise exception 'workspace name is too short';
  end if;
  if workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
    raise exception 'invalid workspace slug';
  end if;

  insert into public.workspaces(name, slug)
  values (trim(workspace_name), lower(workspace_slug))
  returning id into new_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, caller, 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text,text) from public, anon;
grant execute on function public.create_workspace(text,text) to authenticated;
