import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('TikTok OAuth requests every scope selected for review',()=>{
 const s=readFileSync('src/app/api/oauth/tiktok/start/route.ts','utf8');
 for(const scope of ['user.info.basic','user.info.profile','user.info.stats','video.list','video.upload','video.publish'])assert.match(s,new RegExp(scope.replace('.','\\.')));
});

test('TikTok profile sync requests profile and stats fields and persists them',()=>{
 const s=readFileSync('src/lib/tiktok-display.ts','utf8');
 for(const field of ['username','profile_deep_link','bio_description','is_verified','follower_count','following_count','likes_count','video_count'])assert.match(s,new RegExp(field));
 assert.match(s,/user\.info\.profile/);
 assert.match(s,/user\.info\.stats/);
 assert.match(s,/tiktok_profiles/);
});

test('TikTok video.list sync uses the v2 endpoint and stores public video metrics',()=>{
 const s=readFileSync('src/lib/tiktok-display.ts','utf8');
 assert.match(s,/https:\/\/open\.tiktokapis\.com\/v2\/video\/list\//);
 assert.match(s,/video\.list/);
 assert.match(s,/max_count/);
 for(const field of ['cover_image_url','share_url','video_description','like_count','comment_count','share_count','view_count'])assert.match(s,new RegExp(field));
 assert.match(s,/tiktok_videos/);
});

test('TikTok display cache is workspace isolated and readable only by members',()=>{
 const sql=readFileSync('supabase/migrations/20261007034000_tiktok_display_api.sql','utf8');
 assert.match(sql,/tiktok_profiles/);
 assert.match(sql,/tiktok_videos/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/wm\.workspace_id=tiktok_profiles\.workspace_id/);
 assert.match(sql,/wm\.workspace_id=tiktok_videos\.workspace_id/);
 assert.match(sql,/grant select on public\.tiktok_profiles,public\.tiktok_videos to authenticated/);
});

test('Connections UI visibly demonstrates profile stats video list and authorized scopes',()=>{
 const page=readFileSync('src/app/(dashboard)/connections/page.tsx','utf8');
 assert.match(page,/TikTok profiles & videos/);
 assert.match(page,/Followers/);
 assert.match(page,/Following/);
 assert.match(page,/Total likes/);
 assert.match(page,/Recent public videos/);
 assert.match(page,/Connected permissions/);
 assert.match(page,/Refresh data/);
});

test('MCP exposes TikTok Display API refresh tools',()=>{
 const s=readFileSync('src/lib/mcp-server.ts','utf8');
 for(const tool of ['sync_tiktok_profile','sync_tiktok_videos','sync_tiktok_display'])assert.match(s,new RegExp("registerTool\\('"+tool+"'"));
});
