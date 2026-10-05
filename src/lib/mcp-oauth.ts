import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

export const MCP_SCOPES=["channeldesk.read","channeldesk.publish"] as const;
export const CHATGPT_CLIENT_ID="https://chatgpt.com/oauth/client.json";
export const CHATGPT_STABLE_REDIRECT="https://chatgpt.com/connector_platform_oauth_redirect";

export function appOrigin(){ return (process.env.NEXT_PUBLIC_APP_URL??"").replace(/\/$/,""); }
export function mcpResource(){ const origin=appOrigin(); if(!origin) throw new Error("NEXT_PUBLIC_APP_URL is not configured."); return origin+"/mcp"; }
export function issuer(){ const origin=appOrigin(); if(!origin) throw new Error("NEXT_PUBLIC_APP_URL is not configured."); return origin; }
export function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error("ChannelDesk server database credentials are not configured.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function hashSecret(v:string){ return createHash("sha256").update(v).digest("hex"); }
export function randomSecret(){ return randomBytes(32).toString("base64url"); }
export function validRedirect(uri:string){
 try{ const u=new URL(uri); return u.origin==="https://chatgpt.com"&&(u.pathname==="/connector_platform_oauth_redirect"||/^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname)); }catch{return false;}
}
export function validClientId(id:string){ return id===CHATGPT_CLIENT_ID || /^https:\/\/chatgpt\.com\/oauth\/[A-Za-z0-9_-]+\/client\.json$/.test(id); }
export function normalizeScope(raw:string|null){ const requested=(raw??"").split(/\s+/).filter(Boolean); const allowed=new Set<string>(MCP_SCOPES); return requested.filter(s=>allowed.has(s)).join(" ") || MCP_SCOPES.join(" "); }
export function base64urlSha256(v:string){ return createHash("sha256").update(v).digest("base64url"); }

export async function issueToken(userId:string,clientId:string,resource:string,scope:string,type:"access"|"refresh",ttlSeconds:number){
 const token=randomSecret(); const expires=new Date(Date.now()+ttlSeconds*1000).toISOString();
 const {error}=await admin().from("mcp_oauth_tokens").insert({token_hash:hashSecret(token),user_id:userId,client_id:clientId,resource,scope,token_type:type,expires_at:expires});
 if(error) throw error; return {token,expires};
}
export async function authenticateMcp(request:Request){
 const auth=request.headers.get("authorization"); if(!auth?.startsWith("Bearer ")) return null;
 const raw=auth.slice(7); const {data,error}=await admin().from("mcp_oauth_tokens").select("user_id,resource,scope,expires_at,revoked_at,token_type").eq("token_hash",hashSecret(raw)).eq("token_type","access").maybeSingle();
 if(error||!data||data.revoked_at||data.resource!==mcpResource()||new Date(data.expires_at).getTime()<=Date.now()) return null;
 return {userId:data.user_id as string,scopes:String(data.scope).split(/\s+/).filter(Boolean)};
}
export async function assertWorkspaceAccess(userId:string,workspaceId:string){
 const {data,error}=await admin().from("workspace_members").select("role").eq("workspace_id",workspaceId).eq("user_id",userId).maybeSingle();
 if(error||!data) throw new Error("You do not have access to this ChannelDesk workspace.");
 return data.role as string;
}
