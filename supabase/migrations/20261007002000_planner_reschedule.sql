create or replace function public.reschedule_planner_publication(p_publication_id uuid,p_scheduled_for timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from public.publications where id=p_publication_id and state='scheduled';
 if w is null then raise exception 'Only ChannelDesk scheduled content can be moved' using errcode='22023';end if;
 if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=(select auth.uid()) and role in ('owner','admin','editor')) then raise exception 'Publishing role required' using errcode='42501';end if;
 if p_scheduled_for<=now()+interval '1 minute' then raise exception 'Choose a future time' using errcode='22023';end if;
 update public.publications set scheduled_for=p_scheduled_for,updated_at=now() where id=p_publication_id;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(w,(select auth.uid()),'planner.rescheduled','publication',p_publication_id::text,jsonb_build_object('scheduledFor',p_scheduled_for));
end $$;
revoke all on function public.reschedule_planner_publication(uuid,timestamptz) from public,anon;grant execute on function public.reschedule_planner_publication(uuid,timestamptz) to authenticated;
