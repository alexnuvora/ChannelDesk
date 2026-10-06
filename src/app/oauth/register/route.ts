import {createHash} from 'node:crypto';
import {admin,randomSecret} from '@/lib/mcp-oauth';
import {appOrigin,logFailure} from '@/lib/config';
import {MCP_SCOPES,normalizeScope,validRedirect} from '@/lib/oauth-validation';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache','Access-Control-Allow-Origin':'*'}});}
function textValue(v:unknown,max:number){return typeof v==='string'?v.trim().slice(0,max):'';}
function validHttpsUrl(v:string){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}}
function registrationError(error:string,description:string,status=400){return json({error,error_description:description},status);}

export async function POST(request:Request){
 try{
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return registrationError('invalid_client_metadata','Use application/json.');
  const raw=await request.text();if(raw.length>32768)return registrationError('invalid_client_metadata','Registration metadata is too large.',413);
  let body:any;try{body=JSON.parse(raw)}catch{return registrationError('invalid_client_metadata','Registration metadata must be valid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))return registrationError('invalid_client_metadata','Registration metadata must be a JSON object.');
  if(body.software_statement!==undefined)return registrationError('invalid_software_statement','Software statements are not supported.');

  const redirectUris:string[]=Array.isArray(body.redirect_uris)?[...new Set<string>(body.redirect_uris.map((x:unknown)=>typeof x==='string'?x.trim():'').filter((x:string)=>x.length>0))]:[];
  if(!redirectUris.length||redirectUris.length>10||redirectUris.some((x:string)=>!x||!validRedirect(x)))return registrationError('invalid_redirect_uri','Provide 1-10 secure redirect URIs. HTTPS and loopback HTTP redirects are supported.');

  const tokenMethod=body.token_endpoint_auth_method===undefined?'none':String(body.token_endpoint_auth_method);
  if(tokenMethod!=='none')return registrationError('invalid_client_metadata','ChannelDesk dynamic clients must use token_endpoint_auth_method "none" with PKCE.');

  const grantTypes=body.grant_types===undefined?['authorization_code','refresh_token']:body.grant_types;
  if(!Array.isArray(grantTypes)||grantTypes.length<1||grantTypes.some((x:unknown)=>!['authorization_code','refresh_token'].includes(String(x)))||!grantTypes.includes('authorization_code'))return registrationError('invalid_client_metadata','Supported grant_types are authorization_code and refresh_token.');

  const responseTypes=body.response_types===undefined?['code']:body.response_types;
  if(!Array.isArray(responseTypes)||responseTypes.length!==1||responseTypes[0]!=='code')return registrationError('invalid_client_metadata','Only response_type "code" is supported.');

  const inferredNative=redirectUris.some((uri:string)=>{try{return new URL(uri).protocol==='http:'}catch{return false}});
  const applicationType=body.application_type===undefined?(inferredNative?'native':'web'):String(body.application_type);
  if(!['native','web'].includes(applicationType))return registrationError('invalid_client_metadata','application_type must be "native" or "web".');
  if(applicationType==='web'&&redirectUris.some((uri:string)=>new URL(uri).protocol!=='https:'))return registrationError('invalid_redirect_uri','Web clients must use HTTPS redirect URIs.');

  let scope:string;try{scope=body.scope===undefined?MCP_SCOPES.join(' '):normalizeScope(String(body.scope));}catch{return registrationError('invalid_client_metadata','An unsupported scope was requested.');}
  const clientName=textValue(body.client_name,100)||'MCP Client';
  const clientUri=textValue(body.client_uri,2048),logoUri=textValue(body.logo_uri,2048);
  if(clientUri&&!validHttpsUrl(clientUri))return registrationError('invalid_client_metadata','client_uri must be HTTPS.');
  if(logoUri&&!validHttpsUrl(logoUri))return registrationError('invalid_client_metadata','logo_uri must be HTTPS.');

  const softwareId=textValue(body.software_id,200)||null,softwareVersion=textValue(body.software_version,100)||null;
  const opaque=randomSecret(),clientId=appOrigin()+'/oauth/client/'+opaque;
  const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'unknown';
  const ua=request.headers.get('user-agent')||'unknown';
  const fingerprint=createHash('sha256').update(forwarded+'|'+ua).digest('hex');
  const {data,error}=await admin().rpc('register_mcp_oauth_client',{
   p_client_id:clientId,p_client_name:clientName,p_redirect_uris:redirectUris,p_grant_types:grantTypes,p_response_types:responseTypes,
   p_token_endpoint_auth_method:tokenMethod,p_application_type:applicationType,p_scope:scope,p_client_uri:clientUri||null,p_logo_uri:logoUri||null,
   p_software_id:softwareId,p_software_version:softwareVersion,p_registration_fingerprint:fingerprint
  });
  if(error){if(String(error.message).includes('registration_rate_limited'))return registrationError('invalid_client_metadata','Too many client registrations. Try again later.',429);throw error;}
  const issuedAt=Math.floor(new Date(String(data)).getTime()/1000);
  return json({client_id:clientId,client_id_issued_at:issuedAt,client_name:clientName,redirect_uris:redirectUris,grant_types:grantTypes,response_types:responseTypes,token_endpoint_auth_method:'none',application_type:applicationType,scope,...(clientUri?{client_uri:clientUri}:{}),...(logoUri?{logo_uri:logoUri}:{}),...(softwareId?{software_id:softwareId}:{}),...(softwareVersion?{software_version:softwareVersion}:{})},201);
 }catch(e){logFailure('oauth.register.failed',e);return registrationError('server_error','ChannelDesk could not register this OAuth client.',500);}
}

export async function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});}
