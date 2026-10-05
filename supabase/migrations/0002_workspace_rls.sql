-- ChannelDesk workspace authorization policies.
-- Requires authenticated Supabase users; authorization is based on workspace_members.

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists social_connections_workspace_idx on public.social_connections(workspace_id);
create index if not exists media_assets_workspace_idx on public.media_assets(workspace_id);
create index if not exists publications_workspace_idx on public.publications(workspace_id);
create index if not exists publication_targets_publication_idx on public.publication_targets(publication_id);
create index if not exists audit_events_workspace_idx on public.audit_events(workspace_id);

create policy "members can view workspaces"
on public.workspaces for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = id and wm.user_id = (select auth.uid())
));

create policy "members can view workspace membership"
on public.workspace_members for select to authenticated
using (exists (
  select 1 from public.workspace_members self
  where self.workspace_id = workspace_id and self.user_id = (select auth.uid())
));

create policy "members can view connections"
on public.social_connections for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
));

create policy "editors can manage connections"
on public.social_connections for all to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id
    and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor')
))
with check (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id
    and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor')
));

create policy "members can view media"
on public.media_assets for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
));

create policy "editors can manage media"
on public.media_assets for all to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor')
))
with check (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor')
));

create policy "members can view publications"
on public.publications for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
));

create policy "editors can manage publications"
on public.publications for all to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor','approver')
))
with check (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor','approver')
));

create policy "members can view publication targets"
on public.publication_targets for select to authenticated
using (exists (
  select 1 from public.publications p
  join public.workspace_members wm on wm.workspace_id = p.workspace_id
  where p.id = publication_id and wm.user_id = (select auth.uid())
));

create policy "editors can manage publication targets"
on public.publication_targets for all to authenticated
using (exists (
  select 1 from public.publications p
  join public.workspace_members wm on wm.workspace_id = p.workspace_id
  where p.id = publication_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor','approver')
))
with check (exists (
  select 1 from public.publications p
  join public.workspace_members wm on wm.workspace_id = p.workspace_id
  where p.id = publication_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor','approver')
));

create policy "members can view publication media"
on public.publication_media for select to authenticated
using (exists (
  select 1 from public.publications p
  join public.workspace_members wm on wm.workspace_id = p.workspace_id
  where p.id = publication_id and wm.user_id = (select auth.uid())
));

create policy "editors can manage publication media"
on public.publication_media for all to authenticated
using (exists (
  select 1 from public.publications p
  join public.workspace_members wm on wm.workspace_id = p.workspace_id
  where p.id = publication_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor','approver')
))
with check (exists (
  select 1 from public.publications p
  join public.workspace_members wm on wm.workspace_id = p.workspace_id
  where p.id = publication_id and wm.user_id = (select auth.uid())
    and wm.role in ('owner','admin','editor','approver')
));

create policy "members can view audit events"
on public.audit_events for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
));
