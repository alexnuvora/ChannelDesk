-- Harden approval state transitions so live/scheduled content can never acquire a stale review request.
create or replace function public.request_publication_approval(p_publication_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_ws uuid;v_state text;v_id uuid;
begin
 select workspace_id,state into v_ws,v_state from publications where id=p_publication_id for update;
 if v_ws is null or not exists(select 1 from workspace_members where workspace_id=v_ws and user_id=v_uid and role in ('owner','admin','editor')) then raise exception 'not_authorized'; end if;
 if v_state not in ('draft','rejected') then raise exception 'Only draft or rejected content can be sent for approval'; end if;
 if exists(select 1 from approval_requests where publication_id=p_publication_id and state='pending') then select id into v_id from approval_requests where publication_id=p_publication_id and state='pending'; return v_id; end if;
 insert into approval_requests(workspace_id,publication_id,requested_by,note) values(v_ws,p_publication_id,v_uid,nullif(trim(p_note),'')) returning id into v_id;
 update publications set state='pending_approval',updated_at=now() where id=p_publication_id;
 insert into audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(v_ws,v_uid,'publication.approval_requested','publication',p_publication_id::text,jsonb_build_object('approvalRequestId',v_id));
 return v_id;
end $$;
