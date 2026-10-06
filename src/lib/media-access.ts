import {createHmac,timingSafeEqual} from 'node:crypto';
import {appOrigin,ConfigurationError} from './config';
import {admin} from './mcp-oauth';
import {validateMediaUrl} from './media-fetch';

export type StoredMedia={id:string;workspace_id:string;storage_key:string;mime_type:string};
export function validStorageKey(asset:StoredMedia){
 return ['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp'].includes(asset.mime_type)&&asset.storage_key.startsWith(asset.workspace_id+'/')&&!asset.storage_key.split('/').some(p=>p==='..'||p==='.'||!p);
}
function proof(asset:StoredMedia,expires:string){
 const key=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY||'','base64');
 if(key.length!==32)throw new ConfigurationError('TOKEN_ENCRYPTION_KEY');
 return createHmac('sha256',key).update(JSON.stringify(['media-v1',asset.id,asset.workspace_id,asset.storage_key,expires])).digest('base64url');
}
export function signedMediaUrl(asset:StoredMedia,now=Date.now()){
 if(!validStorageKey(asset))throw new Error('Media storage does not belong to this workspace.');
 const expires=String(Math.floor(now/1000)+7200),url=new URL('/media/'+asset.id,appOrigin());
 url.searchParams.set('expires',expires);url.searchParams.set('signature',proof(asset,expires));return url.href;
}
export function validMediaSignature(asset:StoredMedia,query:URLSearchParams,now=Date.now()){
 const expires=query.get('expires')||'',signature=query.get('signature')||'';
 if(!validStorageKey(asset)||!/^\d{10}$/.test(expires)||!Number.isSafeInteger(Number(expires))||Number(expires)<=Math.floor(now/1000)||Number(expires)>Math.floor(now/1000)+7200||!/^[-\w]{43}$/.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature),Buffer.from(proof(asset,expires)));
}
// Authorize stored assets afresh for each delivery. Never persist expiring links.
export async function deliveryMediaUrl(raw:string,workspaceId:string){
 const url=validateMediaUrl(raw),match=/^\/media\/([0-9a-f-]{36})$/i.exec(url.pathname);
 if(url.origin!==appOrigin())return url.href;
 if(!match)throw new Error('Choose a ChannelDesk media asset.');
 const {data,error}=await admin().from('media_assets').select('id,workspace_id,storage_key,mime_type').eq('id',match[1]).eq('workspace_id',workspaceId).maybeSingle();
 if(error||!data||!data.mime_type.startsWith('video/'))throw new Error('The video does not belong to this workspace.');
 return signedMediaUrl(data);
}
