import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Agnes integration keeps credentials server-side and uses documented production models',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');const client=readFileSync('src/app/(dashboard)/create/ai-studio.tsx','utf8');assert.match(service,/process\.env\.AGNES_API_KEY/);assert.doesNotMatch(service,/NEXT_PUBLIC_AGNES/);assert.doesNotMatch(client,/AGNES_API_KEY|apihub\.agnes-ai\.com/);assert.match(service,/agnes-3\.0-flash/);assert.match(service,/model='agnes-video-2\.5'/);assert.doesNotMatch(service,/agnes-video-2\.5-flash/);assert.match(service,/\/v1\/videos/);assert.match(service,/\/agnesapi\?video_id=/);});
test('AI video inputs are bounded before provider spend',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');assert.match(service,/seconds<4\|\|seconds>12/);assert.match(service,/prompt\.length<8\|\|prompt\.length>4000/);assert.match(service,/recent\|\|0\)>=20/);assert.match(service,/active\|\|0\)>=3/);});

test('Agnes provider validation details are preserved for actionable UI errors',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');const actions=readFileSync('src/app/(dashboard)/create/ai-actions.ts','utf8');assert.match(service,/providerDetail/);assert.match(service,/class AgnesRequestError/);assert.match(service,/Agnes request failed \(HTTP \$\{status\}\)/);assert.match(actions,/Agnes rejected the request:/);assert.match(actions,/HTTP 403/);assert.match(actions,/HTTP 422/);});

test('Agnes video request matches documented 2.5 fields',()=>{const service=readFileSync('src/lib/agnes.ts','utf8');assert.match(service,/model='agnes-video-2\.5'/);assert.match(service,/mode:'text'/);assert.match(service,/seconds:String\(seconds\)/);assert.match(service,/aspect_ratio:concept\.aspectRatio/);assert.doesNotMatch(service,/aspect_ratio:concept\.aspectRatio,n:1/);});

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
 assert.match(service,/failure_class:classification/);
});

test('ChannelDesk surfaces hard Agnes quota separately from transient 429 throttling',()=>{
 const actions=readFileSync('src/app/(dashboard)/create/ai-actions.ts','utf8');
 assert.match(actions,/free users\|token plan\|upgrade\|quota\|credits\?/);
 assert.match(actions,/temporarily rate-limiting/);
});
