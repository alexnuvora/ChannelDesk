import {createDecipheriv,createCipheriv,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {admin,assertWorkspaceAccess,hashSecret} from './mcp-oauth';
import {fetchVideo,validateMediaUrl} from './media-fetch';
import {ConfigurationError,logFailure} from './config';
function key(){const k=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY||'','base64');if(k.length!==32)throw new ConfigurationError('TOKEN_ENCRYPTION_KEY');return k;}
export function decrypt(value:string){const [iv,tag,data]=value.split('.');if(!iv||!tag||!data)throw new Error('Stored channel credentials are invalid. Reconnect YouTube.');const d=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64'));d.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([d.update(Buffer.from(data,'base64')),d.final()]).toString('utf8');}
export function encrypt(value:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return [iv.toString('base64'),c.getAuthTag().toString('base64'),data.toString('base64')].join('.');}
type Connection={id:string;workspace_id:string;token_ciphertext:string;refresh_token_ciphertext:string|null;token_expires_at:string|null;scopes:string[]};
type VideoStatus={uploadStatus?:string;privacyStatus?:string;publishAt?:string;failureReason?:string;rejectionReason?:string;selfDeclaredMadeForKids?:boolean;embeddable?:boolean;publicStatsViewable?:boolean;license?:string};
export const publicationInput=z.object({connectionId:z.string().uuid(),title:z.string().trim().min(1).max(100),description:z.string().max(5000).default(''),mediaUrl:z.string().url(),scheduledFor:z.string().datetime({offset:true}).optional(),privacy:z.enum(['private','unlisted','public']),madeForKids:z.boolean(),tags:z.array(z.string().max(100)).max(30).default([]),requestId:z.string().min(8).max(128)}).strict();
export type PublicationInput=z.input<typeof publicationInput>;
async function youtubeAccessToken(c:Connection){
 if(c.token_expires_at&&Date.parse(c.token_expires_at)>Date.now()+60000)return decrypt(c.token_ciphertext);
 if(!c.refresh_token_ciphertext)throw new Error('Reconnect YouTube to renew channel access.');
 if(!process.env.GOOGLE_OAUTH_CLIENT_ID||!process.env.GOOGLE_OAUTH_CLIENT_SECRET)throw new ConfigurationError('Google OAuth credentials');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_OAUTH_CLIENT_ID,client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET,refresh_token:decrypt(c.refresh_token_ciphertext),grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!r.ok)throw new Error('Google could not renew channel access. Reconnect YouTube.');const t=await r.json();if(!t.access_token||!Number.isFinite(t.expires_in))throw new Error('Google returned invalid channel credentials.');
 const {error}=await admin().from('social_connections').update({token_ciphertext:encrypt(t.access_token),token_expires_at:new Date(Date.now()+t.expires_in*1000).toISOString(),...(t.refresh_token?{refresh_token_ciphertext:encrypt(t.refresh_token)}:{})}).eq('id',c.id).eq('workspace_id',c.workspace_id);if(error)throw error;return t.access_token as string;
}
export async function listSocialAccounts(workspaceId:string){const {data,error}=await admin().from('social_connections').select('id,network,external_account_id,display_name,active,token_expires_at').eq('workspace_id',workspaceId).eq('active',true);if(error)throw error;return data||[];}
export async function getCalendar(from:string,to:string,workspaceId:string){if(Date.parse(to)<Date.parse(from))throw new Error('Calendar end must follow its start.');const {data,error}=await admin().from('publications').select('id,text,state,scheduled_for,created_at,publication_targets(id,state,external_post_id,external_url,error_code,error_message,social_connections(network,display_name))').eq('workspace_id',workspaceId).gte('scheduled_for',from).lte('scheduled_for',to).order('scheduled_for').limit(200);if(error)throw error;return data||[];}
class UploadError extends Error {constructor(message:string,public uncertain=false){super(message);}}
export async function createYouTubePublication(raw:PublicationInput,workspaceId:string,actorId:string){
 const input=publicationInput.parse(raw);await assertWorkspaceAccess(actorId,workspaceId,true);const db=admin();const mediaUrl=validateMediaUrl(input.mediaUrl).href;
 const scheduled=input.scheduledFor?new Date(input.scheduledFor):null;if(scheduled&&scheduled.getTime()<=Date.now()+60000)throw new Error('Choose a schedule at least one minute in the future.');if(input.tags.join(',').length>500)throw new Error('YouTube tags must total 500 characters or fewer.');
 const {data:connection,error}=await db.from('social_connections').select('*').eq('id',input.connectionId).eq('workspace_id',workspaceId).eq('network','youtube').eq('active',true).single();if(error||!connection)throw new Error('Choose an active YouTube account in this workspace.');
 const payload={title:input.title,description:input.description,mediaUrl,tags:input.tags,madeForKids:input.madeForKids,privacy:scheduled?'private':input.privacy,scheduledFor:scheduled?.toISOString()||null};
 const {data:claim,error:claimError}=await db.rpc('claim_youtube_publication',{p_workspace_id:workspaceId,p_actor_id:actorId,p_connection_id:input.connectionId,p_payload:payload,p_request_id:input.requestId,p_request_hash:hashSecret(JSON.stringify({connectionId:input.connectionId,...payload}))});if(claimError)throw new Error(claimError.code==='22023'?claimError.message:'The publication could not be saved. Check the database migration.');if(claim.idempotentReplay)return claim;
 let videoId:string|null=null;
 try{
  const result=await uploadYouTube(connection,payload);videoId=result.id;
  const state=scheduled?'scheduled':result.status?.uploadStatus==='processed'&&result.status?.privacyStatus===payload.privacy?'published':'publishing';
  const {error:saveError}=await db.rpc('finish_youtube_publication',{p_publication_id:claim.publicationId,p_target_id:claim.targetId,p_state:state,p_video_id:videoId,p_error:null,p_actor_id:actorId});if(saveError)throw new UploadError('YouTube accepted the upload, but saving its status failed. Check YouTube before trying again.',true);
  return {...claim,videoId,url:`https://www.youtube.com/watch?v=${videoId}`,state,privacy:result.status?.privacyStatus,scheduledFor:scheduled?.toISOString()||null};
 }catch(e){
  const uncertain=videoId!==null||(e instanceof UploadError&&e.uncertain);const message=e instanceof Error?e.message:'YouTube upload failed.';const state=uncertain?'needs_review':'failed';
  const {error:saveError}=await db.rpc('finish_youtube_publication',{p_publication_id:claim.publicationId,p_target_id:claim.targetId,p_state:state,p_video_id:videoId,p_error:message,p_actor_id:actorId});if(saveError)logFailure('youtube.result_persist_failed',saveError);
  return {...claim,state,error:message,videoId,url:videoId?`https://www.youtube.com/watch?v=${videoId}`:null,needsReview:uncertain};
 }
}
async function uploadYouTube(connection:Connection,payload:any){
 const access=await youtubeAccessToken(connection);const media=await fetchVideo(payload.mediaUrl);
 try{
  const status={privacyStatus:payload.scheduledFor?'private':payload.privacy,selfDeclaredMadeForKids:payload.madeForKids,...(payload.scheduledFor?{publishAt:payload.scheduledFor}:{})};
  const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','X-Upload-Content-Length':String(media.size),'X-Upload-Content-Type':media.type},body:JSON.stringify({snippet:{title:payload.title,description:payload.description,tags:payload.tags},status}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!init.ok)throw new UploadError(`YouTube rejected upload initialisation (HTTP ${init.status}).`);
  const location=init.headers.get('location');if(!location||new URL(location).origin!=='https://www.googleapis.com')throw new UploadError('YouTube returned an invalid upload location.');
  let upload:Response;try{upload=await fetch(location,{method:'PUT',headers:{'Content-Type':media.type,'Content-Length':String(media.size)},body:media.body,duplex:'half',signal:AbortSignal.timeout(210000),redirect:'error'} as RequestInit&{duplex:'half'});}catch{throw new UploadError('YouTube did not confirm the upload. Check YouTube Studio before trying again.',true);}
  if(!upload.ok)throw new UploadError(`YouTube upload failed (HTTP ${upload.status}).`,upload.status>=500);
  const result=await upload.json().catch(()=>{throw new UploadError('YouTube returned an unreadable upload result. Check YouTube Studio.',true);});if(typeof result?.id!=='string')throw new UploadError('YouTube did not return a video ID. Check YouTube Studio.',true);return result as {id:string;status?:VideoStatus};
 }finally{media.cancel();}
}
export async function getPublicationStatus(id:string,workspaceId:string){
 const {data,error}=await admin().from('publications').select('id,text,state,scheduled_for,created_at,publication_targets(id,state,external_post_id,external_url,error_code,error_message,attempts)').eq('workspace_id',workspaceId).eq('id',id).maybeSingle();
 if(error)throw new Error('ChannelDesk could not read this publication.');
 if(!data)throw new Error('Publication not found in this workspace.');
 return data;
}
async function loadTarget(id:string,workspaceId:string,actorId:string){
 await assertWorkspaceAccess(actorId,workspaceId,true);const db=admin();const {data:pub,error}=await db.from('publications').select('id,state,scheduled_for,updated_at,publication_targets(id,connection_id,external_post_id,state,network_payload)').eq('id',id).eq('workspace_id',workspaceId).maybeSingle();if(error)throw new Error('ChannelDesk could not read this publication.');if(!pub)throw new Error('Publication not found in this workspace.');
 const target=(pub.publication_targets as any[])?.find(t=>t.external_post_id);if(!target)throw new Error('No confirmed YouTube video ID is stored for this publication.');const {data:connection,error:ce}=await db.from('social_connections').select('*').eq('id',target.connection_id).eq('workspace_id',workspaceId).eq('network','youtube').eq('active',true).single();if(ce)throw ce;const access=await youtubeAccessToken(connection);
 const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(target.external_post_id)}`,{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw new Error(`YouTube status lookup failed (HTTP ${r.status}).`);const body=await r.json();const status=body.items?.[0]?.status as VideoStatus|undefined;if(!status)throw new Error('This YouTube video is missing or inaccessible.');return {pub,target,access,status,db};
}
export async function syncYouTubePublication(id:string,workspaceId:string,actorId:string){
 const {pub,target,status,db}=await loadTarget(id,workspaceId,actorId);let state=target.state;
 if(['failed','rejected','deleted'].includes(status.uploadStatus||''))state='failed';else if(status.publishAt)state='scheduled';else if(status.uploadStatus==='processed'&&status.privacyStatus===target.network_payload?.privacy)state=target.state==='cancelled'?'cancelled':'published';else if(status.uploadStatus==='processed'&&status.privacyStatus==='public')state='published';
 const {error}=await db.rpc('update_youtube_delivery',{p_publication_id:id,p_target_id:target.id,p_actor_id:actorId,p_state:state,p_scheduled_for:status.publishAt||null,p_error:status.failureReason||status.rejectionReason||null,p_action:'youtube.status_synced',p_expected_updated_at:pub.updated_at});if(error)throw error;return {publicationId:id,videoId:target.external_post_id,state,youtube:status,url:`https://www.youtube.com/watch?v=${target.external_post_id}`};
}
export function assertMutableSchedule(storedState:string,status:VideoStatus){if(storedState!=='scheduled'||status.privacyStatus!=='private'||!status.publishAt||Date.parse(status.publishAt)<=Date.now()+60000)throw new Error('Only a still-private video scheduled more than one minute ahead can be changed.');}
function writableStatus(s:VideoStatus){return {privacyStatus:'private',...(typeof s.selfDeclaredMadeForKids==='boolean'?{selfDeclaredMadeForKids:s.selfDeclaredMadeForKids}:{}),...(typeof s.embeddable==='boolean'?{embeddable:s.embeddable}:{}),...(typeof s.publicStatsViewable==='boolean'?{publicStatsViewable:s.publicStatsViewable}:{}),...(s.license?{license:s.license}:{})};}
async function changeSchedule(id:string,workspaceId:string,actorId:string,date:string|null){
 const {pub,target,status,access,db}=await loadTarget(id,workspaceId,actorId);assertMutableSchedule(pub.state,status);if(date&&(!Number.isFinite(Date.parse(date))||Date.parse(date)<=Date.now()+60000))throw new Error('Choose a schedule at least one minute in the future.');
 // Persist before calling YouTube. A crash leaves needs_review, preventing blind
 // concurrent reschedule/cancel attempts. The status-sync tool can reconcile it.
 const {error:claimError,data:claim}=await db.from('publications').update({state:'needs_review',updated_at:new Date().toISOString()}).eq('id',id).eq('workspace_id',workspaceId).eq('state','scheduled').eq('updated_at',pub.updated_at).select('id,updated_at').maybeSingle();if(claimError||!claim)throw new Error('Another request changed this publication. Refresh its status.');
 try{
  assertMutableSchedule('scheduled',status);
  const nextStatus={...writableStatus(status),...(date?{publishAt:new Date(date).toISOString()}:{})};
  const r=await fetch('https://www.googleapis.com/youtube/v3/videos?part=status',{method:'PUT',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({id:target.external_post_id,status:nextStatus}),signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!r.ok){const detail=await r.json().catch(()=>null);const reason=detail?.error?.errors?.[0]?.reason||detail?.error?.message;throw new Error(`YouTube schedule update failed (HTTP ${r.status})${reason?`: ${reason}`:''}.`);}
  const state=date?'scheduled':'cancelled';
  const scheduledFor=date?new Date(date).toISOString():null;
  const now=new Date().toISOString();
  const {error:targetError}=await db.from('publication_targets').update({state,error_code:null,error_message:null,updated_at:now}).eq('id',target.id);if(targetError)throw targetError;
  const {error:pubError}=await db.from('publications').update({state,scheduled_for:scheduledFor,updated_at:now}).eq('id',id).eq('workspace_id',workspaceId).eq('state','needs_review');if(pubError)throw pubError;
  return {publicationId:id,videoId:target.external_post_id,state,scheduledFor,youtubePrivacy:'private'};
 }catch(e){logFailure('youtube.schedule_update_failed',e);const message=e instanceof Error?e.message:'The schedule change was not confirmed.';throw new Error(`${message} Sync this video’s status before trying again.`);}
}
export const rescheduleYouTubePublication=(id:string,scheduledFor:string,workspaceId:string,actorId:string)=>changeSchedule(id,workspaceId,actorId,scheduledFor);
export const cancelYouTubeSchedule=(id:string,workspaceId:string,actorId:string)=>changeSchedule(id,workspaceId,actorId,null);
