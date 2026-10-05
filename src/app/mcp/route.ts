import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createYouTubePublication, getCalendar, getPublicationStatus, listSocialAccounts } from "@/lib/publishing";

export const runtime="nodejs";
export const maxDuration=300;

function result(value:unknown){
 return {content:[{type:"text" as const,text:JSON.stringify(value,null,2)}],structuredContent:{result:value}};
}
function failure(error:unknown){
 return {content:[{type:"text" as const,text:error instanceof Error?error.message:"ChannelDesk operation failed."}],isError:true};
}
const mcp=createMcpHandler(()=>{
 const server=new McpServer({name:"ChannelDesk",version:"0.1.0"},{capabilities:{tools:{}}});
 server.registerTool("list_social_accounts",{description:"List the active social accounts connected to this ChannelDesk workspace."},async()=>{try{return result(await listSocialAccounts());}catch(e){return failure(e);}});
 server.registerTool("get_calendar",{description:"Get scheduled ChannelDesk publications in an ISO-8601 date range.",inputSchema:z.object({from:z.string().datetime(),to:z.string().datetime()})},async({from,to})=>{try{return result(await getCalendar(from,to));}catch(e){return failure(e);}});
 server.registerTool("publish_youtube",{description:"Publish a public HTTPS video URL to the connected YouTube channel now. Use only after the user has clearly asked to publish.",inputSchema:z.object({title:z.string().min(1).max(100),description:z.string().max(5000).optional(),mediaUrl:z.string().url(),privacy:z.enum(["private","unlisted","public"]).default("public"),madeForKids:z.boolean().default(false),tags:z.array(z.string()).max(30).optional()})},async(args)=>{try{return result(await createYouTubePublication(args));}catch(e){return failure(e);}});
 server.registerTool("schedule_youtube",{description:"Upload a public HTTPS video URL to YouTube now as private and schedule YouTube to publish it at the supplied future ISO-8601 time.",inputSchema:z.object({title:z.string().min(1).max(100),description:z.string().max(5000).optional(),mediaUrl:z.string().url(),scheduledFor:z.string().datetime(),madeForKids:z.boolean().default(false),tags:z.array(z.string()).max(30).optional()})},async(args)=>{try{return result(await createYouTubePublication({...args,privacy:"private"}));}catch(e){return failure(e);}});
 server.registerTool("get_publication_status",{description:"Get ChannelDesk publication and per-network delivery status.",inputSchema:z.object({publicationId:z.string().uuid()})},async({publicationId})=>{try{return result(await getPublicationStatus(publicationId));}catch(e){return failure(e);}});
 return server;
});

function authorized(request:Request){
 const expected=process.env.CHANNELDESK_MCP_TOKEN;
 if(!expected) return false;
 const auth=request.headers.get("authorization");
 return auth===`Bearer ${expected}`;
}
async function handle(request:Request){
 if(!authorized(request)) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"content-type":"application/json","www-authenticate":'Bearer realm="ChannelDesk MCP"'}});
 return mcp(request);
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
