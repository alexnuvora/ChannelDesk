-- ChannelDesk owns scheduling for every network. Provider-native scheduling is no longer the planner source of truth.
create or replace function public.create_scheduled_publication(p_connection_id uuid,p_media_id uuid,p_text text,p_payload jsonb,p_scheduled_for timestamptz,p_request_id text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.social_connections%rowtype; pid uuid; idem text;
begin
 select * into c from public.social_connections where id=p_connection_id and active;
 if not found then raise exception 'Active channel not found' using errcode='22023'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=c.workspace_id and user_id=(select auth.uid()) and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501'; end if;
 if p_scheduled_for<=now()+interval '1 minute' then raise exception 'Schedule must be in the future' using errcode='22023'; end if;
 if not exists(select 1 from public.media_assets where id=p_media_id and workspace_id=c.workspace_id) then raise exception 'Media does not belong to this workspace' using errcode='22023'; end if;
 idem='planner:'||c.workspace_id::text||':'||p_request_id;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(idem,0));
 select publication_id into pid from public.publication_targets where idempotency_key=idem;if found then return pid;end if;
 insert into public.publications(workspace_id,author_id,text,state,scheduled_for) values(c.workspace_id,(select auth.uid()),coalesce(p_text,''),'scheduled',p_scheduled_for) returning id into pid;
 insert into public.publication_targets(publication_id,connection_id,network_payload,state,idempotency_key,request_hash) values(pid,p_connection_id,p_payload,'scheduled',idem,encode(extensions.digest(p_payload::text||p_scheduled_for::text,'sha256'),'hex'));
 insert into public.publication_media(publication_id,media_id,position) values(pid,p_media_id,0);
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(c.workspace_id,(select auth.uid()),'planner.scheduled','publication',pid::text,jsonb_build_object('network',c.network,'scheduledFor',p_scheduled_for));
 return pid;
end $$;
revoke all on function public.create_scheduled_publication(uuid,uuid,text,jsonb,timestamptz,text) from public,anon;grant execute on function public.create_scheduled_publication(uuid,uuid,text,jsonb,timestamptz,text) to authenticated;

create or replace function public.claim_due_publications(p_limit int default 20)
returns table(publication_id uuid,target_id uuid,workspace_id uuid,author_id uuid,connection_id uuid,network text,network_payload jsonb,media_url text)
language plpgsql security invoker set search_path='' as $$
begin
 return query
 with due as (
  select p.id pid,t.id tid from public.publications p join public.publication_targets t on t.publication_id=p.id
  where p.state='scheduled' and t.state='scheduled' and p.scheduled_for<=now()
  order by p.scheduled_for for update of p,t skip locked limit greatest(1,least(p_limit,50))
 ),claimed as (
  update public.publication_targets t set state='publishing',attempts=t.attempts+1 from due d where t.id=d.tid returning t.*
 ),pubs as (
  update public.publications p set state='publishing',updated_at=now() from due d where p.id=d.pid returning p.*
 )
 select p.id,c.id,p.workspace_id,p.author_id,c.connection_id,sc.network,c.network_payload,ma.source_url
 from pubs p join claimed c on c.publication_id=p.id join public.social_connections sc on sc.id=c.connection_id
 left join public.publication_media pm on pm.publication_id=p.id and pm.position=0 left join public.media_assets ma on ma.id=pm.media_id;
end $$;
revoke all on function public.claim_due_publications(int) from public,anon,authenticated;grant execute on function public.claim_due_publications(int) to service_role;

create or replace function public.finish_scheduled_publication(p_publication_id uuid,p_target_id uuid,p_state text,p_external_post_id text,p_external_url text,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.publication_targets set state=p_state,external_post_id=coalesce(p_external_post_id,external_post_id),external_url=coalesce(p_external_url,external_url),error_code=case when p_error is null then null else 'scheduled_publish_failed' end,error_message=p_error,published_at=case when p_state='published' then now() else published_at end where id=p_target_id and publication_id=p_publication_id;
 update public.publications set state=p_state,updated_at=now() where id=p_publication_id;
end $$;
revoke all on function public.finish_scheduled_publication(uuid,uuid,text,text,text,text) from public,anon,authenticated;grant execute on function public.finish_scheduled_publication(uuid,uuid,text,text,text,text) to service_role;
