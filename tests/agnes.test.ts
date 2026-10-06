import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Agnes integration keeps credentials server-side and uses documented production models',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');const client=readFileSync('src/app/(dashboard)/create/ai-studio.tsx','utf8');assert.match(service,/process\.env\.AGNES_API_KEY/);assert.doesNotMatch(service,/NEXT_PUBLIC_AGNES/);assert.doesNotMatch(client,/AGNES_API_KEY|apihub\.agnes-ai\.com/);assert.match(service,/agnes-3\.0-flash/);assert.match(service,/agnes-video-2\.5-flash/);assert.match(service,/agnes-video-2\.5/);assert.match(service,/\/v1\/videos/);assert.match(service,/\/agnesapi\?video_id=/);});
test('AI video inputs are bounded before provider spend',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');assert.match(service,/seconds<4\|\|seconds>12/);assert.match(service,/prompt\.length<8\|\|prompt\.length>4000/);assert.match(service,/recent\|\|0\)>=20/);assert.match(service,/enqueue_platform_job/);});

test('Agnes provider validation details are preserved for actionable UI errors',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');const actions=readFileSync('src/app/(dashboard)/create/ai-actions.ts','utf8');assert.match(service,/providerDetail/);assert.match(service,/class AgnesRequestError/);assert.match(service,/Agnes request failed \(HTTP \$\{status\}\)/);assert.match(actions,/Agnes rejected the request:/);assert.match(actions,/HTTP 403/);assert.match(actions,/HTTP 422/);});

test('Agnes video request matches documented 2.5 and Flash fields',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');const worker=readFileSync('supabase/functions/job-worker/index.ts','utf8');assert.match(service,/quality==='quality'\?'agnes-video-2\.5':'agnes-video-2\.5-flash'/);assert.match(worker,/mode:'text'/);assert.match(worker,/seconds:String\(seconds\)/);assert.match(worker,/aspect_ratio:ratio/);assert.doesNotMatch(worker,/aspect_ratio:ratio,n:1/);});

test('Agnes retries transient throttling safely without duplicating ambiguous video creates',()=>{
 const service=readFileSync('src/lib/agnes.ts','utf8');
 assert.match(service,/retryAfterMs/);
 assert.match(service,/backoffMs/);
 assert.match(service,/maxAttempts=5/);
 assert.match(service,/safeRetry=method==='GET'\|\|path==='\/v1\/chat\/completions'/);
 assert.match(service,/videoCreate=method==='POST'&&path==='\/v1\/videos'/);
 assert.match(service,/retryable429=r\.status===429&&\(safeRetry\|\|videoCreate\)/);
 assert.match(service,/retryable5xx=r\.status>=500&&r\.status<=599&&safeRetry/);
 assert.match(service,/hardQuota=status===429&&\/free users\|token plan\|upgrade\|quota\|credits\?\/i/);
 const worker=readFileSync('supabase/functions/job-worker/index.ts','utf8');assert.match(worker,/retryAfterMs/);assert.match(worker,/backoffMs/);assert.match(worker,/retry429=r\.status===429&&\(safeRetry\|\|videoCreate\)/);assert.match(worker,/retry5xx=r\.status>=500&&r\.status<=599&&safeRetry/);
});

test('ChannelDesk surfaces hard Agnes quota separately from transient 429 throttling',()=>{
 const actions=readFileSync('src/app/(dashboard)/create/ai-actions.ts','utf8');
 assert.match(actions,/free users\|token plan\|upgrade\|quota\|credits\?/);
 assert.match(actions,/temporarily rate-limiting/);
});

test('Standard 720P routes to Agnes Video 2.5 Flash and Quality stays on base 2.5',()=>{const edge=readFileSync('supabase/functions/agnes-video/index.ts','utf8');const worker=readFileSync('supabase/functions/job-worker/index.ts','utf8');assert.match(edge,/quality==='quality'\?'agnes-video-2\.5':'agnes-video-2\.5-flash'/);assert.match(edge,/quality==='quality'\?'1080P':'720P'/);assert.match(worker,/model_name='\+encodeURIComponent\(model\)/);assert.match(worker,/rights_evidence:'Agnes '\+model/);});

test('MCP video generation uses the same durable queue as the web app',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');assert.match(service,/p_kind:'ai\.video'/);assert.match(service,/p_payload:\{concept,quality,model,size,legacyJobId:id,seconds,ratio:concept\.aspectRatio\}/);assert.match(service,/status:'queued' as const/);assert.match(service,/functions\/v1\/job-worker/);});
