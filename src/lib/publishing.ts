import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createCipheriv, randomBytes } from "crypto";

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
export function mcpWorkspaceId(){
 const id=process.env.CHANNELDESK_MCP_WORKSPACE_ID;
 if(!id) throw new Error("CHANNELDESK_MCP_WORKSPACE_ID is not configured.");
 return id;
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
export async function listSocialAccounts(workspaceId=mcpWorkspaceId()){
 const {data,error}=await admin().from("social_connections").select("id,network,external_account_id,display_name,active,token_expires_at").eq("workspace_id",workspaceId).eq("active",true);
 if(error) throw error; return data??[];
}
export async function getCalendar(from:string,to:string,workspaceId=mcpWorkspaceId()){
 const {data,error}=await admin().from("publications").select("id,text,state,scheduled_for,created_at,publication_targets(id,state,external_post_id,external_url,error_code,error_message,social_connections(network,display_name))").eq("workspace_id",workspaceId).gte("scheduled_for",from).lte("scheduled_for",to).order("scheduled_for");
 if(error) throw error; return data??[];
}
export async function createYouTubePublication(input:{title:string;description?:string;mediaUrl:string;scheduledFor?:string;privacy?: "private"|"unlisted"|"public";madeForKids?:boolean;tags?:string[]},workspaceId=mcpWorkspaceId()){
 const db=admin();
 const {data:connections,error:ce}=await db.from("social_connections").select("*").eq("workspace_id",workspaceId).eq("network","youtube").eq("active",true).limit(1);
 if(ce) throw ce; const connection=connections?.[0]; if(!connection) throw new Error("No active YouTube connection.");
 const mediaUrl=assertPublicMediaUrl(input.mediaUrl);
 const scheduled=input.scheduledFor ? new Date(input.scheduledFor) : null;
 if(scheduled && (!Number.isFinite(scheduled.getTime())||scheduled.getTime()<=Date.now())) throw new Error("scheduledFor must be a future ISO-8601 date.");
 const {data:pub,error:pe}=await db.from("publications").insert({workspace_id:workspaceId,author_id:connection.id,text:input.description??"",state:scheduled?"scheduled":"publishing",scheduled_for:scheduled?.toISOString()??null}).select("id").single();
 if(pe) throw pe;
 const idem=`youtube:${pub.id}`;
 const payload={title:input.title,description:input.description??"",mediaUrl,tags:input.tags??[],madeForKids:input.madeForKids??false,privacy:input.privacy??"public",scheduledFor:scheduled?.toISOString()??null};
 const {data:target,error:te}=await db.from("publication_targets").insert({publication_id:pub.id,connection_id:connection.id,network_payload:payload,state:scheduled?"scheduled":"publishing",idempotency_key:idem}).select("id").single();
 if(te) throw te;
 try{
   const result=await uploadYouTube(connection,payload);
   await db.from("publication_targets").update({state:"published",external_post_id:result.id,external_url:`https://www.youtube.com/watch?v=${result.id}`,published_at:scheduled?null:new Date().toISOString(),attempts:1}).eq("id",target.id);
   await db.from("publications").update({state:scheduled?"scheduled":"published"}).eq("id",pub.id);
   return {publicationId:pub.id,targetId:target.id,videoId:result.id,url:`https://www.youtube.com/watch?v=${result.id}`,state:scheduled?"scheduled":"published",scheduledFor:scheduled?.toISOString()??null};
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
 const upload=await fetch(location,{method:"PUT",headers:{"content-type":mime,"content-length":length},body:media.body as any,duplex:"half" as any});
 if(!upload.ok) throw new Error(`YouTube upload failed (HTTP ${upload.status}): ${await upload.text()}`);
 return await upload.json() as {id:string};
}
export async function getPublicationStatus(id:string,workspaceId=mcpWorkspaceId()){
 const {data,error}=await admin().from("publications").select("id,text,state,scheduled_for,created_at,publication_targets(id,state,external_post_id,external_url,error_code,error_message,attempts)").eq("workspace_id",workspaceId).eq("id",id).single();
 if(error) throw error; return data;
}
