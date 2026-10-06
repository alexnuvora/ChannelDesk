import {createHash} from 'node:crypto';
import {appOrigin} from './config';
export const MCP_SCOPES=['channeldesk.read','channeldesk.publish'] as const;
export const CHATGPT_CLIENT_ID='https://chatgpt.com/oauth/client.json';
export const CHATGPT_STABLE_REDIRECT='https://chatgpt.com/connector_platform_oauth_redirect';
export const CLAUDE_CLIENT_ID_PATTERN=/^https:\/\/claude\.ai\/oauth\/[A-Za-z0-9._-]+$/;
export const issuer=appOrigin;
export const mcpResource=()=>appOrigin()+'/mcp';
export const hashSecret=(v:string)=>createHash('sha256').update(v).digest('hex');
export const base64urlSha256=(v:string)=>createHash('sha256').update(v).digest('base64url');
export function validRedirect(uri:string) {
  try { const u=new URL(uri);if(u.username||u.password||u.hash)return false;if(u.protocol==='https:')return true;if(u.protocol==='http:')return ['localhost','127.0.0.1','[::1]'].includes(u.hostname);return false; } catch { return false; }
}
export function validClientId(id:string) { try{if(id===CHATGPT_CLIENT_ID||/^https:\/\/chatgpt\.com\/oauth\/[A-Za-z0-9_-]+\/client\.json$/.test(id)||CLAUDE_CLIENT_ID_PATTERN.test(id))return true;const u=new URL(id),base=new URL(appOrigin());return u.origin===base.origin&&/^\/oauth\/client\/[A-Za-z0-9_-]{43}$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;} }
export function normalizeScope(raw:string|null) {
  if(raw===null||raw.trim()==='')return 'channeldesk.read';
  const scopes=[...new Set(raw.trim().split(/\s+/))];
  if(scopes.some(s=>!(MCP_SCOPES as readonly string[]).includes(s)))throw new Error('Unsupported OAuth scope.');
  return scopes.join(' ');
}
export const validVerifier=(v:string)=>/^[A-Za-z0-9._~-]{43,128}$/.test(v);
export const validChallenge=(v:string)=>/^[A-Za-z0-9_-]{43}$/.test(v);
export class OAuthRequestError extends Error { constructor(public readonly code:string,message:string){super(message);} }
export function validateAuthorization(q:URLSearchParams) {
  for(const key of ['client_id','redirect_uri','response_type','code_challenge','code_challenge_method','scope','resource','state'])if(q.getAll(key).length>1)throw new OAuthRequestError('invalid_request','Duplicate OAuth parameters are not allowed.');
  const clientId=q.get('client_id')||'',redirect=q.get('redirect_uri')||'',resource=q.get('resource')||'',challenge=q.get('code_challenge')||'',state=q.get('state');
  if(!validClientId(clientId)||!validRedirect(redirect))throw new OAuthRequestError('invalid_client','Invalid OAuth client or redirect URI.');
  if(q.get('response_type')!=='code'||q.get('code_challenge_method')!=='S256'||!validChallenge(challenge))throw new OAuthRequestError('invalid_request','Authorization Code with PKCE S256 is required.');
  if(resource!==mcpResource())throw new OAuthRequestError('invalid_target','The requested MCP resource is invalid.');
  if(state&&state.length>2048)throw new OAuthRequestError('invalid_request','OAuth state is too long.');
  let scope:string;try{scope=normalizeScope(q.get('scope'));}catch{throw new OAuthRequestError('invalid_scope','An unsupported scope was requested.');}
  return {clientId,redirect,resource,challenge,state,scope};
}
function redirectAllowed(registered:unknown[],redirect:string) {
  if(registered.includes(redirect))return true;
  try {
    const r=new URL(redirect);
    if(r.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(r.hostname))return false;
    return registered.some(x=>{try{const u=new URL(String(x));return u.protocol==='http:'&&u.hostname===r.hostname&&u.pathname===r.pathname&&!u.port&&!u.search;}catch{return false;}});
  } catch { return false; }
}
export async function verifyClientMetadata(clientId:string,redirect:string,requestedScope?:string) {
  if(!validClientId(clientId)||!validRedirect(redirect))throw new OAuthRequestError('invalid_client','Invalid OAuth client.');
  const response=await fetch(clientId,{redirect:'error',signal:AbortSignal.timeout(10000),next:{revalidate:300}});
  if(!response.ok)throw new OAuthRequestError('invalid_client','Client metadata could not be loaded.');
  const raw=await response.text();if(raw.length>32768)throw new OAuthRequestError('invalid_client','Client metadata is too large.');
  const doc=JSON.parse(raw);
  if(doc.client_id!==clientId||typeof doc.client_name!=='string'||!Array.isArray(doc.redirect_uris)||!redirectAllowed(doc.redirect_uris,redirect))throw new OAuthRequestError('invalid_client','The redirect URI is not registered for this OAuth client.');
  if(requestedScope&&typeof doc.scope==='string'){const allowed=new Set(doc.scope.split(/\s+/).filter(Boolean));if(requestedScope.split(/\s+/).some(s=>!allowed.has(s)))throw new OAuthRequestError('invalid_scope','The OAuth client is not registered for one or more requested scopes.');}
  return {clientName:String(doc.client_name).slice(0,100),scope:typeof doc.scope==='string'?doc.scope:null};
}
