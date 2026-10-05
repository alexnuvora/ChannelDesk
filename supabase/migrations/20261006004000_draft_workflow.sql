-- Atomic reusable draft creation for review-before-publish workflows.
create or replace function public.create_publication_draft(p_connection_id uuid,p_media_id uuid,p_text text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_ws uuid;v_pub uuid;v_network text;
begin
 select workspace_id,network into v_ws,v_network from social_connections where id=p_connection_id and active=true;
 if v_ws is null or not exists(select 1 from workspace_members where workspace_id=v_ws and user_id=v_uid and role in ('owner','admin','editor')) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from media_assets where id=p_media_id and workspace_id=v_ws) then raise exception 'Invalid workspace media'; end if;
 insert into publications(workspace_id,author_id,text,state) values(v_ws,v_uid,coalesce(p_text,''),'draft') returning id into v_pub;
 insert into publication_targets(publication_id,connection_id,network_payload,state,idempotency_key) values(v_pub,p_connection_id,coalesce(p_payload,'{}'::jsonb),'draft','draft:'||v_pub::text||':'||p_connection_id::text);
 insert into publication_media(publication_id,media_id,position) values(v_pub,p_media_id,0);
 insert into audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(v_ws,v_uid,'publication.draft_created','publication',v_pub::text,jsonb_build_object('network',v_network));
 return v_pub;
end $$;
grant execute on function public.create_publication_draft(uuid,uuid,text,jsonb) to authenticated;
