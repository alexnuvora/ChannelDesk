import {randomBytes,createHash} from 'node:crypto';
const origin=process.env.CHANNELDESK_URL,project=process.env.SUPABASE_PROJECT_ID,accessToken=process.env.SUPABASE_ACCESS_TOKEN;
if(origin!=='https://channel-desk-61xl.vercel.app'||project!=='zmwfyrqbgtvtuajbjnzm')throw new Error('ChannelDesk target mismatch.');
if(!accessToken)throw new Error('SUPABASE_ACCESS_TOKEN is required.');
let ready=false;
for(let attempt=0;attempt<12;attempt++){
 const r=await fetch(origin+'/api/scheduler',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(r.headers.get('x-channeldesk-scheduler')==='2'){ready=true;break;}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
if(!ready)throw new Error('Scheduler deployment is not ready.');
const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
const issue=await fetch('https://api.supabase.com/v1/projects/'+project+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({query:"select public.issue_scheduler_ticket('"+hash+"');"}),redirect:'error',signal:AbortSignal.timeout(60000)});
if(!issue.ok)throw new Error('Could not issue scheduler ticket (Supabase Management API HTTP '+issue.status+').');
const dry=process.env.SCHEDULER_DRY_RUN==='true';
const response=await fetch(origin+'/api/scheduler'+(dry?'?dry_run=true':''),{
 headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(285000)
});
if(!response.ok)throw new Error('Scheduler returned HTTP '+response.status+'. Check saved publication states before retrying.');
const result=await response.json();
console.log(JSON.stringify({ok:result.ok,dryRun:!!result.dryRun,processed:result.processed??0}));
