-- Durable/idempotent TikTok delivery tracking, matching the YouTube publication guarantees.
create or replace function public.claim_tiktok_publication(p_workspace_id uuid,p_actor_id uuid,p_connection_id uuid,p_payload jsonb,p_request_id text,p_request_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare idem text;target public.publication_targets%rowtype;publication_id uuid;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501'; end if;
 if not exists(select 1 from public.social_connections where id=p_connection_id and workspace_id=p_workspace_id and network='tiktok' and active) then raise exception 'Invalid channel account' using errcode='22023'; end if;
 idem='tiktok:'||p_workspace_id::text||':'||p_request_id;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(idem,0));select * into target from public.publication_targets where idempotency_key=idem;
 if found then if target.request_hash is distinct from p_request_hash then raise exception 'Request ID was already used for different content' using errcode='22023';end if;return jsonb_build_object('publicationId',target.publication_id,'targetId',target.id,'publishId',target.external_post_id,'state',target.state,'idempotentReplay',true);end if;
 insert into public.publications(workspace_id,author_id,text,state) values(p_workspace_id,p_actor_id,coalesce(p_payload->>'caption',''),'publishing') returning id into publication_id;
 insert into public.publication_targets(publication_id,connection_id,network_payload,state,idempotency_key,request_hash) values(publication_id,p_connection_id,p_payload,'publishing',idem,p_request_hash) returning * into target;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,p_actor_id,'tiktok.publish_requested','publication',publication_id::text,jsonb_build_object('connectionId',p_connection_id,'requestId',p_request_id));
 return jsonb_build_object('publicationId',publication_id,'targetId',target.id,'state','publishing','idempotentReplay',false);
end $$;
revoke all on function public.claim_tiktok_publication(uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated;grant execute on function public.claim_tiktok_publication(uuid,uuid,uuid,jsonb,text,text) to service_role;

create or replace function public.finish_tiktok_publication(p_publication_id uuid,p_target_id uuid,p_state text,p_publish_id text,p_error text,p_actor_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from public.publications where id=p_publication_id;if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 update public.publication_targets set state=p_state,external_post_id=coalesce(p_publish_id,external_post_id),error_code=case when p_error is null then null else 'tiktok_publish_failed' end,error_message=p_error,attempts=attempts+1,published_at=case when p_state='published' then coalesce(published_at,now()) else published_at end where id=p_target_id and publication_id=p_publication_id;
 if not found then raise exception 'Publication target not found' using errcode='22023';end if;update public.publications set state=p_state,updated_at=now() where id=p_publication_id;insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(w,p_actor_id,'tiktok.'||p_state,'publication',p_publication_id::text,jsonb_build_object('publishId',p_publish_id));
end $$;
revoke all on function public.finish_tiktok_publication(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;grant execute on function public.finish_tiktok_publication(uuid,uuid,text,text,text,uuid) to service_role;
