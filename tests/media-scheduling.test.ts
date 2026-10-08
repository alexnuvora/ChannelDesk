import test from 'node:test';
import assert from 'node:assert/strict';
import {signedMediaUrl,validMediaSignature,validStorageKey} from '../src/lib/media-access';
import {youtubeSchedulePayload,tiktokSchedulePayload,facebookSchedulePayload,scheduleInput} from '../src/lib/scheduling';
import {GET as scheduler} from '../src/app/api/scheduler/route';
const asset={id:'11111111-1111-4111-8111-111111111111',workspace_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',storage_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/video/a.mp4',mime_type:'video/mp4'};
test('provider media links expire and cannot be moved to another asset or workspace',()=>{
 process.env.TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');const now=Date.now(),url=new URL(signedMediaUrl(asset,now));
 assert(validMediaSignature(asset,url.searchParams,now));assert(!validMediaSignature(asset,url.searchParams,now+7200001));assert(!validMediaSignature({...asset,id:'changed'},url.searchParams,now));assert(!validMediaSignature({...asset,workspace_id:'other'},url.searchParams,now));
 url.searchParams.set('expires',String(Number(url.searchParams.get('expires'))+1));assert(!validMediaSignature(asset,url.searchParams,now));
 assert(!validStorageKey({...asset,storage_key:'another-workspace/file.mp4'}));assert(!validStorageKey({...asset,storage_key:asset.workspace_id+'/../other/file.mp4'}));assert(!validStorageKey({...asset,mime_type:'text/html'}));
});
test('schedules require explicit destination, settings and an offset-qualified instant',()=>{
 assert(!youtubeSchedulePayload.safeParse({title:'Test',madeForKids:false}).success);assert(!tiktokSchedulePayload.safeParse({caption:'Hello',privacy:'SELF_ONLY'}).success);
 const good={connectionId:asset.id,mediaAssetId:asset.id,scheduledFor:'2026-10-10T12:00:00+01:00',requestId:'request-123',payload:{}};assert(scheduleInput.safeParse(good).success);assert(!scheduleInput.safeParse({...good,scheduledFor:'2026-10-10T12:00'}).success);assert(scheduleInput.safeParse({...good,mediaUrl:'https://example.com/a.mp4'}).success);assert(facebookSchedulePayload.safeParse({message:'Facebook text'}).success);assert(!facebookSchedulePayload.safeParse({message:''}).success);
});
test('scheduler cannot be invoked anonymously, including its dry run',async()=>{
 for(const suffix of ['', '?dry_run=true'])assert.equal((await scheduler(new Request('https://channel-desk-61xl.vercel.app/api/scheduler'+suffix))).status,401);
});

test('read-only MCP grants cannot mutate the shared Planner',async()=>{
 const {buildMcp}=await import('../src/lib/mcp-server');const handler=buildMcp(asset.id,['channeldesk.read']);
 const r=await handler.fetch(new Request('https://channel-desk-61xl.vercel.app/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'cancel_scheduled_publication',arguments:{workspaceId:asset.workspace_id,publicationId:asset.id}}})}));
 const raw=await r.text(),parsed=JSON.parse(raw.startsWith('event:')?raw.split('\n').find(s=>s.startsWith('data:'))!.slice(5):raw);assert.equal(parsed.result.isError,true);assert.match(parsed.result.content[0].text,/channeldesk.publish/);
});
