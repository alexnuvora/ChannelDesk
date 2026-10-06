-- Public Smart Link delivery and click attribution.
create table if not exists public.smart_link_clicks(id uuid primary key default gen_random_uuid(),smart_link_id uuid not null references public.smart_links(id) on delete cascade,item_id uuid not null references public.smart_link_items(id) on delete cascade,clicked_at timestamptz not null default now(),referrer text,user_agent text);
create index if not exists smart_link_clicks_link_time_idx on public.smart_link_clicks(smart_link_id,clicked_at desc);
alter table public.smart_link_clicks enable row level security;
create policy "members view smart link clicks" on public.smart_link_clicks for select to authenticated using(exists(select 1 from public.smart_links l join public.workspace_members wm on wm.workspace_id=l.workspace_id where l.id=smart_link_clicks.smart_link_id and wm.user_id=(select auth.uid())));
grant select on public.smart_link_clicks to authenticated;grant all on public.smart_link_clicks to service_role;
