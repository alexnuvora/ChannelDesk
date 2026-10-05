create or replace function public.issue_mcp_oauth_code(
  p_code_hash text,
  p_client_id text,
  p_redirect_uri text,
  p_resource text,
  p_scope text,
  p_code_challenge text,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  insert into public.mcp_oauth_codes(code_hash,user_id,client_id,redirect_uri,resource,scope,code_challenge,expires_at)
  values(p_code_hash,auth.uid(),p_client_id,p_redirect_uri,p_resource,p_scope,p_code_challenge,p_expires_at);
end;
$$;
revoke all on function public.issue_mcp_oauth_code(text,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.issue_mcp_oauth_code(text,text,text,text,text,text,timestamptz) to authenticated;
