-- Durable, workspace-scoped Agnes AI generation jobs.
create table if not exists public.ai_generation_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 created_by uuid not null,
 kind text not null check (kind in ('video')),
 provider text not null default 'agnes' check (provider in ('agnes')),
 model text not null,
 status text not null default 'queued' check (status in ('queued','generating','completed','failed')),
 provider_job_id text,
 prompt text not null,
 brief jsonb not null default '{}',
 result jsonb not null default '{}',
 media_asset_id uuid references public.media_assets(id) on delete set null,
 error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists ai_generation_jobs_workspace_created_idx on public.ai_generation_jobs(workspace_id,created_at desc);
create unique index if not exists ai_generation_jobs_provider_job_idx on public.ai_generation_jobs(provider,provider_job_id) where provider_job_id is not null;
alter table public.ai_generation_jobs enable row level security;
drop policy if exists "members view ai generation jobs" on public.ai_generation_jobs;
create policy "members view ai generation jobs" on public.ai_generation_jobs for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=ai_generation_jobs.workspace_id and wm.user_id=(select auth.uid())));
drop policy if exists "editors create ai generation jobs" on public.ai_generation_jobs;
create policy "editors create ai generation jobs" on public.ai_generation_jobs for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.workspace_members wm where wm.workspace_id=ai_generation_jobs.workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')));
revoke all on public.ai_generation_jobs from anon;
grant select,insert on public.ai_generation_jobs to authenticated;
grant all on public.ai_generation_jobs to service_role;
