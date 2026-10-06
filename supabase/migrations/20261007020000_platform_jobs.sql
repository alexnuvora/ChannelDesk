-- Durable asynchronous job foundation for ChannelDesk AI/provider orchestration.
create table if not exists public.platform_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 created_by uuid,
 kind text not null,
 provider text,
 status text not null default 'queued' check (status in ('queued','processing','retry','completed','failed','cancelled')),
 payload jsonb not null default '{}',
 result jsonb not null default '{}',
 external_job_id text,
 idempotency_key text not null,
 attempts integer not null default 0,
 max_attempts integer not null default 5,
 available_at timestamptz not null default now(),
 locked_at timestamptz,
 locked_by text,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(workspace_id,idempotency_key)
);
create index if not exists platform_jobs_ready_idx on public.platform_jobs(status,available_at) where status in ('queued','retry');
create index if not exists platform_jobs_workspace_idx on public.platform_jobs(workspace_id,created_at desc);
alter table public.platform_jobs enable row level security;
create policy "members view platform jobs" on public.platform_jobs for select to authenticated using(exists(select 1 from public.workspace_members wm where wm.workspace_id=platform_jobs.workspace_id and wm.user_id=(select auth.uid())));
grant select on public.platform_jobs to authenticated;
grant all on public.platform_jobs to service_role;

create or replace function public.enqueue_platform_job(p_workspace_id uuid,p_created_by uuid,p_kind text,p_provider text,p_payload jsonb,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare jid uuid;
begin
 if auth.role()<>'service_role' and not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')) then raise exception 'Editor role required' using errcode='42501'; end if;
 insert into public.platform_jobs(workspace_id,created_by,kind,provider,payload,idempotency_key)
 values(p_workspace_id,p_created_by,p_kind,p_provider,coalesce(p_payload,'{}'::jsonb),p_idempotency_key)
 on conflict(workspace_id,idempotency_key) do update set updated_at=public.platform_jobs.updated_at
 returning id into jid;
 return jid;
end $$;
revoke all on function public.enqueue_platform_job(uuid,uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.enqueue_platform_job(uuid,uuid,text,text,jsonb,text) to authenticated,service_role;

create or replace function public.claim_platform_jobs(p_worker text,p_limit integer default 5)
returns setof public.platform_jobs language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
 return query
 with c as (select id from public.platform_jobs where status in ('queued','retry') and available_at<=now() order by available_at,created_at for update skip locked limit greatest(1,least(p_limit,25)))
 update public.platform_jobs j set status='processing',locked_at=now(),locked_by=p_worker,attempts=j.attempts+1,updated_at=now() from c where j.id=c.id returning j.*;
end $$;
revoke all on function public.claim_platform_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_platform_jobs(text,integer) to service_role;
