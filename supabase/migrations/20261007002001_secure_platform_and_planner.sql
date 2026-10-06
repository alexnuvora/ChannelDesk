-- Repair the new platform policies: every predicate must correlate to its outer row.
do $$
declare t text; p record;
begin
 foreach t in array array['content_templates','approval_requests','inbox_threads','analytics_snapshots','competitors','smart_links','automation_flows','saved_reports'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  execute format('create policy "workspace members read" on public.%1$I for select to authenticated using (exists(select 1 from public.workspace_members wm where wm.workspace_id=%1$I.workspace_id and wm.user_id=(select auth.uid())))',t);
  if t in ('content_templates','competitors','smart_links','automation_flows','saved_reports') then
   execute format('create policy "workspace editors write" on public.%1$I for all to authenticated using (exists(select 1 from public.workspace_members wm where wm.workspace_id=%1$I.workspace_id and wm.user_id=(select auth.uid()) and wm.role in (''owner'',''admin'',''editor''))) with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=%1$I.workspace_id and wm.user_id=(select auth.uid()) and wm.role in (''owner'',''admin'',''editor'')))',t);
  end if;
  execute format('revoke all on public.%I from anon',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Provider data and approval decisions must not be forged through the browser Data API.
revoke insert,update,delete on public.approval_requests,public.inbox_threads,public.inbox_messages,public.analytics_snapshots from authenticated;
grant all on public.inbox_messages,public.smart_link_items to service_role;
grant usage,select on sequence public.analytics_snapshots_id_seq to service_role;
revoke all on function public.request_publication_approval(uuid,text),public.decide_publication_approval(uuid,text,text),public.create_publication_draft(uuid,uuid,text,jsonb) from public,anon;
-- Existing, intentionally privileged bootstrap/review RPCs retain their explicit actor checks.
alter function public.request_publication_approval(uuid,text) set search_path=pg_catalog,public;
alter function public.decide_publication_approval(uuid,text,text) set search_path=pg_catalog,public;
alter function public.create_publication_draft(uuid,uuid,text,jsonb) set search_path=pg_catalog,public;
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke all on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;

create or replace function public.check_platform_reference() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='approval_requests' then
  if not exists(select 1 from public.publications p where p.id=new.publication_id and p.workspace_id=new.workspace_id) then raise exception 'Publication belongs to another workspace' using errcode='23514';end if;
 elsif new.connection_id is not null and not exists(select 1 from public.social_connections c where c.id=new.connection_id and c.workspace_id=new.workspace_id) then
  raise exception 'Connection belongs to another workspace' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.check_platform_reference() from public,anon,authenticated;
create trigger check_approval_workspace before insert or update on public.approval_requests for each row execute function public.check_platform_reference();
create trigger check_inbox_workspace before insert or update on public.inbox_threads for each row execute function public.check_platform_reference();
create trigger check_analytics_workspace before insert or update on public.analytics_snapshots for each row execute function public.check_platform_reference();

-- All queue writes go through server-only, actor-checked operations; no RLS bypass shortcut.
drop function public.create_scheduled_publication(uuid,uuid,text,jsonb,timestamptz,text);
drop function public.reschedule_planner_publication(uuid,timestamptz);
create function public.schedule_planner_publication(p_workspace_id uuid,p_actor_id uuid,p_connection_id uuid,p_media_id uuid,p_payload jsonb,p_scheduled_for timestamptz,p_request_id text,p_request_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.social_connections%rowtype;t public.publication_targets%rowtype;pid uuid;idem text;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 select * into c from public.social_connections where id=p_connection_id and workspace_id=p_workspace_id and active and network in ('youtube','tiktok');
 if not found then raise exception 'Active supported channel required' using errcode='22023';end if;
 if p_scheduled_for is null or not isfinite(p_scheduled_for) or p_scheduled_for<=now()+interval '1 minute' or p_request_id is null or length(p_request_id) not between 8 and 128 or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid schedule or request ID' using errcode='22023';end if;
 if p_media_id is not null then
  if not exists(select 1 from public.media_assets where id=p_media_id and workspace_id=p_workspace_id and mime_type like 'video/%' and storage_key like p_workspace_id::text||'/%') then raise exception 'Choose a video in this workspace' using errcode='22023';end if;
 elsif coalesce(p_payload->>'mediaUrl','') !~ '^https://' then raise exception 'Video URL required' using errcode='22023';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Post settings required' using errcode='22023';end if;
 if c.network='youtube' and (length(trim(coalesce(p_payload->>'title',''))) not between 1 and 100 or coalesce(p_payload->>'privacy','') not in ('private','unlisted','public') or jsonb_typeof(p_payload->'madeForKids') is distinct from 'boolean') then raise exception 'Explicit YouTube settings required' using errcode='22023';end if;
 if c.network='tiktok' and (coalesce(p_payload->>'privacy','') not in ('PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY') or jsonb_typeof(p_payload->'disableComment') is distinct from 'boolean' or jsonb_typeof(p_payload->'disableDuet') is distinct from 'boolean' or jsonb_typeof(p_payload->'disableStitch') is distinct from 'boolean') then raise exception 'Explicit TikTok settings required' using errcode='22023';end if;
 idem='planner:'||p_workspace_id::text||':'||p_request_id;perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(idem,0));
 select * into t from public.publication_targets where idempotency_key=idem;
 if found then
  if t.request_hash is distinct from p_request_hash or t.connection_id<>p_connection_id then raise exception 'Request ID already used for different content' using errcode='22023';end if;
  return jsonb_build_object('publicationId',t.publication_id,'targetId',t.id,'state',t.state,'idempotentReplay',true);
 end if;
 insert into public.publications(workspace_id,author_id,text,state,scheduled_for) values(p_workspace_id,p_actor_id,coalesce(p_payload->>'title',p_payload->>'caption',''),'scheduled',p_scheduled_for) returning id into pid;
 insert into public.publication_targets(publication_id,connection_id,network_payload,state,idempotency_key,request_hash) values(pid,p_connection_id,p_payload,'scheduled',idem,p_request_hash) returning * into t;
 if p_media_id is not null then insert into public.publication_media(publication_id,media_id,position) values(pid,p_media_id,0);end if;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,p_actor_id,'planner.scheduled','publication',pid::text,jsonb_build_object('scheduledFor',p_scheduled_for,'connectionId',p_connection_id));
 return jsonb_build_object('publicationId',pid,'targetId',t.id,'state','scheduled','scheduledFor',p_scheduled_for,'idempotentReplay',false);
end $$;
revoke all on function public.schedule_planner_publication(uuid,uuid,uuid,uuid,jsonb,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.schedule_planner_publication(uuid,uuid,uuid,uuid,jsonb,timestamptz,text,text) to service_role;

create function public.change_planner_schedule(p_publication_id uuid,p_workspace_id uuid,p_actor_id uuid,p_scheduled_for timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.publications%rowtype;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 select * into p from public.publications where id=p_publication_id and workspace_id=p_workspace_id for update;
 if not found or p.state<>'scheduled' or not exists(select 1 from public.publication_targets where publication_id=p.id) or exists(select 1 from public.publication_targets where publication_id=p.id and (state<>'scheduled' or external_post_id is not null)) then raise exception 'Only unclaimed Planner schedules can be changed; provider schedules must be managed through their provider' using errcode='22023';end if;
 if p_scheduled_for is not null and (not isfinite(p_scheduled_for) or p_scheduled_for<=now()+interval '1 minute') then raise exception 'Choose a future time' using errcode='22023';end if;
 update public.publications set scheduled_for=p_scheduled_for,state=case when p_scheduled_for is null then 'cancelled' else 'scheduled' end,updated_at=now() where id=p.id;
 if p_scheduled_for is null then update public.publication_targets set state='cancelled' where publication_id=p.id;end if;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,p_actor_id,case when p_scheduled_for is null then 'planner.cancelled' else 'planner.rescheduled' end,'publication',p.id::text,jsonb_build_object('scheduledFor',p_scheduled_for));
end $$;
revoke all on function public.change_planner_schedule(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.change_planner_schedule(uuid,uuid,uuid,timestamptz) to service_role;

create function public.edit_planner_draft(p_publication_id uuid,p_workspace_id uuid,p_actor_id uuid,p_text text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 perform 1 from public.publications where id=p_publication_id and workspace_id=p_workspace_id and state in ('draft','rejected') for update;
 if not found then raise exception 'Only draft or rejected content can be edited' using errcode='22023';end if;
 if length(trim(coalesce(p_text,''))) not between 1 and 2200 or exists(select 1 from public.publication_targets t join public.social_connections c on c.id=t.connection_id where t.publication_id=p_publication_id and c.network='youtube' and length(trim(p_text))>100) then raise exception 'Invalid post text length' using errcode='22023';end if;
 update public.publications set text=trim(p_text),updated_at=now() where id=p_publication_id;
 update public.publication_targets t set network_payload=jsonb_set(t.network_payload,case when c.network='youtube' then '{title}'::text[] else '{caption}'::text[] end,to_jsonb(trim(p_text))) from public.social_connections c where t.publication_id=p_publication_id and c.id=t.connection_id;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id) values(p_workspace_id,p_actor_id,'publication.draft_edited','publication',p_publication_id::text);
end $$;
revoke all on function public.edit_planner_draft(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.edit_planner_draft(uuid,uuid,uuid,text) to service_role;

alter table public.publication_targets add column lease_id uuid,add column lease_expires_at timestamptz;
create index publications_due_idx on public.publications(scheduled_for) where state='scheduled';
drop function public.claim_due_publications(int);
create function public.claim_due_publications(p_limit int default 3)
returns table(publication_id uuid,target_id uuid,workspace_id uuid,author_id uuid,connection_id uuid,network text,network_payload jsonb,media_id uuid,lease_id uuid)
language plpgsql security invoker set search_path='' as $$
begin
 -- A lost worker must never cause an automatic duplicate upload.
 with stale as (
  update public.publication_targets t set state='needs_review',error_code='worker_interrupted',error_message='Delivery was interrupted. Check the provider before retrying.',lease_id=null,lease_expires_at=null
  where t.state='publishing' and t.lease_expires_at<now() returning t.publication_id
 ) update public.publications p set state='needs_review',updated_at=now() from stale s where p.id=s.publication_id;
 with missed as (
  update public.publication_targets t set state='needs_review',error_code='schedule_missed',error_message='Scheduled time was missed by more than 30 minutes. Review before publishing.'
  from public.publications p where p.id=t.publication_id and p.state='scheduled' and t.state='scheduled' and t.external_post_id is null and p.scheduled_for<now()-interval '30 minutes' returning t.publication_id
 ) update public.publications p set state='needs_review',updated_at=now() from missed m where p.id=m.publication_id;
 return query
 with due as (
  select p.id pid,t.id tid from public.publications p join public.publication_targets t on t.publication_id=p.id
  where p.state='scheduled' and t.state='scheduled' and t.external_post_id is null and p.scheduled_for<=now()
  order by p.scheduled_for,p.id for update of p,t skip locked limit greatest(1,least(coalesce(p_limit,3),3))
 ),claimed as (
  update public.publication_targets t set state='publishing',attempts=t.attempts+1,lease_id=gen_random_uuid(),lease_expires_at=now()+interval '6 minutes'
  from due d where t.id=d.tid returning t.*
 ),pubs as (
  update public.publications p set state='publishing',updated_at=now() from due d where p.id=d.pid returning p.*
 )
 select p.id,c.id,p.workspace_id,p.author_id,c.connection_id,sc.network,c.network_payload,
 (select pm.media_id from public.publication_media pm where pm.publication_id=p.id order by pm.position limit 1),c.lease_id
 from pubs p join claimed c on c.publication_id=p.id join public.social_connections sc on sc.id=c.connection_id and sc.workspace_id=p.workspace_id;
end $$;
revoke all on function public.claim_due_publications(int) from public,anon,authenticated;
grant execute on function public.claim_due_publications(int) to service_role;
drop function public.finish_scheduled_publication(uuid,uuid,text,text,text,text);
create function public.finish_scheduled_publication(p_publication_id uuid,p_target_id uuid,p_lease_id uuid,p_state text,p_external_post_id text,p_external_url text,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.publications%rowtype;
begin
 if p_state not in ('publishing','published','failed','needs_review') or p_state is null then raise exception 'Invalid delivery state' using errcode='22023';end if;
 select * into p from public.publications where id=p_publication_id for update;
 update public.publication_targets set state=p_state,external_post_id=coalesce(p_external_post_id,external_post_id),external_url=coalesce(p_external_url,external_url),error_code=case when p_error is null then null else 'scheduled_publish_failed' end,error_message=p_error,published_at=case when p_state='published' then coalesce(published_at,now()) else published_at end,lease_id=null,lease_expires_at=null
 where id=p_target_id and publication_id=p_publication_id and state='publishing' and lease_id=p_lease_id;
 if not found then raise exception 'Delivery claim changed' using errcode='40001';end if;
 update public.publications set state=p_state,updated_at=now() where id=p_publication_id;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p.workspace_id,p.author_id,'planner.'||p_state,'publication',p.id::text,jsonb_build_object('targetId',p_target_id,'externalId',p_external_post_id));
end $$;
revoke all on function public.finish_scheduled_publication(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_scheduled_publication(uuid,uuid,uuid,text,text,text,text) to service_role;

-- Atomic analytics upserts preserve previous data on a failed import.
create function public.save_account_analytics(p_workspace_id uuid,p_connection_id uuid,p_actor_id uuid,p_rows jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin','editor')) or not exists(select 1 from public.social_connections where id=p_connection_id and workspace_id=p_workspace_id) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into public.analytics_snapshots(workspace_id,connection_id,metric_date,metrics)
 select p_workspace_id,p_connection_id,x.metric_date,x.metrics from jsonb_to_recordset(p_rows) as x(metric_date date,metrics jsonb)
 on conflict(workspace_id,connection_id,metric_date) where external_post_id is null do update set metrics=excluded.metrics;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id) values(p_workspace_id,p_actor_id,'youtube.analytics_synced','social_connection',p_connection_id::text);
end $$;
revoke all on function public.save_account_analytics(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_account_analytics(uuid,uuid,uuid,jsonb) to service_role;

-- GitHub CLI uses its existing management credential to issue a short-lived,
-- single-use scheduler ticket. No permanent shared secret or keys in workflow logs.
create table public.scheduler_tickets(token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),expires_at timestamptz not null default now()+interval '2 minutes');
alter table public.scheduler_tickets enable row level security;
revoke all on public.scheduler_tickets from public,anon,authenticated;
grant all on public.scheduler_tickets to service_role;
create function public.issue_scheduler_ticket(p_hash text) returns void language plpgsql security invoker set search_path='' as $$
begin delete from public.scheduler_tickets where expires_at<now();insert into public.scheduler_tickets(token_hash) values(p_hash);end $$;
create function public.consume_scheduler_ticket(p_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
begin delete from public.scheduler_tickets where token_hash=p_hash and expires_at>now();return found;end $$;
revoke all on function public.issue_scheduler_ticket(text),public.consume_scheduler_ticket(text) from public,anon,authenticated;
grant execute on function public.issue_scheduler_ticket(text),public.consume_scheduler_ticket(text) to service_role;

alter table public.publications drop constraint publications_state_check;
alter table public.publications add constraint publications_state_check check(state in ('draft','pending_approval','scheduled','publishing','published','failed','cancelled','needs_review','rejected','delivered'));
create or replace function public.finish_tiktok_publication(p_publication_id uuid,p_target_id uuid,p_state text,p_publish_id text,p_error text,p_actor_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare w uuid; t public.publication_targets%rowtype;
begin
 select workspace_id into w from public.publications where id=p_publication_id for update;
 if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=p_actor_id and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 if p_state is null or p_state not in ('publishing','published','delivered','failed','needs_review') then raise exception 'Invalid TikTok state' using errcode='22023';end if;
 select * into t from public.publication_targets where id=p_target_id and publication_id=p_publication_id for update;
 if not found then raise exception 'Publication target not found' using errcode='22023';end if;
 if t.external_post_id is not null and p_publish_id is distinct from t.external_post_id then raise exception 'TikTok delivery identity changed' using errcode='22023';end if;
 if t.state in ('published','delivered') and p_state in ('publishing','needs_review') then return;end if;
 update public.publication_targets set state=p_state,external_post_id=coalesce(p_publish_id,external_post_id),error_code=case when p_error is null then null else 'tiktok_publish_failed' end,error_message=p_error,attempts=greatest(attempts,1),published_at=case when p_state='published' then coalesce(published_at,now()) else published_at end where id=t.id;
 update public.publications set state=p_state,updated_at=now() where id=p_publication_id;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(w,p_actor_id,'tiktok.'||p_state,'publication',p_publication_id::text,jsonb_build_object('publishId',p_publish_id));
end $$;
