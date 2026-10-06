-- Temporary demo access for TikTok review browser automation.
-- Uses dynamic SQL so local PGlite tests (which do not have Supabase's auth schema)
-- treat this as a no-op, while production resolves users safely by email.
do $$
begin
  if to_regclass('auth.users') is not null then
    execute $link$
      insert into public.workspace_members(workspace_id,user_id,role)
      select distinct sc.workspace_id,demo.id,'editor'
      from auth.users demo
      join auth.users owner_user on lower(owner_user.email)=lower('alex.nuvora@gmail.com')
      join public.workspace_members owner_member on owner_member.user_id=owner_user.id and owner_member.role='owner'
      join public.social_connections sc on sc.workspace_id=owner_member.workspace_id and sc.network='tiktok' and sc.active
      where lower(demo.email)=lower('alex.nuvora+channeldesk-demo@gmail.com')
      on conflict (workspace_id,user_id) do update set role=excluded.role
    $link$;
  end if;
end
$$;
