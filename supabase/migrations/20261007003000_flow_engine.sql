-- Production flow lifecycle, execution history and safe editor operations.
alter table public.automation_flows add column if not exists description text;
alter table public.automation_flows add column if not exists last_run_at timestamptz;
alter table public.automation_flows add column if not exists run_count bigint not null default 0;
alter table public.automation_flows add column if not exists error_count bigint not null default 0;
create table if not exists public.automation_flow_runs(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 flow_id uuid not null references public.automation_flows(id) on delete cascade,status text not null check(status in ('running','completed','failed','skipped')),
 trigger_event jsonb not null default '{}',result jsonb not null default '{}',error_message text,started_at timestamptz not null default now(),finished_at timestamptz
);
create index if not exists flow_runs_flow_started_idx on public.automation_flow_runs(flow_id,started_at desc);
alter table public.automation_flow_runs enable row level security;
create policy "members view flow runs" on public.automation_flow_runs for select to authenticated using(exists(select 1 from public.workspace_members wm where wm.workspace_id=automation_flow_runs.workspace_id and wm.user_id=(select auth.uid())));
grant select on public.automation_flow_runs to authenticated;grant all on public.automation_flow_runs to service_role;

create or replace function public.save_automation_flow(p_id uuid,p_name text,p_description text,p_trigger_type text,p_trigger_config jsonb,p_actions jsonb,p_active boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare w uuid;fid uuid;
begin
 select workspace_id into w from public.workspace_members where user_id=(select auth.uid()) and role in ('owner','admin','editor') limit 1;
 if w is null then raise exception 'Editor role required' using errcode='42501';end if;
 if length(trim(p_name))<2 then raise exception 'Flow name is required' using errcode='22023';end if;
 if p_trigger_type not in ('publication_published','publication_failed','inbox_received','schedule') then raise exception 'Unsupported trigger' using errcode='22023';end if;
 if jsonb_typeof(p_actions)<>'array' or jsonb_array_length(p_actions)=0 then raise exception 'Add at least one action' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_actions) a where a->>'type' not in ('create_draft','add_inbox_note','notify_workspace')) then raise exception 'Unsupported action' using errcode='22023';end if;
 if p_id is null then insert into public.automation_flows(workspace_id,name,description,trigger_type,trigger_config,actions,active) values(w,trim(p_name),nullif(trim(p_description),''),p_trigger_type,p_trigger_config,p_actions,p_active) returning id into fid;
 else update public.automation_flows set name=trim(p_name),description=nullif(trim(p_description),''),trigger_type=p_trigger_type,trigger_config=p_trigger_config,actions=p_actions,active=p_active,updated_at=now() where id=p_id and workspace_id=w returning id into fid;if fid is null then raise exception 'Flow not found' using errcode='22023';end if;end if;
 return fid;
end $$;
revoke all on function public.save_automation_flow(uuid,text,text,text,jsonb,jsonb,boolean) from public,anon;grant execute on function public.save_automation_flow(uuid,text,text,text,jsonb,jsonb,boolean) to authenticated;

create or replace function public.delete_automation_flow(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare w uuid;begin select workspace_id into w from public.workspace_members where user_id=(select auth.uid()) and role in ('owner','admin','editor') limit 1;if w is null then raise exception 'Editor role required';end if;delete from public.automation_flows where id=p_id and workspace_id=w;if not found then raise exception 'Flow not found';end if;end $$;
revoke all on function public.delete_automation_flow(uuid) from public,anon;grant execute on function public.delete_automation_flow(uuid) to authenticated;
