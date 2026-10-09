import {reportRange} from '@/lib/report-range';
import {createClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';
const KEYS=['views','impressions','reach','likes','comments','shares','clicks','watch_minutes','subscribers_gained','subscribers_lost'] as const;
const HEADERS=['Date','Channel','Account',...KEYS] as const;
function csvCell(value:unknown){
 const raw=value==null?'':String(value);
 // CSV is commonly opened in spreadsheet software. Never let account names become formulas.
 const safe=/^[\s\u0000-\u001f]*[=+@\-]/.test(raw)&&!/^-[0-9]+(?:\.[0-9]+)?$/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
export async function GET(request:Request){
 const s=await createClient();
 const {data:{user},error:authError}=await s.auth.getUser();
 if(authError||!user)return new Response('Sign in required',{status:401});
 const url=new URL(request.url);
 let range:ReturnType<typeof reportRange>;try{range=reportRange(url.searchParams)}catch(e){return new Response(e instanceof Error?e.message:'Invalid date range',{status:400})}
 const workspaceId=url.searchParams.get('workspaceId');
 let membershipQuery=s.from('workspace_members').select('workspace_id').eq('user_id',user.id);
 if(workspaceId)membershipQuery=membershipQuery.eq('workspace_id',workspaceId);
 const {data:membership,error:memberError}=await membershipQuery.limit(1).maybeSingle();
 if(memberError)return new Response('Could not verify workspace access',{status:503});
 if(!membership)return new Response('Workspace not found',{status:404});

 const {data:connections,error:connectionError}=await s.from('social_connections').select('id,network,display_name').eq('workspace_id',membership.workspace_id);
 if(connectionError)return new Response('Could not load channel names',{status:503});
 const lookup=new Map((connections||[]).map(c=>[c.id,c]));
 const lines=[HEADERS.map(csvCell).join(',')];
 const pageSize=500;let offset=0;
 for(;;){
  const {data,error}=await s.from('analytics_snapshots').select('metric_date,connection_id,metrics').eq('workspace_id',membership.workspace_id).gte('metric_date',range.from).lte('metric_date',range.to).order('metric_date',{ascending:true}).order('connection_id',{ascending:true}).range(offset,offset+pageSize-1);
  if(error)return new Response('Could not export analytics',{status:503});
  for(const r of data||[]){
   const connection=lookup.get(r.connection_id);
   const metrics=(r.metrics&&typeof r.metrics==='object'&&!Array.isArray(r.metrics)?r.metrics:{}) as Record<string,unknown>;
   const values=[r.metric_date,connection?.network||'',connection?.display_name||'',...KEYS.map(k=>typeof metrics[k]==='number'&&Number.isFinite(metrics[k])?metrics[k]:'')];
   lines.push(values.map(csvCell).join(','));
  }
  if(!data||data.length<pageSize)break;
  offset+=pageSize;
  if(offset>=10000)return new Response('Export exceeds 10,000 rows. Choose a shorter date range.',{status:422});
 }
 return new Response('\uFEFF'+lines.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="channeldesk-analytics-${range.from}-to-${range.to}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
