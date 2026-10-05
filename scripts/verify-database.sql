-- Read-only verification: no user records, credentials or tokens are emitted.
do $$
begin
 if to_regprocedure('public.exchange_mcp_oauth_code(text,text,text,text,text,text,text)') is null then raise exception 'OAuth exchange migration missing'; end if;
 if to_regprocedure('public.rotate_mcp_oauth_token(text,text,text,text,text,text)') is null then raise exception 'OAuth refresh migration missing'; end if;
 if has_function_privilege('anon','public.exchange_mcp_oauth_code(text,text,text,text,text,text,text)','execute') or has_function_privilege('authenticated','public.exchange_mcp_oauth_code(text,text,text,text,text,text,text)','execute') then raise exception 'OAuth exchange must be server-only'; end if;
 if has_function_privilege('authenticated','public.issue_mcp_oauth_code(text,text,text,text,text,text,timestamptz)','execute') then raise exception 'Legacy grant issuance must be disabled'; end if;
 if has_column_privilege('authenticated','public.social_connections','token_ciphertext','select') then raise exception 'Channel token column is exposed'; end if;
 if not has_function_privilege('service_role','public.claim_youtube_publication(uuid,uuid,uuid,jsonb,text,text)','execute') then raise exception 'Publishing RPC grant missing'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('workspaces','workspace_members','social_connections','media_assets','publications','publication_targets','publication_media','audit_events','mcp_oauth_codes','mcp_oauth_tokens') and not c.relrowsecurity) then raise exception 'RLS must be enabled'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='social_connections' and qual like '%social_connections.workspace_id%') then raise exception 'Connection workspace predicate missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='publications' and qual like '%publications.workspace_id%') then raise exception 'Publication workspace predicate missing'; end if;
end $$;
select 'ChannelDesk schema and access checks passed' as verification;
