import {admin,base64urlSha256,hashSecret,mcpResource,randomSecret,validClientId,validRedirect,validVerifier,normalizeScope} from '@/lib/mcp-oauth';
import {ConfigurationError,logFailure} from '@/lib/config';
export const runtime='nodejs';
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache','Access-Control-Allow-Origin':'*'}});}
export async function POST(request:Request){
 try{
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'invalid_request',error_description:'Use application/x-www-form-urlencoded.'},400);
  const raw=await request.text();if(raw.length>12000)return json({error:'invalid_request'},413);
  const body=new URLSearchParams(raw);for(const key of body.keys())if(body.getAll(key).length!==1)return json({error:'invalid_request'},400);
  const grant=body.get('grant_type'),clientId=body.get('client_id')||'',resource=body.get('resource')||'';
  if(!validClientId(clientId))return json({error:'invalid_client'},400);
  if(resource!==mcpResource())return json({error:'invalid_target'},400);
  const access=randomSecret(),refresh=randomSecret();const tokens={p_access_hash:hashSecret(access),p_refresh_hash:hashSecret(refresh)};let data,error;
  if(grant==='authorization_code'){
   const code=body.get('code')||'',verifier=body.get('code_verifier')||'',redirect=body.get('redirect_uri')||'';
   if(!/^[A-Za-z0-9_-]{43}$/.test(code)||!validVerifier(verifier)||!validRedirect(redirect))return json({error:'invalid_grant'},400);
   ({data,error}=await admin().rpc('exchange_mcp_oauth_code',{p_code_hash:hashSecret(code),p_client_id:clientId,p_redirect_uri:redirect,p_resource:resource,p_code_challenge:base64urlSha256(verifier),...tokens}));
  }else if(grant==='refresh_token'){
   const token=body.get('refresh_token')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))return json({error:'invalid_grant'},400);
   let scope:string|null=null;if(body.has('scope')){try{scope=normalizeScope(body.get('scope'));}catch{return json({error:'invalid_scope'},400);}}
   ({data,error}=await admin().rpc('rotate_mcp_oauth_token',{p_token_hash:hashSecret(token),p_client_id:clientId,p_resource:resource,p_scope:scope,...tokens}));
  }else return json({error:'unsupported_grant_type'},400);
  if(error){if(error.code==='22023')return json({error:'invalid_grant'},400);throw error;}
  if(typeof data!=='string')throw new Error('Invalid token exchange response.');
  return json({access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:data});
 }catch(e){logFailure('oauth.token.failed',e);return json({error:e instanceof ConfigurationError?'temporarily_unavailable':'server_error',error_description:'ChannelDesk could not complete token exchange. The app owner should check server configuration and database migrations.'},503);}
}
export async function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});}
