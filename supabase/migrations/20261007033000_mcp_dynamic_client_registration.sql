-- RFC 7591 DCR; ordered after the current production migration history.
-- OAuth 2.0 Dynamic Client Registration (RFC 7591) for MCP clients.
create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris jsonb not null check (jsonb_typeof(redirect_uris)='array' and jsonb_array_length(redirect_uris) between 1 and 10),
  grant_types jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  response_types jsonb not null default '["code"]'::jsonb,
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method='none'),
  application_type text not null check (application_type in ('native','web')),
  scope text not null default 'channeldesk.read',
  client_uri text,
  logo_uri text,
  software_id text,
  software_version text,
  registration_fingerprint text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists mcp_oauth_clients_fingerprint_issued_idx on public.mcp_oauth_clients(registration_fingerprint,issued_at desc);
create index if not exists mcp_oauth_clients_issued_idx on public.mcp_oauth_clients(issued_at desc);
alter table public.mcp_oauth_clients enable row level security;
revoke all on public.mcp_oauth_clients from public,anon,authenticated;
grant all on public.mcp_oauth_clients to service_role;

create or replace function public.register_mcp_oauth_client(
 p_client_id text,p_client_name text,p_redirect_uris jsonb,p_grant_types jsonb,p_response_types jsonb,
 p_token_endpoint_auth_method text,p_application_type text,p_scope text,p_client_uri text,p_logo_uri text,
 p_software_id text,p_software_version text,p_registration_fingerprint text
) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare issued timestamptz:=now(); per_source bigint; global_recent bigint;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mcp-dcr:'||p_registration_fingerprint,0));
 select count(*) into per_source from public.mcp_oauth_clients where registration_fingerprint=p_registration_fingerprint and issued_at>now()-interval '1 hour';
 if per_source>=20 then raise exception 'registration_rate_limited' using errcode='P0001'; end if;
 select count(*) into global_recent from public.mcp_oauth_clients where issued_at>now()-interval '1 minute';
 if global_recent>=120 then raise exception 'registration_rate_limited' using errcode='P0001'; end if;
 insert into public.mcp_oauth_clients(client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,application_type,scope,client_uri,logo_uri,software_id,software_version,registration_fingerprint,issued_at)
 values(p_client_id,p_client_name,p_redirect_uris,p_grant_types,p_response_types,p_token_endpoint_auth_method,p_application_type,p_scope,p_client_uri,p_logo_uri,p_software_id,p_software_version,p_registration_fingerprint,issued);
 return issued;
end $$;
revoke all on function public.register_mcp_oauth_client(text,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.register_mcp_oauth_client(text,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text) to service_role;
