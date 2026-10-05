-- Workspace-scoped private media storage for ChannelDesk.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('channeldesk-media','channeldesk-media',false,268435456,array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "workspace members can read media objects"
on storage.objects for select to authenticated
using (bucket_id='channeldesk-media' and exists (
 select 1 from public.workspace_members wm
 where wm.workspace_id::text=(storage.foldername(name))[1] and wm.user_id=(select auth.uid())
));

create policy "workspace editors can upload media objects"
on storage.objects for insert to authenticated
with check (bucket_id='channeldesk-media' and exists (
 select 1 from public.workspace_members wm
 where wm.workspace_id::text=(storage.foldername(name))[1] and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')
));

create policy "workspace editors can update media objects"
on storage.objects for update to authenticated
using (bucket_id='channeldesk-media' and exists (
 select 1 from public.workspace_members wm
 where wm.workspace_id::text=(storage.foldername(name))[1] and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')
))
with check (bucket_id='channeldesk-media' and exists (
 select 1 from public.workspace_members wm
 where wm.workspace_id::text=(storage.foldername(name))[1] and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')
));

create policy "workspace editors can delete media objects"
on storage.objects for delete to authenticated
using (bucket_id='channeldesk-media' and exists (
 select 1 from public.workspace_members wm
 where wm.workspace_id::text=(storage.foldername(name))[1] and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin','editor')
));