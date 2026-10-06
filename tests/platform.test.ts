import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',ANALYST='33333333-3333-4333-8333-333333333333',APPROVER='44444444-4444-4444-8444-444444444444';
const WA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',WB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',CA='cccccccc-cccc-4ccc-8ccc-cccccccccccc',CB='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MA='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',MB='ffffffff-ffff-4fff-8fff-ffffffffffff';
test('platform isolation and the shared Planner delivery lifecycle',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;grant usage on schema storage to authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated,service_role;`);
 for(const file of (await readdir('supabase/migrations')).filter(s=>s.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(await readFile('scripts/verify-database.sql','utf8'));
 await db.query('insert into workspaces(id,name,slug) values($1,\'A\',\'a-workspace\'),($2,\'B\',\'b-workspace\')',[WA,WB]);
 await db.query('insert into workspace_members values($1,$2,\'owner\'),($3,$4,\'owner\'),($1,$5,\'analyst\'),($1,$6,\'approver\')',[WA,A,WB,B,ANALYST,APPROVER]);
 const as=async(role:string,user=A)=>db.exec(`reset role;set role ${role};select set_config('request.jwt.claim.sub','${user}',false);`);
 for(const [w,u,c,m]of [[WA,A,CA,MA],[WB,B,CB,MB]]){
  await db.query("insert into social_connections(id,workspace_id,network,external_account_id,display_name,token_ciphertext) values($1,$2,'youtube',$3,'Channel','encrypted')",[c,w,c]);
  await db.query("insert into media_assets(id,workspace_id,storage_key,mime_type) values($1,$2,$3,'video/mp4')",[m,w,w+'/'+m+'/video.mp4']);
  const pid=(await db.query<{id:string}>("insert into publications(workspace_id,author_id,text) values($1,$2,'Draft') returning id",[w,u])).rows[0].id;
  await db.query("insert into content_templates(workspace_id,name,created_by) values($1,'Template',$2)",[w,u]);
  await db.query('insert into approval_requests(workspace_id,publication_id,requested_by) values($1,$2,$3)',[w,pid,u]);
  await db.query("insert into inbox_threads(workspace_id,connection_id,external_thread_id) values($1,$2,'thread')",[w,c]);
  await db.query("insert into analytics_snapshots(workspace_id,connection_id,metric_date) values($1,$2,'2026-01-01')",[w,c]);
  await db.query("insert into competitors(workspace_id,network,handle) values($1,'youtube','creator')",[w]);
  await db.query("insert into smart_links(workspace_id,slug,title) values($1,$2,'Links')",[w,w]);
  await db.query("insert into automation_flows(workspace_id,name,trigger_type) values($1,'Flow','manual')",[w]);
  await db.query("insert into saved_reports(workspace_id,name,created_by) values($1,'Report',$2)",[w,u]);
 }
 const payload={title:'Queued',description:'Description',privacy:'private',madeForKids:false,tags:[]};
 let counter=0;
 const schedule=async(overrides:Record<string,unknown>={})=>{
  const p={w:WA,actor:A,c:CA,m:MA,payload,when:new Date(Date.now()+3600000).toISOString(),request:'schedule-request-'+(++counter),hash:'a'.repeat(64),...overrides};
  const result=await db.query<{result:any}>('select schedule_planner_publication($1,$2,$3,$4,$5,$6,$7,$8) as result',[p.w,p.actor,p.c,p.m,JSON.stringify(p.payload),p.when,p.request,p.hash]);return result.rows[0].result;
 };
 await t.test('every expanded table is isolated through the actual authenticated Data API role',async()=>{
  await as('authenticated');for(const table of ['content_templates','approval_requests','inbox_threads','analytics_snapshots','competitors','smart_links','automation_flows','saved_reports'])assert.equal((await db.query('select id from '+table)).rows.length,1,table);
  assert.equal((await db.query('update content_templates set name=\'intrusion\' where workspace_id=$1 returning id',[WB])).rows.length,0);
  await assert.rejects(()=>db.query("insert into competitors(workspace_id,network,handle) values($1,'youtube','intrusion')",[WB]),/row-level security/);
  for(const table of ['approval_requests','inbox_threads','inbox_messages','analytics_snapshots'])await assert.rejects(()=>db.query('delete from '+table),/permission denied/);
  await as('authenticated',APPROVER);assert.equal((await db.query("update content_templates set name='changed' returning id")).rows.length,0);
 });
 await t.test('server roles have explicit grants while cross-workspace references remain invalid',async()=>{
  await as('service_role');assert.equal((await db.query('select id from saved_reports')).rows.length,2);
  await assert.rejects(()=>db.query("insert into inbox_threads(workspace_id,connection_id,external_thread_id) values($1,$2,'bad')",[WA,CB]),/another workspace/);
  await assert.rejects(()=>db.query("insert into analytics_snapshots(workspace_id,connection_id,metric_date) values($1,$2,'2026-02-01')",[WA,CB]),/another workspace/);
 });
 await t.test('scheduling is server-only, role-checked, and rejects another workspace media',async()=>{
  await as('authenticated');await assert.rejects(()=>schedule(),/permission denied/);await as('service_role');
  await assert.rejects(()=>schedule({actor:ANALYST}),/Publishing role/);await assert.rejects(()=>schedule({m:MB}),/video in this workspace/);await assert.rejects(()=>schedule({when:null}),/Invalid schedule/);
 });
 await t.test('schedule retries preserve destination and content, and calendar moves are atomic',async()=>{
  const input={request:'stable-request-123',when:new Date(Date.now()+3600000).toISOString()};const p=await schedule(input);const replay=await schedule(input);assert.equal(replay.publicationId,p.publicationId);assert.equal(replay.idempotentReplay,true);
  await assert.rejects(()=>schedule({...input,hash:'b'.repeat(64)}),/different content/);
  const next=new Date(Date.now()+7200000).toISOString();await db.query('select change_planner_schedule($1,$2,$3,$4)',[p.publicationId,WA,A,next]);
  const row=(await db.query<{scheduled_for:Date}>('select scheduled_for from publications where id=$1',[p.publicationId])).rows[0];assert.equal(new Date(row.scheduled_for).toISOString(),next);
  await db.query('select change_planner_schedule($1,$2,$3,null)',[p.publicationId,WA,A]);assert.equal((await db.query<{state:string}>('select state from publication_targets where id=$1',[p.targetId])).rows[0].state,'cancelled');
 });
 await t.test('claims do not upload early, double-claim or reschedule work already in flight',async()=>{
  const p=await schedule();assert.equal((await db.query('select * from claim_due_publications(3)')).rows.length,0);
  await db.query("update publications set scheduled_for=now()-interval '1 second' where id=$1",[p.publicationId]);
  const claimed=(await db.query<any>('select * from claim_due_publications(3)')).rows;assert.equal(claimed.length,1);assert.equal((await db.query('select * from claim_due_publications(3)')).rows.length,0);
  await assert.rejects(()=>db.query('select change_planner_schedule($1,$2,$3,$4)',[p.publicationId,WA,A,new Date(Date.now()+3600000).toISOString()]),/Only unclaimed/);
  const job=claimed[0];await assert.rejects(()=>db.query('select finish_scheduled_publication($1,$2,$3,$4,$5,$6,$7)',[p.publicationId,p.targetId,MA,'published','video',null,null]),/claim changed/);
  await db.query('select finish_scheduled_publication($1,$2,$3,$4,$5,$6,$7)',[p.publicationId,p.targetId,job.lease_id,'published','video','https://youtube.com/watch?v=video',null]);
  await assert.rejects(()=>db.query('select finish_scheduled_publication($1,$2,$3,$4,$5,$6,$7)',[p.publicationId,p.targetId,job.lease_id,'failed',null,null,'late failure']),/claim changed/);
  assert.equal((await db.query("select id from audit_events where entity_id=$1 and action='planner.published'",[p.publicationId])).rows.length,1);
 });
 await t.test('expired workers and badly overdue posts need review instead of blind re-upload',async()=>{
  const p=await schedule();await db.query("update publications set scheduled_for=now()-interval '1 second' where id=$1",[p.publicationId]);await db.query('select * from claim_due_publications(3)');
  await db.query("update publication_targets set lease_expires_at=now()-interval '1 second' where id=$1",[p.targetId]);assert.equal((await db.query('select * from claim_due_publications(3)')).rows.length,0);
  assert.equal((await db.query<{state:string}>('select state from publications where id=$1',[p.publicationId])).rows[0].state,'needs_review');
  const late=await schedule();await db.query("update publications set scheduled_for=now()-interval '2 hours' where id=$1",[late.publicationId]);assert.equal((await db.query('select * from claim_due_publications(3)')).rows.length,0);
  assert.equal((await db.query<{state:string}>('select state from publications where id=$1',[late.publicationId])).rows[0].state,'needs_review');
 });
 await t.test('provider-native schedules are not re-uploaded or silently moved only in the database',async()=>{
  const p=await schedule();await db.query("update publication_targets set external_post_id='existing-video' where id=$1",[p.targetId]);await db.query("update publications set scheduled_for=now()-interval '1 second' where id=$1",[p.publicationId]);
  assert.equal((await db.query('select * from claim_due_publications(3)')).rows.length,0);await assert.rejects(()=>db.query('select change_planner_schedule($1,$2,$3,$4)',[p.publicationId,WA,A,new Date(Date.now()+3600000).toISOString()]),/provider schedules/);
 });
 await t.test('draft edits update the actual network payload and cannot alter pending approvals',async()=>{
  await as('authenticated');const p=(await db.query<{id:string}>('select create_publication_draft($1,$2,$3,$4) as id',[CA,MA,'Old',JSON.stringify(payload)])).rows[0].id;await as('service_role');
  await db.query('select edit_planner_draft($1,$2,$3,$4)',[p,WA,A,'New title']);assert.equal((await db.query<any>('select network_payload from publication_targets where publication_id=$1',[p])).rows[0].network_payload.title,'New title');
  await as('authenticated');await db.query('select request_publication_approval($1,null)',[p]);await as('service_role');await assert.rejects(()=>db.query('select edit_planner_draft($1,$2,$3,$4)',[p,WA,A,'Changed after request']),/Only draft/);
 });
 await t.test('analytics imports are idempotent and a malformed batch cannot erase saved history',async()=>{
  const rows=[{metric_date:'2026-02-01',metrics:{views:10}}];await db.query('select save_account_analytics($1,$2,$3,$4)',[WA,CA,A,JSON.stringify(rows)]);rows[0].metrics.views=20;await db.query('select save_account_analytics($1,$2,$3,$4)',[WA,CA,A,JSON.stringify(rows)]);
  await assert.rejects(()=>db.query('select save_account_analytics($1,$2,$3,$4)',[WA,CA,A,JSON.stringify([{metric_date:'bad',metrics:{views:0}}])]),/invalid input/);
  const stored=(await db.query<any>("select metrics from analytics_snapshots where connection_id=$1 and metric_date='2026-02-01'",[CA])).rows;assert.equal(stored.length,1);assert.equal(stored[0].metrics.views,20);
 });
 await t.test('scheduler tickets are privileged, short-lived and consumed exactly once',async()=>{
  const hash='c'.repeat(64);await as('authenticated');await assert.rejects(()=>db.query('select issue_scheduler_ticket($1)',[hash]),/permission denied/);await as('service_role');await db.query('select issue_scheduler_ticket($1)',[hash]);
  assert.equal((await db.query<{ok:boolean}>('select consume_scheduler_ticket($1) as ok',[hash])).rows[0].ok,true);assert.equal((await db.query<{ok:boolean}>('select consume_scheduler_ticket($1) as ok',[hash])).rows[0].ok,false);
  await db.query('select issue_scheduler_ticket($1)',[hash]);await db.query("update scheduler_tickets set expires_at=now()-interval '1 second'");assert.equal((await db.query<{ok:boolean}>('select consume_scheduler_ticket($1) as ok',[hash])).rows[0].ok,false);
 });
 await db.close();
});
