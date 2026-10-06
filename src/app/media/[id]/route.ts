import {NextRequest,NextResponse} from 'next/server';
import {admin} from '@/lib/mcp-oauth';
import {createClient} from '@/lib/supabase/server';
import {validMediaSignature,validStorageKey,type StoredMedia} from '@/lib/media-access';
import {logFailure} from '@/lib/config';
export const runtime='nodejs';
export const maxDuration=300;
const privateHeaders={'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
async function handle(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return new NextResponse(null,{status:404,headers:privateHeaders});
  let asset:StoredMedia|null=null;
  if(request.nextUrl.searchParams.has('signature')){
   const {data,error}=await admin().from('media_assets').select('id,workspace_id,storage_key,mime_type').eq('id',id).maybeSingle();
   if(error)throw error;if(data&&validMediaSignature(data,request.nextUrl.searchParams))asset=data;
  }else{
   const s=await createClient();const {data:{user}}=await s.auth.getUser();
   if(user){const {data,error}=await s.from('media_assets').select('id,workspace_id,storage_key,mime_type').eq('id',id).maybeSingle();if(error)throw error;asset=data;}
  }
  if(!asset||!validStorageKey(asset))return new NextResponse(null,{status:404,headers:privateHeaders});
  const {data:signed,error}=await admin().storage.from('channeldesk-media').createSignedUrl(asset.storage_key,120);if(error||!signed)throw new Error('Media unavailable');
  const headers:HeadersInit={};const range=request.headers.get('range');if(range)headers.Range=range;
  const upstream=await fetch(signed.signedUrl,{method:request.method,headers,signal:AbortSignal.timeout(240000),redirect:'error',cache:'no-store'});
  const out=new Headers(privateHeaders);for(const h of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']){const v=upstream.headers.get(h);if(v)out.set(h,v);}
  if(!upstream.ok&&upstream.status!==416)return new NextResponse(null,{status:502,headers:privateHeaders});
  out.set('Content-Type',asset.mime_type);return new NextResponse(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:out});
 }catch(e){logFailure('media.fetch.failed',e);return new NextResponse(null,{status:503,headers:privateHeaders});}
}
export const GET=handle;export const HEAD=handle;
