-- ChannelDesk platform expansion: approvals, inbox, analytics, competitors, smart links,
-- reusable content, automations and reporting. Workspace RLS keeps every feature tenant isolated.

alter table public.publications drop constraint if exists publications_state_check;
alter table public.publications add constraint publications_state_check check(state in ('draft','pending_approval','scheduled','publishing','published','failed','cancelled','needs_review','rejected'));

create table if not exists public.content_templates (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, body text not null default '', network_payload jsonb not null default '{}', created_by uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.approval_requests (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 publication_id uuid not null references public.publications(id) on delete cascade, requested_by uuid not null,
 reviewer_id uuid, state text not null default 'pending' check(state in ('pending','approved','rejected')),
 note text, decided_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.inbox_threads (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 connection_id uuid not null references public.social_connections(id) on delete cascade, external_thread_id text not null,
 kind text not null default 'message', participant_name text, participant_avatar_url text, status text not null default 'open',
 last_message_at timestamptz, assigned_to uuid, created_at timestamptz not null default now(), unique(connection_id,external_thread_id)
);
create table if not exists public.inbox_messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.inbox_threads(id) on delete cascade,
 external_message_id text, direction text not null check(direction in ('inbound','outbound')), body text not null default '',
 author_name text, sent_at timestamptz not null, metadata jsonb not null default '{}', unique(thread_id,external_message_id)
);
create table if not exists public.analytics_snapshots (
 id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
 connection_id uuid references public.social_connections(id) on delete cascade, external_post_id text, metric_date date not null,
 metrics jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists analytics_workspace_date_idx on public.analytics_snapshots(workspace_id,metric_date desc);
create table if not exists public.competitors (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 network text not null, handle text not null, display_name text, active boolean not null default true, created_at timestamptz not null default now(),
 unique(workspace_id,network,handle)
);
create table if not exists public.smart_links (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 slug text not null unique, title text not null, description text, theme jsonb not null default '{}', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.smart_link_items (
 id uuid primary key default gen_random_uuid(), smart_link_id uuid not null references public.smart_links(id) on delete cascade,
 label text not null, url text not null, position int not null default 0, active boolean not null default true, clicks bigint not null default 0
);
create table if not exists public.automation_flows (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, trigger_type text not null, trigger_config jsonb not null default '{}', actions jsonb not null default '[]',
 active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.saved_reports (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, config jsonb not null default '{}', schedule jsonb, created_by uuid not null, created_at timestamptz not null default now()
);

do $$ declare t text; begin
 foreach t in array array['content_templates','approval_requests','inbox_threads','analytics_snapshots','competitors','smart_links','automation_flows','saved_reports'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy "members view %1$s" on public.%1$I for select to authenticated using (exists (select 1 from public.workspace_members wm where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())))',t);
  execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using (exists (select 1 from public.workspace_members wm where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid()) and wm.role in (''owner'',''admin'',''editor'',''approver''))) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid()) and wm.role in (''owner'',''admin'',''editor'',''approver'')))',t);
 end loop;
end $$;

alter table public.inbox_messages enable row level security;
create policy "members view inbox messages" on public.inbox_messages for select to authenticated using (exists(select 1 from public.inbox_threads t join public.workspace_members wm on wm.workspace_id=t.workspace_id where t.id=thread_id and wm.user_id=(select auth.uid())));
create policy "editors manage inbox messages" on public.inbox_messages for all to authenticated using (exists(select 1 from public.inbox_threads t join public.workspace_members wm on wm.workspace_id=t.workspace_id where t.id=thread_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor'))) with check (exists(select 1 from public.inbox_threads t join public.workspace_members wm on wm.workspace_id=t.workspace_id where t.id=thread_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')));
alter table public.smart_link_items enable row level security;
create policy "members view smart link items" on public.smart_link_items for select to authenticated using (exists(select 1 from public.smart_links s join public.workspace_members wm on wm.workspace_id=s.workspace_id where s.id=smart_link_id and wm.user_id=(select auth.uid())));
create policy "editors manage smart link items" on public.smart_link_items for all to authenticated using (exists(select 1 from public.smart_links s join public.workspace_members wm on wm.workspace_id=s.workspace_id where s.id=smart_link_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor'))) with check (exists(select 1 from public.smart_links s join public.workspace_members wm on wm.workspace_id=s.workspace_id where s.id=smart_link_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')));
