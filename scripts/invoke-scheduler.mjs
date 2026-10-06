import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const origin=process.env.CHANNELDESK_URL,project=process.env.SUPABASE_PROJECT_ID;
if(origin!=='https://channel-desk-61xl.vercel.app'||project!=='zmwfyrqbgtvtuajbjnzm')throw new Error('ChannelDesk target mismatch.');
let ready=false;
for(let attempt=0;attempt<12;attempt++){
 const r=await fetch(origin+'/api/scheduler',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(r.headers.get('x-channeldesk-scheduler')==='2'){ready=true;break;}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
if(!ready)throw new Error('Scheduler deployment is not ready.');
const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
execFileSync('npx',['--no-install','supabase','db','query','--project-ref',project,
 "select public.issue_scheduler_ticket('"+hash+"');"],{stdio:['ignore','pipe','pipe'],timeout:60000});
const dry=process.env.SCHEDULER_DRY_RUN==='true';
const response=await fetch(origin+'/api/scheduler'+(dry?'?dry_run=true':''),{
 headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(285000)
});
if(!response.ok)throw new Error('Scheduler returned HTTP '+response.status+'. Check saved publication states before retrying.');
const result=await response.json();
console.log(JSON.stringify({ok:result.ok,dryRun:!!result.dryRun,processed:result.processed??0}));
