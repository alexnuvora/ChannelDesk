import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {BlockList,isIP} from 'node:net';
import {Readable,Transform} from 'node:stream';
const blocked=new BlockList();
for(const [network,prefix]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(network,prefix,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
for(const [network,prefix]of [['2001:db8::',32],['2001::',32],['2002::',16]] as const)blocked.addSubnet(network,prefix,'ipv6');
export function isPublicAddress(address:string){const family=isIP(address);return family===4?!blocked.check(address,'ipv4'):family===6&&globalV6.check(address,'ipv6')&&!blocked.check(address,'ipv6');}
export function validateMediaUrl(raw:string){
 const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||isIP(u.hostname.replace(/^\[|\]$/g,''))||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||u.hostname==='localhost')throw new Error('Use a public HTTPS video URL without credentials or custom ports.');return u;
}
export const MAX_VIDEO_BYTES=256*1024*1024;
export async function fetchVideo(raw:string,remaining=3):Promise<{body:ReadableStream<Uint8Array>;size:number;type:string;cancel:()=>void}>{
 const url=validateMediaUrl(raw);const addresses=await lookup(url.hostname,{all:true,verbatim:true});if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new Error('The media hostname must resolve only to public internet addresses.');const pinned=addresses[0];
 const res=await new Promise<import('node:http').IncomingMessage>((resolve,reject)=>{
  // Pin the verified DNS answer for the actual connection; disable ambient proxy
  // and redirect handling. TLS still validates the original hostname.
  const req=request(url,{method:'GET',agent:false,headers:{Accept:'video/*','Accept-Encoding':'identity'},lookup:(_host,options,callback)=>{if(options.all)callback(null,[pinned]);else callback(null,pinned.address,pinned.family);}},resolve);
  req.setTimeout(45000,()=>req.destroy(new Error('The media server timed out.')));req.on('error',reject);req.end();
 });
 if(res.statusCode&&[301,302,303,307,308].includes(res.statusCode)){const location=res.headers.location;res.destroy();if(!location||remaining<=0)throw new Error('The media URL redirects too many times.');return fetchVideo(new URL(location,url).href,remaining-1);}
 const size=Number(res.headers['content-length']);const type=(res.headers['content-type']||'').split(';')[0];
 if(res.statusCode!==200||!Number.isSafeInteger(size)||size<1||size>MAX_VIDEO_BYTES||!type.startsWith('video/')||(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity')){res.destroy();throw new Error('The media server must return a video with Content-Length, up to 256 MB, without compression.');}
 let read=0;const limiter=new Transform({transform(chunk,encoding,callback){read+=chunk.length;callback(read>size?new Error('Video exceeded its declared size.'):null,chunk);},flush(callback){callback(read===size?null:new Error('Video size did not match Content-Length.'));}});
 res.on('error',e=>limiter.destroy(e));limiter.on('error',()=>res.destroy());res.pipe(limiter);
 return {body:Readable.toWeb(limiter) as ReadableStream<Uint8Array>,size,type,cancel:()=>{res.destroy();limiter.destroy();}};
}
