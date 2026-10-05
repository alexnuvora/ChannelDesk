import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { cancelYouTubeSchedule, createYouTubePublication, getCalendar, getPublicationStatus, listSocialAccounts, rescheduleYouTubePublication, syncYouTubePublication } from "@/lib/publishing";
import { assertWorkspaceAccess, authenticateMcp, issuer, mcpResource } from "@/lib/mcp-oauth";

export const runtime="nodejs";
export const maxDuration=300;

function result(value:unknown){ return {content:[{type:"text" as const,text:JSON.stringify(value,null,2)}],structuredContent:{result:value}}; }
function failure(error:unknown){ return {content:[{type:"text" as const,text:error instanceof Error?error.message:"ChannelDesk operation failed."}],isError:true}; }
function challenge(){ return `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource", scope="channeldesk.read"`; }

function buildMcp(userId:string,scopes:string[]){
 const server=new McpServer({name:"ChannelDesk",version:"0.2.0"},{capabilities:{tools:{}}});
 const guard=async(workspaceId:string,scope:"channeldesk.read"|"channeldesk.publish")=>{ if(!scopes.includes(scope)) throw new Error(`OAuth scope ${scope} is required.`); await assertWorkspaceAccess(userId,workspaceId); };
 server.registerTool("list_social_accounts",{description:"List active social accounts for a ChannelDesk workspace.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid()})},async({workspaceId})=>{try{await guard(workspaceId,"channeldesk.read");return result(await listSocialAccounts(workspaceId));}catch(e){return failure(e);}});
 server.registerTool("get_calendar",{description:"Get scheduled ChannelDesk publications in an ISO-8601 date range.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),from:z.string().datetime(),to:z.string().datetime()})},async({workspaceId,from,to})=>{try{await guard(workspaceId,"channeldesk.read");return result(await getCalendar(from,to,workspaceId));}catch(e){return failure(e);}});
 server.registerTool("publish_youtube",{description:"Publish a public HTTPS video URL to the connected YouTube channel now. Use only after the user has clearly asked to publish.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),title:z.string().min(1).max(100),description:z.string().max(5000).optional(),mediaUrl:z.string().url(),privacy:z.enum(["private","unlisted","public"]).default("public"),madeForKids:z.boolean().default(false),tags:z.array(z.string()).max(30).optional(),requestId:z.string().min(8).max(128)})},async({workspaceId,...args})=>{try{await guard(workspaceId,"channeldesk.publish");return result(await createYouTubePublication(args,workspaceId));}catch(e){return failure(e);}});
 server.registerTool("schedule_youtube",{description:"Upload a public HTTPS video URL to YouTube now as private and schedule YouTube to publish it at the supplied future ISO-8601 time.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),title:z.string().min(1).max(100),description:z.string().max(5000).optional(),mediaUrl:z.string().url(),scheduledFor:z.string().datetime(),madeForKids:z.boolean().default(false),tags:z.array(z.string()).max(30).optional(),requestId:z.string().min(8).max(128)})},async({workspaceId,...args})=>{try{await guard(workspaceId,"channeldesk.publish");return result(await createYouTubePublication({...args,privacy:"private"},workspaceId));}catch(e){return failure(e);}});
 server.registerTool("get_publication_status",{description:"Get the stored ChannelDesk publication and per-network delivery status.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),publicationId:z.string().uuid()})},async({workspaceId,publicationId})=>{try{await guard(workspaceId,"channeldesk.read");return result(await getPublicationStatus(publicationId,workspaceId));}catch(e){return failure(e);}});
 server.registerTool("sync_youtube_status",{description:"Refresh a YouTube publication's processing, privacy and scheduling status from YouTube and persist it in ChannelDesk.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),publicationId:z.string().uuid()})},async({workspaceId,publicationId})=>{try{await guard(workspaceId,"channeldesk.publish");return result(await syncYouTubePublication(publicationId,workspaceId));}catch(e){return failure(e);}});
 server.registerTool("reschedule_youtube",{description:"Change the future publication time of an already uploaded, still-private YouTube video.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),publicationId:z.string().uuid(),scheduledFor:z.string().datetime()})},async({workspaceId,publicationId,scheduledFor})=>{try{await guard(workspaceId,"channeldesk.publish");return result(await rescheduleYouTubePublication(publicationId,scheduledFor,workspaceId));}catch(e){return failure(e);}});
 server.registerTool("cancel_youtube_schedule",{description:"Cancel a scheduled YouTube publication while keeping the uploaded video private. Use only after the user clearly asks to cancel it.",_meta:{"securitySchemes":[{"type":"oauth2","scopes":["channeldesk.read","channeldesk.publish"]}]},inputSchema:z.object({workspaceId:z.string().uuid(),publicationId:z.string().uuid()})},async({workspaceId,publicationId})=>{try{await guard(workspaceId,"channeldesk.publish");return result(await cancelYouTubeSchedule(publicationId,workspaceId));}catch(e){return failure(e);}});
 return createMcpHandler(()=>server);
}
async function handle(request:Request){
 const auth=await authenticateMcp(request);
 if(!auth) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"content-type":"application/json","www-authenticate":challenge()}});
 const handler=buildMcp(auth.userId,auth.scopes);
 return handler.fetch(request);
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
