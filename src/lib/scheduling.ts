import {z} from 'zod';
import {admin,assertWorkspaceAccess,hashSecret} from './mcp-oauth';
import {appOrigin} from './config';
import {validateMediaUrl} from './media-fetch';

export const youtubeSchedulePayload=z.object({title:z.string().trim().min(1).max(100),description:z.string().max(5000).default(''),privacy:z.enum(['private','unlisted','public']),madeForKids:z.boolean(),tags:z.array(z.string().max(100)).max(30).default([])}).strict();
export const tiktokSchedulePayload=z.object({caption:z.string().max(2200),privacy:z.enum(['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY']),disableComment:z.boolean(),disableDuet:z.boolean(),disableStitch:z.boolean()}).strict();
export const scheduleInput=z.object({connectionId:z.string().uuid(),mediaAssetId:z.string().uuid().optional(),mediaUrl:z.string().url().optional(),scheduledFor:z.string().datetime({offset:true}),requestId:z.string().min(8).max(128),payload:z.unknown()}).strict().refine(x=>!!x.mediaAssetId!==!!x.mediaUrl,'Choose one media asset or media URL.');
export async function schedulePublication(raw:z.input<typeof scheduleInput>,workspaceId:string,actorId:string){
 const input=scheduleInput.parse(raw);await assertWorkspaceAccess(actorId,workspaceId,true);const db=admin();
 const {data:c,error}=await db.from('social_connections').select('id,network').eq('id',input.connectionId).eq('workspace_id',workspaceId).eq('active',true).maybeSingle();
 if(error||!c)throw new Error('Choose an active channel in this workspace.');
 if(!['youtube','tiktok'].includes(c.network))throw new Error('Scheduling is not implemented for this network.');
 const payload=c.network==='youtube'?youtubeSchedulePayload.parse(input.payload):tiktokSchedulePayload.parse(input.payload);
 if('tags' in payload&&payload.tags.join(',').length>500)throw new Error('YouTube tags must total 500 characters or fewer.');
 const scheduledFor=new Date(input.scheduledFor).toISOString();if(Date.parse(scheduledFor)<=Date.now()+60000)throw new Error('Choose a schedule at least one minute in the future.');
 let mediaAssetId=input.mediaAssetId||null,mediaUrl=input.mediaUrl?validateMediaUrl(input.mediaUrl).href:null;
 if(mediaUrl){const u=new URL(mediaUrl);if(u.origin===appOrigin()){const m=/^\/media\/([0-9a-f-]{36})$/i.exec(u.pathname);if(!m)throw new Error('Choose a valid ChannelDesk video.');mediaAssetId=m[1];mediaUrl=null;}}
 const content={...payload,...(mediaUrl?{mediaUrl}:{})};
 const {data,error:saveError}=await db.rpc('schedule_planner_publication',{p_workspace_id:workspaceId,p_actor_id:actorId,p_connection_id:c.id,p_media_id:mediaAssetId,p_payload:content,p_scheduled_for:scheduledFor,p_request_id:input.requestId,p_request_hash:hashSecret(JSON.stringify({connectionId:c.id,mediaAssetId,payload:content,scheduledFor}))});
 if(saveError)throw new Error(saveError.code==='22023'?saveError.message:'The schedule could not be saved.');return data as {publicationId:string;targetId:string;state:string;scheduledFor:string;idempotentReplay:boolean};
}
export async function changePlannerSchedule(publicationId:string,workspaceId:string,actorId:string,scheduledFor:string|null){
 z.string().uuid().parse(publicationId);await assertWorkspaceAccess(actorId,workspaceId,true);
 if(scheduledFor)z.string().datetime({offset:true}).parse(scheduledFor);
 const {error}=await admin().rpc('change_planner_schedule',{p_publication_id:publicationId,p_workspace_id:workspaceId,p_actor_id:actorId,p_scheduled_for:scheduledFor});
 if(error)throw new Error(error.code==='22023'?error.message:'The schedule changed. Refresh and try again.');return {publicationId,scheduledFor,state:scheduledFor?'scheduled':'cancelled'};
}
