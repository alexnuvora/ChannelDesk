-- Durable workspace-scoped image -> video FFmpeg job queue.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('channeldesk-audio','channeldesk-audio',false,31457280,array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "render audio upload" on storage.objects for insert to authenticated
with check(bucket_id='channeldesk-audio' and exists(select 1 from public.workspace_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy "render audio read" on storage.objects for select to authenticated
using(bucket_id='channeldesk-audio' and exists(select 1 from public.workspace_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid())));
create policy "render audio delete" on storage.objects for delete to authenticated
using(bucket_id='channeldesk-audio' and exists(select 1 from public.workspace_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create or replace function public.claim_video_render_jobs(p_worker text,p_limit integer default 2)
returns setof public.platform_jobs language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'service role required' using errcode='42501';end if;
 return query
 with picked as (
  select id from public.platform_jobs
  where kind='media.video_render' and provider='ffmpeg'
  and ((status in ('queued','retry') and available_at<=now())
     or (status='processing' and locked_at<now()-interval '20 minutes'))
  order by created_at for update skip locked limit greatest(1,least(p_limit,5))
 )
 update public.platform_jobs j
 set status='processing',locked_at=now(),locked_by=p_worker,attempts=j.attempts+1,updated_at=now()
 from picked where j.id=picked.id returning j.*;
end $$;
revoke all on function public.claim_video_render_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_video_render_jobs(text,integer) to service_role;

-- Reject tampered render job payloads by placing the enqueue boundary in a validated server action.
-- Existing platform_jobs member RLS provides read-only job status to the creator's workspace.
