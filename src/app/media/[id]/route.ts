import {NextRequest,NextResponse} from 'next/server';
import {admin} from '@/lib/mcp-oauth';

const BUCKET='channeldesk-media';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new NextResponse('Not found',{status:404});
 const db=admin();const {data:asset}=await db.from('media_assets').select('storage_key,mime_type').eq('id',id).maybeSingle();if(!asset)return new NextResponse('Not found',{status:404});
 const {data:signed,error}=await db.storage.from(BUCKET).createSignedUrl(asset.storage_key,60);if(error||!signed?.signedUrl)return new NextResponse('Unavailable',{status:503});
 const headers:HeadersInit={};const range=request.headers.get('range');if(range)headers.Range=range;
 const upstream=await fetch(signed.signedUrl,{headers,signal:AbortSignal.timeout(30000),redirect:'error'});if(!upstream.ok&&upstream.status!==206)return new NextResponse('Unavailable',{status:502});
 const out=new Headers();for(const h of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']){const v=upstream.headers.get(h);if(v)out.set(h,v);}out.set('Content-Type',asset.mime_type);out.set('Cache-Control','public, max-age=3600, immutable');out.set('X-Content-Type-Options','nosniff');
 return new NextResponse(upstream.body,{status:upstream.status,headers:out});
}
export async function HEAD(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new NextResponse(null,{status:404});
 const db=admin();const {data:asset}=await db.from('media_assets').select('storage_key,mime_type').eq('id',id).maybeSingle();if(!asset)return new NextResponse(null,{status:404});
 const {data:signed}=await db.storage.from(BUCKET).createSignedUrl(asset.storage_key,60);if(!signed?.signedUrl)return new NextResponse(null,{status:503});
 const upstream=await fetch(signed.signedUrl,{method:'HEAD',signal:AbortSignal.timeout(15000),redirect:'error'});const out=new Headers();for(const h of ['content-type','content-length','accept-ranges','etag']){const v=upstream.headers.get(h);if(v)out.set(h,v);}out.set('Content-Type',asset.mime_type);out.set('Cache-Control','public, max-age=3600, immutable');return new NextResponse(null,{status:upstream.status,headers:out});
}