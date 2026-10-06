-- Cache TikTok Display API profile/statistics and public video data for reviewable UI.
create table if not exists public.tiktok_profiles (
  connection_id uuid primary key references public.social_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  username text,
  avatar_url text,
  profile_deep_link text,
  bio_description text,
  is_verified boolean,
  follower_count bigint not null default 0,
  following_count bigint not null default 0,
  likes_count bigint not null default 0,
  video_count bigint not null default 0,
  synced_at timestamptz not null default now()
);
create index if not exists tiktok_profiles_workspace_idx on public.tiktok_profiles(workspace_id);

create table if not exists public.tiktok_videos (
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  video_id text not null,
  title text,
  description text,
  cover_image_url text,
  share_url text,
  embed_link text,
  create_time timestamptz,
  duration_seconds integer,
  width integer,
  height integer,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  share_count bigint not null default 0,
  view_count bigint not null default 0,
  is_aigc boolean,
  synced_at timestamptz not null default now(),
  primary key(connection_id,video_id)
);
create index if not exists tiktok_videos_workspace_created_idx on public.tiktok_videos(workspace_id,create_time desc);

alter table public.tiktok_profiles enable row level security;
alter table public.tiktok_videos enable row level security;

create policy "members can view tiktok profiles" on public.tiktok_profiles for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=tiktok_profiles.workspace_id and wm.user_id=(select auth.uid())));
create policy "members can view tiktok videos" on public.tiktok_videos for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=tiktok_videos.workspace_id and wm.user_id=(select auth.uid())));

revoke all on public.tiktok_profiles,public.tiktok_videos from anon,authenticated;
grant select on public.tiktok_profiles,public.tiktok_videos to authenticated;
grant all on public.tiktok_profiles,public.tiktok_videos to service_role;
