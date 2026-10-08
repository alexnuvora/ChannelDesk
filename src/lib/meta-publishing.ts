import {z} from 'zod';
import {admin,assertWorkspaceAccess} from './mcp-oauth';
import {decrypt} from './publishing';

const GRAPH='https://graph.facebook.com/v24.0';
type Network='facebook'|'instagram';
type Connection={id:string;workspace_id:string;network:Network;external_account_id:string;token_ciphertext:string;scopes:string[];active:boolean};
export class MetaDeliveryError extends Error{
 constructor(message:string,readonly uncertain:boolean=false){super(message);this.name='MetaDeliveryError';}
}
const fbInput=z.object({message:z.string().trim().min(1).max(63206),link:z.string().url().optional()}).strict();
const igInput=z.object({caption:z.string().max(2200),imageUrl:z.string().url()}).strict();

async function getConnection(connectionId:string,workspaceId:string,actorId:string,network:Network,scope:string){
 await assertWorkspaceAccess(actorId,workspaceId,true);
 const {data,error}=await admin().from('social_connections').select('id,workspace_id,network,external_account_id,token_ciphertext,scopes,active').eq('id',connectionId).eq('workspace_id',workspaceId).eq('network',network).eq('active',true).maybeSingle();
 if(error||!data)throw new Error('Connect an active '+network+' account in this workspace.');
 const c=data as Connection;
 if(!Array.isArray(c.scopes)||!c.scopes.includes(scope))throw new Error('Reconnect '+network+' and grant '+scope+' before publishing.');
 return c;
}
async function graphPost(path:string,token:string,params:Record<string,string>){
 const body=new URLSearchParams(params);
 let response:Response;
 try{response=await fetch(GRAPH+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store',signal:AbortSignal.timeout(30000),redirect:'error'});}
 catch{throw new MetaDeliveryError('Meta did not confirm delivery. Review the destination before retrying.',true);}
 const data=await response.json().catch(()=>null);
 if(!response.ok){
  const code=typeof data?.error?.code==='number'?data.error.code:response.status;
  throw new MetaDeliveryError('Meta declined the request (code '+code+'). Review the connection and publishing permissions.');
 }
 return data;
}
async function graphGet(path:string,token:string){
 let res:Response;
 try{res=await fetch(GRAPH+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(20000),redirect:'error'});}
 catch{throw new MetaDeliveryError('Meta processing status is unavailable. Do not retry publishing without checking.',true);}
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw new MetaDeliveryError('Could not verify Meta processing status.',true);
 return data;
}
// These primitives are intentionally NOT connected to the scheduler yet.
// The worker must own durable delivery claims, idempotency and review of uncertain writes.
export async function publishFacebookPagePost(raw:z.input<typeof fbInput>,connectionId:string,workspaceId:string,actorId:string){
 const input=fbInput.parse(raw);
 const c=await getConnection(connectionId,workspaceId,actorId,'facebook','pages_manage_posts');
 const data=await graphPost('/'+encodeURIComponent(c.external_account_id)+'/feed',decrypt(c.token_ciphertext),{message:input.message,...(input.link?{link:input.link}:{})});
 if(typeof data?.id!=='string')throw new MetaDeliveryError('Meta accepted the request without a post ID. Check the Page before retrying.',true);
 return {network:'facebook' as const,externalId:data.id,externalUrl:null};
}
export async function publishInstagramImage(raw:z.input<typeof igInput>,connectionId:string,workspaceId:string,actorId:string){
 const input=igInput.parse(raw);
 const media=new URL(input.imageUrl);
 if(media.protocol!=='https:'||media.username||media.password)throw new Error('Instagram needs a public HTTPS image URL.');
 const c=await getConnection(connectionId,workspaceId,actorId,'instagram','instagram_content_publish');
 const token=decrypt(c.token_ciphertext),id=encodeURIComponent(c.external_account_id);
 const container=await graphPost('/'+id+'/media',token,{image_url:input.imageUrl,caption:input.caption});
 if(typeof container?.id!=='string')throw new MetaDeliveryError('Instagram container status is uncertain. Check before retrying.',true);
 const containerId=container.id;
 const status=await graphGet('/'+encodeURIComponent(containerId)+'?fields=status_code,status',token);
 if(status?.status_code!=='FINISHED')return {network:'instagram' as const,containerId,state:'processing' as const,status:String(status?.status_code||'IN_PROGRESS')};
 const published=await graphPost('/'+id+'/media_publish',token,{creation_id:containerId});
 if(typeof published?.id!=='string')throw new MetaDeliveryError('Instagram may have published the post. Check Instagram before retrying.',true);
 return {network:'instagram' as const,containerId,externalId:published.id,state:'published' as const};
}
