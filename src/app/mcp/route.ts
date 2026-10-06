import {authenticateMcp,issuer} from '@/lib/mcp-oauth';
import {ConfigurationError,logFailure} from '@/lib/config';
import {buildMcp} from '@/lib/mcp-server';
export const runtime='nodejs';
export const maxDuration=300;
const WRITE_TOOLS=new Set(['schedule_publication','reschedule_publication','cancel_scheduled_publication','publish_youtube','schedule_youtube','sync_youtube_status','reschedule_youtube','cancel_youtube_schedule','publish_tiktok','upload_tiktok_draft','get_tiktok_post_status','sync_youtube_analytics','sync_youtube_comments','reply_youtube_comment']);
function challenge(scope='channeldesk.read',error?:string){return `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource", scope="${scope}"${error?`, error="${error}"`:''}`;}
async function handle(request:Request){
 try{
  const origin=request.headers.get('origin');if(origin&&origin!==issuer()&&origin!=='https://chatgpt.com')return Response.json({error:'forbidden_origin'},{status:403});
  const auth=await authenticateMcp(request);if(!auth)return Response.json({error:'unauthorized'},{status:401,headers:{'WWW-Authenticate':challenge(),'Cache-Control':'no-store'}});
  if(request.method==='POST'){
   const length=Number(request.headers.get('content-length')||'0');if(length>100000)return Response.json({error:'request_too_large'},{status:413});
   const body=await request.clone().json().catch(()=>null);const write=body?.method==='tools/call'&&WRITE_TOOLS.has(body?.params?.name);const needed=write?'channeldesk.publish':'channeldesk.read';
   if(body?.method==='tools/call'&&!auth.scopes.includes(needed))return Response.json({error:'insufficient_scope'},{status:403,headers:{'WWW-Authenticate':challenge(needed,'insufficient_scope'),'Cache-Control':'no-store'}});
  }
  return await buildMcp(auth.userId,auth.scopes).fetch(request);
 }catch(e){logFailure('mcp.request.failed',e);return Response.json({error:e instanceof ConfigurationError?'temporarily_unavailable':'server_error',message:'ChannelDesk server setup needs attention. Check its server database key and migrations.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;export const POST=handle;export const DELETE=handle;
export async function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'https://chatgpt.com','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id','Access-Control-Expose-Headers':'WWW-Authenticate, MCP-Session-Id'}});}
