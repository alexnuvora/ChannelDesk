-- Extend durable Planner schedule claims to Facebook Page posts.
create or replace function public.schedule_planner_publication(p_workspace_id uuid,p_actor_id uuid,p_connection_id uuid,p_media_id uuid,p_payload jsonb,p_scheduled_for timestamptz,p_request_id text,p_request_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.social_connections%rowtype;t public.publication_targets%rowtype;pid uuid;idem text;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 select * into c from public.social_connections where id=p_connection_id and workspace_id=p_workspace_id and active and network in ('youtube','tiktok','facebook');
 if not found then raise exception 'Active supported channel required' using errcode='22023';end if;
 if p_scheduled_for is null or not isfinite(p_scheduled_for) or p_scheduled_for<=now()+interval '1 minute' or p_request_id is null or length(p_request_id) not between 8 and 128 or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid schedule or request ID' using errcode='22023';end if;
 if c.network='facebook' then
  if p_media_id is not null then raise exception 'Facebook scheduling uses text or an HTTPS image URL' using errcode='22023';end if;
  if length(trim(coalesce(p_payload->>'message',''))) not between 1 and 5000 then raise exception 'Facebook post text is required' using errcode='22023';end if;
  if coalesce(p_payload->>'mediaUrl','')<>'' and coalesce(p_payload->>'mediaUrl','') !~ '^https://[^/[:space:]]+' then raise exception 'A public HTTPS image URL is required' using errcode='22023';end if;
  if not coalesce(c.scopes,'{}'::text[]) @> array['pages_manage_posts']::text[] then raise exception 'Reconnect Facebook and grant publishing permission' using errcode='22023';end if;
 else
  if p_media_id is not null then
   if not exists(select 1 from public.media_assets where id=p_media_id and workspace_id=p_workspace_id and mime_type like 'video/%' and storage_key like p_workspace_id::text||'/%') then raise exception 'Choose a video in this workspace' using errcode='22023';end if;
  elsif coalesce(p_payload->>'mediaUrl','') !~ '^https://' then raise exception 'Video URL required' using errcode='22023';end if;
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Post settings required' using errcode='22023';end if;
 if c.network='youtube' and (length(trim(coalesce(p_payload->>'title',''))) not between 1 and 100 or coalesce(p_payload->>'privacy','') not in ('private','unlisted','public') or jsonb_typeof(p_payload->'madeForKids') is distinct from 'boolean') then raise exception 'Explicit YouTube settings required' using errcode='22023';end if;
 if c.network='tiktok' and (coalesce(p_payload->>'privacy','') not in ('PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY') or jsonb_typeof(p_payload->'disableComment') is distinct from 'boolean' or jsonb_typeof(p_payload->'disableDuet') is distinct from 'boolean' or jsonb_typeof(p_payload->'disableStitch') is distinct from 'boolean') then raise exception 'Explicit TikTok settings required' using errcode='22023';end if;
 idem='planner:'||p_workspace_id::text||':'||p_request_id;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(idem,0));
 select * into t from public.publication_targets where idempotency_key=idem;
 if found then
  if t.request_hash is distinct from p_request_hash or t.connection_id<>p_connection_id then raise exception 'Request ID already used for different content' using errcode='22023';end if;
  return jsonb_build_object('publicationId',t.publication_id,'targetId',t.id,'state',t.state,'idempotentReplay',true);
 end if;
 insert into public.publications(workspace_id,author_id,text,state,scheduled_for) values(p_workspace_id,p_actor_id,coalesce(p_payload->>'title',p_payload->>'caption',p_payload->>'message',''),'scheduled',p_scheduled_for) returning id into pid;
 insert into public.publication_targets(publication_id,connection_id,network_payload,state,idempotency_key,request_hash) values(pid,p_connection_id,p_payload,'scheduled',idem,p_request_hash) returning * into t;
 if p_media_id is not null then insert into public.publication_media(publication_id,media_id,position) values(pid,p_media_id,0);end if;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,p_actor_id,'planner.scheduled','publication',pid::text,jsonb_build_object('scheduledFor',p_scheduled_for,'connectionId',p_connection_id));
 return jsonb_build_object('publicationId',pid,'targetId',t.id,'state','scheduled','scheduledFor',p_scheduled_for,'idempotentReplay',false);
end $$;
revoke all on function public.schedule_planner_publication(uuid,uuid,uuid,uuid,jsonb,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.schedule_planner_publication(uuid,uuid,uuid,uuid,jsonb,timestamptz,text,text) to service_role;

