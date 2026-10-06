import {dispatchDuePublications} from '@/lib/publishing';
import {admin,hashSecret} from '@/lib/mcp-oauth';
import {logFailure} from '@/lib/config';
export const runtime='nodejs';
export const maxDuration=300;
const headers={'Cache-Control':'no-store','X-ChannelDesk-Scheduler':'2'};
export async function GET(request:Request){
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return Response.json({error:'Unauthorized'},{status:401,headers});
 try{
  const {data,error}=await admin().rpc('consume_scheduler_ticket',{p_hash:hashSecret(token)});
  if(error)throw error;if(!data)return Response.json({error:'Unauthorized'},{status:401,headers});
  if(new URL(request.url).searchParams.get('dry_run')==='true')return Response.json({ok:true,dryRun:true},{headers});
  const results=await dispatchDuePublications(3);return Response.json({ok:true,processed:results.length,results},{headers});
 }catch(e){logFailure('scheduler.request.failed',e);return Response.json({ok:false,error:'Scheduler unavailable. Check saved delivery states before retrying.'},{status:503,headers});}
}
