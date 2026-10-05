import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createCipheriv, randomBytes, randomUUID } from "crypto";

function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error("ChannelDesk server database credentials are not configured.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function key(){
 const k=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY??"","base64");
 if(k.length!==32) throw new Error("TOKEN_ENCRYPTION_KEY is invalid.");
 return k;
}
function decrypt(value:string){
 const [iv,tag,data]=value.split(".");
 if(!iv||!tag||!data) throw new Error("Stored OAuth token is invalid.");
 const d=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64"));
 d.setAuthTag(Buffer.from(tag,"base64"));
 return Buffer.concat([d.update(Buffer.from(data,"base64")),d.final()]).toString("utf8");
}
function encrypt(value:string){
 const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key(),iv);
 const data=Buffer.concat([c.update(value,"utf8"),c.final()]);
 return [iv.toString("base64"),c.getAuthTag().toString("base64"),data.toString("base64")].join(".");
}
function requireWorkspaceId(workspaceId?:string){
 if(!workspaceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) throw new Error("A valid ChannelDesk workspaceId is required.");
 return workspaceId;
}
async function youtubeAccessToken(connection:any){
 if(connection.token_expires_at && new Date(connection.token_expires_at).getTime()>Date.now()+60_000) return decrypt(connection.token_ciphertext);
 if(!connection.refresh_token_ciphertext) throw new Error("YouTube connection must be reconnected because no refresh token is stored.");
 const refresh=decrypt(connection.refresh_token_ciphertext);
 const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_OAUTH_CLIENT_ID??"",client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET??"",refresh_token:refresh,grant_type:"refresh_token"})});
 if(!res.ok) throw new Error("Google token refresh failed.");
 const t=await res.json() as {access_token:string;expires_in:number};
 await admin().from("social_connections").update({token_ciphertext:encrypt(t.access_token),token_expires_at:new Date(Date.now()+t.expires_in*1000).toISOString()}).eq("id",connection.id);
 return t.access_token;
}
function assertPublicMediaUrl(raw:string){
 const u=new URL(raw);
 if(u.protocol!=="https:") throw new Error("Media URL must use HTTPS.");
 const h=u.hostname.toLowerCase();
 if(h==="localhost"||h.endsWith(".local")||h==="127.0.0.1"||h==="::1"||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)) throw new Error("Private-network media URLs are not allowed.");
 return u.toString();
}
export async function listSocialAccounts(workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const {data,error}=await admin().from("social_connections").select("id,network,external_account_id,display_name,active,token_expires_at").eq("workspace_id",workspaceId).eq("active",true);
 if(error) throw error; return data??[];
}
export async function getCalendar(from:string,to:string,workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const {data,error}=await admin().from("publications").select("id,text,state,scheduled_for,created_at,publication_targets(id,state,external_post_id,external_url,error_code,error_message,social_connections(network,display_name))").eq("workspace_id",workspaceId).gte("scheduled_for",from).lte("scheduled_for",to).order("scheduled_for");
 if(error) throw error; return data??[];
}
export async function createYouTubePublication(input:{title:string;description?:string;mediaUrl:string;scheduledFor?:string;privacy?: "private"|"unlisted"|"public";madeForKids?:boolean;tags?:string[];requestId?:string},workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const db=admin();
 const idem=`youtube:${workspaceId}:${input.requestId??randomUUID()}`;
 const {data:existing}=await db.from("publication_targets").select("publication_id,external_post_id,external_url,state").eq("idempotency_key",idem).maybeSingle();
 if(existing) return {publicationId:existing.publication_id,videoId:existing.external_post_id,url:existing.external_url,state:existing.state,idempotentReplay:true};
 const {data:connections,error:ce}=await db.from("social_connections").select("*").eq("workspace_id",workspaceId).eq("network","youtube").eq("active",true).limit(1);
 if(ce) throw ce; const connection=connections?.[0]; if(!connection) throw new Error("No active YouTube connection.");
 const mediaUrl=assertPublicMediaUrl(input.mediaUrl);
 const scheduled=input.scheduledFor ? new Date(input.scheduledFor) : null;
 if(scheduled && (!Number.isFinite(scheduled.getTime())||scheduled.getTime()<=Date.now())) throw new Error("scheduledFor must be a future ISO-8601 date.");
 const {data:members,error:me}=await db.from("workspace_members").select("user_id,role").eq("workspace_id",workspaceId).order("role").limit(1);
 if(me) throw me; const actor=members?.[0]?.user_id; if(!actor) throw new Error("Workspace has no member to attribute this publication to.");
 const {data:pub,error:pe}=await db.from("publications").insert({workspace_id:workspaceId,author_id:actor,text:input.description??"",state:scheduled?"scheduled":"publishing",scheduled_for:scheduled?.toISOString()??null}).select("id").single();
 if(pe) throw pe;
 const payload={title:input.title,description:input.description??"",mediaUrl,tags:input.tags??[],madeForKids:input.madeForKids??false,privacy:input.privacy??"public",scheduledFor:scheduled?.toISOString()??null};
 const {data:target,error:te}=await db.from("publication_targets").insert({publication_id:pub.id,connection_id:connection.id,network_payload:payload,state:scheduled?"scheduled":"publishing",idempotency_key:idem}).select("id").single();
 if(te) throw te;
 try{
   const result=await uploadYouTube(connection,payload);
   const finalState=scheduled?"scheduled":(result.status?.uploadStatus==="processed"&&result.status?.privacyStatus===payload.privacy?"published":"publishing");
   await db.from("publication_targets").update({state:finalState,external_post_id:result.id,external_url:`https://www.youtube.com/watch?v=${result.id}`,published_at:finalState==="published"?new Date().toISOString():null,attempts:1}).eq("id",target.id);
   await db.from("publications").update({state:finalState}).eq("id",pub.id);
   return {publicationId:pub.id,targetId:target.id,videoId:result.id,url:`https://www.youtube.com/watch?v=${result.id}`,state:finalState,scheduledFor:scheduled?.toISOString()??null,youtubeStatus:result.status??null};
 }catch(e){
   const msg=e instanceof Error?e.message:"YouTube upload failed";
   await db.from("publication_targets").update({state:"failed",error_code:"youtube_upload_failed",error_message:msg,attempts:1}).eq("id",target.id);
   await db.from("publications").update({state:"failed"}).eq("id",pub.id);
   throw e;
 }
}
async function uploadYouTube(connection:any,payload:any){
 const access=await youtubeAccessToken(connection);
 const media=await fetch(payload.mediaUrl,{redirect:"follow"});
 if(!media.ok||!media.body) throw new Error(`Could not fetch media (HTTP ${media.status}).`);
 const length=media.headers.get("content-length"); if(!length) throw new Error("Media server must provide Content-Length.");
 const mime=media.headers.get("content-type")?.split(";")[0]||"video/mp4";
 if(!mime.startsWith("video/")) throw new Error("Media URL is not a video.");
 const status:any={privacyStatus:payload.scheduledFor?"private":payload.privacy,selfDeclaredMadeForKids:Boolean(payload.madeForKids)};
 if(payload.scheduledFor) status.publishAt=payload.scheduledFor;
 const init=await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{method:"POST",headers:{authorization:`Bearer ${access}`,"content-type":"application/json; charset=UTF-8","x-upload-content-length":length,"x-upload-content-type":mime},body:JSON.stringify({snippet:{title:payload.title,description:payload.description,tags:payload.tags},status})});
 if(!init.ok) throw new Error(`YouTube upload initialization failed (HTTP ${init.status}): ${await init.text()}`);
 const location=init.headers.get("location"); if(!location) throw new Error("YouTube did not return a resumable upload URL.");
 const videoBytes=await media.arrayBuffer();
 if(videoBytes.byteLength!==Number(length)) throw new Error("Downloaded media length does not match Content-Length.");
 const upload=await fetch(location,{method:"PUT",headers:{"content-type":mime,"content-length":String(videoBytes.byteLength)},body:videoBytes});
 if(!upload.ok) throw new Error(`YouTube upload failed (HTTP ${upload.status}): ${await upload.text()}`);
 return await upload.json() as {id:string;status?:{uploadStatus?:string;privacyStatus?:string;publishAt?:string}};
}
export async function getPublicationStatus(id:string,workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const {data,error}=await admin().from("publications").select("id,text,state,scheduled_for,created_at,publication_targets(id,state,external_post_id,external_url,error_code,error_message,attempts)").eq("workspace_id",workspaceId).eq("id",id).single();
 if(error) throw error; return data;
}

