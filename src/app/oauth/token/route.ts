import { admin, base64urlSha256, hashSecret, issueToken, mcpResource } from "@/lib/mcp-oauth";
function json(body:unknown,status=200){return Response.json(body,{status,headers:{"cache-control":"no-store","pragma":"no-cache","access-control-allow-origin":"*"}});}
export async function POST(request:Request){
 const body=new URLSearchParams(await request.text()), grant=body.get("grant_type");
 if(grant==="authorization_code"){
  const code=body.get("code")??"", verifier=body.get("code_verifier")??"", clientId=body.get("client_id")??"", redirect=body.get("redirect_uri")??"", resource=body.get("resource")??"";
  const db=admin(); const {data,error}=await db.from("mcp_oauth_codes").select("*").eq("code_hash",hashSecret(code)).maybeSingle();
  if(error||!data||new Date(data.expires_at).getTime()<=Date.now()) return json({error:"invalid_grant"},400);
  if(data.client_id!==clientId||data.redirect_uri!==redirect||data.resource!==resource||resource!==mcpResource()||base64urlSha256(verifier)!==data.code_challenge) return json({error:"invalid_grant"},400);
  await db.from("mcp_oauth_codes").delete().eq("code_hash",hashSecret(code));
  const access=await issueToken(data.user_id,clientId,resource,data.scope,"access",3600); const refresh=await issueToken(data.user_id,clientId,resource,data.scope,"refresh",30*24*3600);
  return json({access_token:access.token,token_type:"Bearer",expires_in:3600,refresh_token:refresh.token,scope:data.scope});
 }
 if(grant==="refresh_token"){
  const raw=body.get("refresh_token")??"", resource=body.get("resource")??mcpResource(), clientId=body.get("client_id")??""; const db=admin();
  const {data,error}=await db.from("mcp_oauth_tokens").select("*").eq("token_hash",hashSecret(raw)).eq("token_type","refresh").maybeSingle();
  if(error||!data||data.revoked_at||new Date(data.expires_at).getTime()<=Date.now()||data.client_id!==clientId||data.resource!==resource||resource!==mcpResource()) return json({error:"invalid_grant"},400);
  await db.from("mcp_oauth_tokens").update({revoked_at:new Date().toISOString()}).eq("token_hash",hashSecret(raw));
  const access=await issueToken(data.user_id,clientId,resource,data.scope,"access",3600); const refresh=await issueToken(data.user_id,clientId,resource,data.scope,"refresh",30*24*3600);
  return json({access_token:access.token,token_type:"Bearer",expires_in:3600,refresh_token:refresh.token,scope:data.scope});
 }
 return json({error:"unsupported_grant_type"},400);
}
