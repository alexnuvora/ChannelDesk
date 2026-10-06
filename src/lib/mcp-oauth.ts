import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {requireServerDatabaseConfig} from './config';
import {hashSecret,mcpResource,validClientId,CHATGPT_CLIENT_ID,CLAUDE_CLIENT_ID_PATTERN} from './oauth-validation';
export * from './oauth-validation';
export {appOrigin} from './config';
export function admin(){const {url,key}=requireServerDatabaseConfig();return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export const randomSecret=()=>randomBytes(32).toString('base64url');
export async function activeClientId(clientId:string){if(!validClientId(clientId))return false;if(clientId===CHATGPT_CLIENT_ID||/^https:\/\/chatgpt\.com\/oauth\/[A-Za-z0-9_-]+\/client\.json$/.test(clientId)||CLAUDE_CLIENT_ID_PATTERN.test(clientId))return true;const {data,error}=await admin().from('mcp_oauth_clients').select('client_id').eq('client_id',clientId).is('revoked_at',null).maybeSingle();if(error)throw error;return !!data;}
export async function authenticateMcp(request:Request){
 const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return null;
 const raw=auth.slice(7);if(!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
 const {data,error}=await admin().from('mcp_oauth_tokens').select('user_id,resource,scope,expires_at,revoked_at,token_type').eq('token_hash',hashSecret(raw)).eq('token_type','access').maybeSingle();
 if(error)throw error;
 if(!data||data.revoked_at||data.resource!==mcpResource()||Date.parse(data.expires_at)<=Date.now())return null;
 return {userId:data.user_id as string,scopes:String(data.scope).split(/\s+/).filter(Boolean)};
}
export const PUBLISH_ROLES=new Set(['owner','admin','editor']);
export async function assertWorkspaceAccess(userId:string,workspaceId:string,write=false){
 const {data,error}=await admin().from('workspace_members').select('role').eq('workspace_id',workspaceId).eq('user_id',userId).maybeSingle();
 if(error)throw error;
 if(!data||write&&!PUBLISH_ROLES.has(data.role))throw new Error(write?'Your workspace role cannot publish or manage channel connections.':'You do not have access to this ChannelDesk workspace.');
 return data.role as string;
}