export async function syncYouTubePublication(id:string,workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const db=admin();
 const {data:pub,error}=await db.from("publications").select("id,state,publication_targets(id,connection_id,external_post_id,state)").eq("workspace_id",workspaceId).eq("id",id).single();
 if(error) throw error;
 const target=(pub.publication_targets as any[])?.find(t=>t.external_post_id);
 if(!target) return pub;
 const {data:conn,error:ce}=await db.from("social_connections").select("*").eq("workspace_id",workspaceId).eq("id",target.connection_id).eq("network","youtube").single();
 if(ce) throw ce;
 const access=await youtubeAccessToken(conn);
 const res=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(target.external_post_id)}`,{headers:{authorization:`Bearer ${access}`}});
 if(!res.ok) throw new Error(`YouTube status lookup failed (HTTP ${res.status}).`);
 const body=await res.json() as {items?:Array<{status?:{uploadStatus?:string;privacyStatus?:string;publishAt?:string;failureReason?:string;rejectionReason?:string}}>};
 const status=body.items?.[0]?.status; if(!status) throw new Error("The YouTube video no longer exists or is inaccessible.");
 let state=target.state; if(status.uploadStatus==="failed"||status.uploadStatus==="rejected") state="failed"; else if(status.privacyStatus==="public") state="published"; else if(status.publishAt) state="scheduled";
 await db.from("publication_targets").update({state,error_code:status.failureReason??status.rejectionReason??null,error_message:null,published_at:state==="published"?new Date().toISOString():null}).eq("id",target.id);
 await db.from("publications").update({state}).eq("id",id);
 return {publicationId:id,videoId:target.external_post_id,state,youtube:status,url:`https://www.youtube.com/watch?v=${target.external_post_id}`};
}
export async function rescheduleYouTubePublication(id:string,scheduledFor:string,workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const when=new Date(scheduledFor); if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now()) throw new Error("scheduledFor must be a future ISO-8601 date.");
 const db=admin(); const {data:pub,error}=await db.from("publications").select("publication_targets(id,connection_id,external_post_id)").eq("workspace_id",workspaceId).eq("id",id).single(); if(error) throw error;
 const target=(pub.publication_targets as any[])?.find(t=>t.external_post_id); if(!target) throw new Error("Publication has no YouTube video.");
 const {data:conn,error:ce}=await db.from("social_connections").select("*").eq("id",target.connection_id).eq("workspace_id",workspaceId).single(); if(ce) throw ce;
 const access=await youtubeAccessToken(conn);
 const current=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(target.external_post_id)}`,{headers:{authorization:`Bearer ${access}`}});
 if(!current.ok) throw new Error(`YouTube status lookup failed (HTTP ${current.status}).`);
 const currentBody=await current.json() as {items?:Array<{status?:any}>}; const s=currentBody.items?.[0]?.status??{};
 const writable={privacyStatus:"private",publishAt:when.toISOString(),...(typeof s.selfDeclaredMadeForKids==="boolean"?{selfDeclaredMadeForKids:s.selfDeclaredMadeForKids}:{}),...(typeof s.embeddable==="boolean"?{embeddable:s.embeddable}:{}),...(typeof s.publicStatsViewable==="boolean"?{publicStatsViewable:s.publicStatsViewable}:{}),...(s.license?{license:s.license}:{})};
 const res=await fetch("https://www.googleapis.com/youtube/v3/videos?part=status",{method:"PUT",headers:{authorization:`Bearer ${access}`,"content-type":"application/json"},body:JSON.stringify({id:target.external_post_id,status:writable})});
 if(!res.ok) throw new Error(`YouTube reschedule failed (HTTP ${res.status}): ${await res.text()}`);
 await db.from("publication_targets").update({state:"scheduled"}).eq("id",target.id); await db.from("publications").update({state:"scheduled",scheduled_for:when.toISOString()}).eq("id",id);
 return {publicationId:id,videoId:target.external_post_id,state:"scheduled",scheduledFor:when.toISOString()};
}
export async function cancelYouTubeSchedule(id:string,workspaceId?:string){ workspaceId=requireWorkspaceId(workspaceId);
 const db=admin(); const {data:pub,error}=await db.from("publications").select("publication_targets(id,connection_id,external_post_id)").eq("workspace_id",workspaceId).eq("id",id).single(); if(error) throw error;
 const target=(pub.publication_targets as any[])?.find(t=>t.external_post_id); if(!target) throw new Error("Publication has no YouTube video.");
 const {data:conn,error:ce}=await db.from("social_connections").select("*").eq("id",target.connection_id).eq("workspace_id",workspaceId).single(); if(ce) throw ce;
 const access=await youtubeAccessToken(conn);
 const current=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(target.external_post_id)}`,{headers:{authorization:`Bearer ${access}`}});
 if(!current.ok) throw new Error(`YouTube status lookup failed (HTTP ${current.status}).`);
 const currentBody=await current.json() as {items?:Array<{status?:any}>}; const s=currentBody.items?.[0]?.status??{};
 const writable={privacyStatus:"private",...(typeof s.selfDeclaredMadeForKids==="boolean"?{selfDeclaredMadeForKids:s.selfDeclaredMadeForKids}:{}),...(typeof s.embeddable==="boolean"?{embeddable:s.embeddable}:{}),...(typeof s.publicStatsViewable==="boolean"?{publicStatsViewable:s.publicStatsViewable}:{}),...(s.license?{license:s.license}:{})};
 const res=await fetch("https://www.googleapis.com/youtube/v3/videos?part=status",{method:"PUT",headers:{authorization:`Bearer ${access}`,"content-type":"application/json"},body:JSON.stringify({id:target.external_post_id,status:writable})});
 if(!res.ok) throw new Error(`YouTube schedule cancellation failed (HTTP ${res.status}): ${await res.text()}`);
 await db.from("publication_targets").update({state:"cancelled"}).eq("id",target.id); await db.from("publications").update({state:"cancelled",scheduled_for:null}).eq("id",id);
 return {publicationId:id,videoId:target.external_post_id,state:"cancelled",youtubePrivacy:"private"};
}
