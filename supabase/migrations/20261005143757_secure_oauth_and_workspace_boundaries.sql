-- Repair tenant predicates: unqualified workspace_id inside a subquery resolves
-- to workspace_members.workspace_id, making the former check a tautology.
drop policy if exists "members can view connections" on public.social_connections;
drop policy if exists "editors can manage connections" on public.social_connections;
create policy "members can view connections" on public.social_connections for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=social_connections.workspace_id and wm.user_id=(select auth.uid())));
-- Connection secrets can be written only by the server after a role check.
revoke all on public.social_connections from anon, authenticated;
grant select(id,workspace_id,network,external_account_id,display_name,scopes,token_expires_at,active,created_at) on public.social_connections to authenticated;

drop policy if exists "members can view media" on public.media_assets;
drop policy if exists "editors can manage media" on public.media_assets;
create policy "members can view media" on public.media_assets for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=media_assets.workspace_id and wm.user_id=(select auth.uid())));
create policy "editors can manage media" on public.media_assets for all to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=media_assets.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')))
with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=media_assets.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')));

drop policy if exists "members can view publications" on public.publications;
drop policy if exists "editors can manage publications" on public.publications;
create policy "members can view publications" on public.publications for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=publications.workspace_id and wm.user_id=(select auth.uid())));
create policy "editors can manage publications" on public.publications for all to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=publications.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')))
with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=publications.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')));

drop policy if exists "members can view audit events" on public.audit_events;
create policy "members can view audit events" on public.audit_events for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=audit_events.workspace_id and wm.user_id=(select auth.uid())));

-- Reject cross-workspace target and media references, including direct Data API writes.
create or replace function public.check_publication_workspace() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='publication_targets' then
  if not exists(select 1 from public.publications p join public.social_connections c on c.workspace_id=p.workspace_id where p.id=new.publication_id and c.id=new.connection_id) then
   raise exception 'Publication and connection must belong to the same workspace' using errcode='23514';
  end if;
 else
  if not exists(select 1 from public.publications p join public.media_assets m on m.workspace_id=p.workspace_id where p.id=new.publication_id and m.id=new.media_id) then
   raise exception 'Publication and media must belong to the same workspace' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger check_target_workspace before insert or update of publication_id,connection_id on public.publication_targets for each row execute function public.check_publication_workspace();
create trigger check_media_workspace before insert or update of publication_id,media_id on public.publication_media for each row execute function public.check_publication_workspace();
revoke all on function public.check_publication_workspace() from public,anon,authenticated;

-- Explicit grants are required on new Supabase projects (April 2026 change).
grant select on public.workspaces,public.workspace_members,public.audit_events to authenticated;
grant select,insert,update,delete on public.media_assets,public.publications,public.publication_targets,public.publication_media to authenticated;
grant all on public.workspaces,public.workspace_members,public.social_connections,public.media_assets,public.publications,public.publication_targets,public.publication_media,public.audit_events,public.mcp_oauth_codes,public.mcp_oauth_tokens to service_role;
grant usage,select on sequence public.audit_events_id_seq to service_role;
-- The earlier RPC allowed a client to mint grants without app consent validation.
revoke all on function public.issue_mcp_oauth_code(text,text,text,text,text,text,timestamptz) from public,anon,authenticated;

-- Consumption and issuance are a single transaction. Concurrent code/refresh
-- replays cannot mint a second token pair; failed inserts roll back consumption.
create or replace function public.exchange_mcp_oauth_code(p_code_hash text,p_client_id text,p_redirect_uri text,p_resource text,p_code_challenge text,p_access_hash text,p_refresh_hash text)
returns text language plpgsql security invoker set search_path='' as $$
declare grant_row public.mcp_oauth_codes%rowtype;
begin
 delete from public.mcp_oauth_codes where code_hash=p_code_hash and client_id=p_client_id and redirect_uri=p_redirect_uri and resource=p_resource and code_challenge=p_code_challenge and expires_at>now() returning * into grant_row;
 if not found then raise exception 'Invalid grant' using errcode='22023'; end if;
 insert into public.mcp_oauth_tokens(token_hash,user_id,client_id,resource,scope,token_type,expires_at) values
 (p_access_hash,grant_row.user_id,grant_row.client_id,grant_row.resource,grant_row.scope,'access',now()+interval '1 hour'),
 (p_refresh_hash,grant_row.user_id,grant_row.client_id,grant_row.resource,grant_row.scope,'refresh',now()+interval '30 days');
 return grant_row.scope;
