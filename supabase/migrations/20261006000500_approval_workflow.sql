-- Approval workflow: one active decision per request, with immutable decision history in audit_events.
create unique index if not exists approval_requests_pending_publication_idx on public.approval_requests(publication_id) where state='pending';
create index if not exists approval_requests_workspace_state_idx on public.approval_requests(workspace_id,state,created_at desc);

create or replace function public.request_publication_approval(p_publication_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_ws uuid;v_id uuid;
begin
 select workspace_id into v_ws from publications where id=p_publication_id;
 if v_ws is null or not exists(select 1 from workspace_members where workspace_id=v_ws and user_id=v_uid and role in ('owner','admin','editor')) then raise exception 'not_authorized'; end if;
 if exists(select 1 from approval_requests where publication_id=p_publication_id and state='pending') then select id into v_id from approval_requests where publication_id=p_publication_id and state='pending'; return v_id; end if;
 insert into approval_requests(workspace_id,publication_id,requested_by,note) values(v_ws,p_publication_id,v_uid,nullif(trim(p_note),'')) returning id into v_id;
 update publications set state='pending_approval',updated_at=now() where id=p_publication_id and state in ('draft','rejected');
 insert into audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(v_ws,v_uid,'publication.approval_requested','publication',p_publication_id::text,jsonb_build_object('approvalRequestId',v_id));
 return v_id;
end $$;

create or replace function public.decide_publication_approval(p_request_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_ws uuid;v_pub uuid;
begin
 if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
 select workspace_id,publication_id into v_ws,v_pub from approval_requests where id=p_request_id and state='pending' for update;
 if v_ws is null or not exists(select 1 from workspace_members where workspace_id=v_ws and user_id=v_uid and role in ('owner','admin','approver')) then raise exception 'not_authorized'; end if;
 update approval_requests set state=p_decision,reviewer_id=v_uid,note=coalesce(nullif(trim(p_note),''),note),decided_at=now() where id=p_request_id;
 update publications set state=case when p_decision='approved' then 'draft' else 'rejected' end,updated_at=now() where id=v_pub;
 insert into audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(v_ws,v_uid,'publication.approval_'||p_decision,'publication',v_pub::text,jsonb_build_object('approvalRequestId',p_request_id,'note',nullif(trim(p_note),'')));
end $$;
grant execute on function public.request_publication_approval(uuid,text) to authenticated;
grant execute on function public.decide_publication_approval(uuid,text,text) to authenticated;
