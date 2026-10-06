import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Agnes edge function enqueues without starting provider immediately',()=>{
 const s=readFileSync('supabase/functions/agnes-video/index.ts','utf8');
 assert.match(s,/status:'queued'/);
 assert.match(s,/enqueue_platform_job/);
 assert.doesNotMatch(s,/BASE\+'\/v1\/videos'/);
});

test('AI worker enforces one active Agnes video per workspace and persists progress',()=>{
 const s=readFileSync('supabase/functions/job-worker/index.ts','utf8');
 assert.match(s,/eq\('status','processing'\)\.limit\(1\)/);
 assert.match(s,/order\('created_at',\{ascending:true\}\)\.limit\(1\)/);
 assert.match(s,/progress=Math\.max\(0,Math\.min\(100/);
 assert.match(s,/status:'completed',media_asset_id:assetId/);
});

test('AI studio and media page expose progress and queue state',()=>{
 const studio=readFileSync('src/app/(dashboard)/create/ai-studio.tsx','utf8');
 const media=readFileSync('src/app/(dashboard)/media/media-generation-status.tsx','utf8');
 assert.match(studio,/queuePosition/);
 assert.match(studio,/ai-progress/);
 assert.match(media,/refreshAiVideo/);
 assert.match(media,/media-generation-progress/);
});