end $$;
revoke all on function public.exchange_mcp_oauth_code(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.exchange_mcp_oauth_code(text,text,text,text,text,text,text) to service_role;

create or replace function public.rotate_mcp_oauth_token(p_token_hash text,p_client_id text,p_resource text,p_scope text,p_access_hash text,p_refresh_hash text)
returns text language plpgsql security invoker set search_path='' as $$
declare grant_row public.mcp_oauth_tokens%rowtype; next_scope text;
begin
 update public.mcp_oauth_tokens set revoked_at=now() where token_hash=p_token_hash and client_id=p_client_id and resource=p_resource and token_type='refresh' and revoked_at is null and expires_at>now() returning * into grant_row;
 if not found then raise exception 'Invalid grant' using errcode='22023'; end if;
 next_scope=coalesce(p_scope,grant_row.scope);
 if not (string_to_array(next_scope,' ') <@ string_to_array(grant_row.scope,' ')) then raise exception 'Invalid scope' using errcode='22023'; end if;
 insert into public.mcp_oauth_tokens(token_hash,user_id,client_id,resource,scope,token_type,expires_at) values
 (p_access_hash,grant_row.user_id,grant_row.client_id,grant_row.resource,next_scope,'access',now()+interval '1 hour'),
 (p_refresh_hash,grant_row.user_id,grant_row.client_id,grant_row.resource,next_scope,'refresh',least(grant_row.expires_at,now()+interval '30 days'));
 return next_scope;
end $$;
revoke all on function public.rotate_mcp_oauth_token(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.rotate_mcp_oauth_token(text,text,text,text,text,text) to service_role;

alter table public.publications drop constraint publications_state_check;
alter table public.publications add constraint publications_state_check check(state in ('draft','pending_approval','scheduled','publishing','published','failed','cancelled','needs_review'));
alter table public.publication_targets add column request_hash text;

create or replace function public.claim_youtube_publication(p_workspace_id uuid,p_actor_id uuid,p_connection_id uuid,p_payload jsonb,p_request_id text,p_request_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare idem text; target public.publication_targets%rowtype; publication_id uuid;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501'; end if;
 if not exists(select 1 from public.social_connections where id=p_connection_id and workspace_id=p_workspace_id and network='youtube' and active) then raise exception 'Invalid channel account' using errcode='22023'; end if;
 idem='youtube:'||p_workspace_id::text||':'||p_request_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(idem,0));
 select * into target from public.publication_targets where idempotency_key=idem;
 if found then
  if target.request_hash is distinct from p_request_hash then raise exception 'Request ID was already used for different content' using errcode='22023'; end if;
  return jsonb_build_object('publicationId',target.publication_id,'targetId',target.id,'videoId',target.external_post_id,'url',target.external_url,'state',target.state,'idempotentReplay',true);
 end if;
 insert into public.publications(workspace_id,author_id,text,state,scheduled_for) values(p_workspace_id,p_actor_id,coalesce(p_payload->>'description',''),'publishing',(p_payload->>'scheduledFor')::timestamptz) returning id into publication_id;
 insert into public.publication_targets(publication_id,connection_id,network_payload,state,idempotency_key,request_hash) values(publication_id,p_connection_id,p_payload,'publishing',idem,p_request_hash) returning * into target;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,p_actor_id,'youtube.publish_requested','publication',publication_id::text,jsonb_build_object('connectionId',p_connection_id,'requestId',p_request_id));
 return jsonb_build_object('publicationId',publication_id,'targetId',target.id,'state','publishing','idempotentReplay',false);
end $$;
revoke all on function public.claim_youtube_publication(uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.claim_youtube_publication(uuid,uuid,uuid,jsonb,text,text) to service_role;

create or replace function public.finish_youtube_publication(p_publication_id uuid,p_target_id uuid,p_state text,p_video_id text,p_error text,p_actor_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from public.publications where id=p_publication_id;
 if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501'; end if;
 update public.publication_targets set state=p_state,external_post_id=p_video_id,external_url=case when p_video_id is null then null else 'https://www.youtube.com/watch?v='||p_video_id end,error_code=case when p_error is null then null else 'youtube_upload_failed' end,error_message=p_error,attempts=1,published_at=case when p_state='published' then now() else null end where id=p_target_id and publication_id=p_publication_id and state='publishing';
 if not found then raise exception 'Publication state changed' using errcode='22023'; end if;
 update public.publications set state=p_state,updated_at=now() where id=p_publication_id;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(w,p_actor_id,'youtube.'||p_state,'publication',p_publication_id::text,jsonb_build_object('videoId',p_video_id));
end $$;
revoke all on function public.finish_youtube_publication(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.finish_youtube_publication(uuid,uuid,text,text,text,uuid) to service_role;

create or replace function public.update_youtube_delivery(p_publication_id uuid,p_target_id uuid,p_actor_id uuid,p_state text,p_scheduled_for timestamptz,p_error text,p_action text,p_expected_updated_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from public.publications where id=p_publication_id;
 if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501'; end if;
 update public.publications set state=p_state,scheduled_for=p_scheduled_for,updated_at=now() where id=p_publication_id and updated_at=p_expected_updated_at;
 if not found then raise exception 'Publication changed; refresh status' using errcode='40001'; end if;
 update public.publication_targets set state=p_state,error_code=p_error,error_message=null,published_at=case when p_state='published' then coalesce(published_at,now()) else published_at end where id=p_target_id and publication_id=p_publication_id;
 if not found then raise exception 'Publication target not found' using errcode='22023'; end if;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id) values(w,p_actor_id,p_action,'publication',p_publication_id::text);
end $$;
revoke all on function public.update_youtube_delivery(uuid,uuid,uuid,text,timestamptz,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.update_youtube_delivery(uuid,uuid,uuid,text,timestamptz,text,text,timestamptz) to service_role;
-- Publishing state and attribution are changed through audited server operations.
revoke insert,update,delete on public.publications,public.publication_targets,public.publication_media from authenticated;
