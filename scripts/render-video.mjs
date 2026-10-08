// Invoked only from GitHub Actions with service-role credentials; runs untrusted
// images through FFmpeg with fixed arguments, strict size/time limits and no shell.
import {createClient} from '@supabase/supabase-js';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Render-worker secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='channeldesk-media',audioBucket='channeldesk-audio',maxImage=30*1024*1024,maxAudio=30*1024*1024,maxOutput=256*1024*1024;
async function ffmpeg(args,timeout=150000){
 await new Promise((resolve,reject)=>{const proc=spawn('ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let err='';proc.stderr.on('data',chunk=>{err=(err+chunk.toString()).slice(-2000)});const timer=setTimeout(()=>proc.kill('SIGKILL'),timeout);proc.on('error',e=>{clearTimeout(timer);reject(e)});proc.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('FFmpeg exited '+code+': '+err))});});
}
async function getAsset(job){
 const {data,error}=await db.from('media_assets').select('id,workspace_id,storage_key,mime_type').eq('id',job.payload.imageId).eq('workspace_id',job.workspace_id).maybeSingle();
 if(error||!data||!['image/png','image/jpeg','image/webp'].includes(data.mime_type)||!data.storage_key.startsWith(job.workspace_id+'/'))throw Error('Source image unavailable.');
 return data;
}
async function download(bucketName,storageKey,limit){
 const {data,error}=await db.storage.from(bucketName).download(storageKey);
 if(error||!data)throw Error('Source file download failed.');
 if(data.size>limit)throw Error('Source file too large.');
 return Buffer.from(await data.arrayBuffer());
}
function captionFilter(text,file){
 // Only use a private caption text file, never interpolate caption into an FFmpeg argument.
 return 'drawbox=x=24:y=1020:w=672:h=200:color=black@0.65:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='+file+':fontcolor=white:fontsize=34:line_spacing=12:x=(w-text_w)/2:y=1060';
}
async function render(job){
 const work=await mkdtemp(join(tmpdir(),'cd-render-'));
 try{
  const source=await getAsset(job),p=job.payload||{},effects=['none','zoom','pan','pulse'];
  if(!effects.includes(p.effect)||!['none','ambient','upload'].includes(p.sound)||typeof p.caption!=='string'||p.caption.length>150)throw Error('Invalid render settings.');
  const img=join(work,'image.'+(source.mime_type==='image/png'?'png':source.mime_type==='image/webp'?'webp':'jpg')),output=join(work,'output.mp4');
  await writeFile(img,await download(bucket,source.storage_key,maxImage));
  let audio=null;
  if(p.sound==='upload'){
   if(typeof p.audioKey!=='string'||!p.audioKey.startsWith(job.workspace_id+'/'+job.created_by+'/')||p.audioKey.includes('..'))throw Error('Untrusted audio path.');
   audio=join(work,'sound.bin');
   await writeFile(audio,await download(audioBucket,p.audioKey,maxAudio));
  }
  const captionFile=join(work,'caption.txt');
  await writeFile(captionFile,p.caption.replace(/[\r\n\t]/g,' ').trim());
  // Source is decoded as an image and re-encoded to standard H.264 + AAC in MP4.
  const effectsMap={
   none:'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
   zoom:'scale=820:1458:force_original_aspect_ratio=increase,crop=820:1458,zoompan=z=min(zoom+0.00022\\,1.12):d=1:s=720x1280:fps=24',
   pan:'scale=820:1458:force_original_aspect_ratio=increase,crop=820:1458,zoompan=z=1.06:x=(iw-iw/zoom)*on/480:y=(ih-ih/zoom)/2:d=1:s=720x1280:fps=24',
   pulse:'scale=820:1458:force_original_aspect_ratio=increase,crop=820:1458,zoompan=z=1.04+0.02*sin(on/28):d=1:s=720x1280:fps=24'
  };
  const vf=effectsMap[p.effect]+(p.caption.trim()?','+captionFilter(p.caption,captionFile):'')+',format=yuv420p';
  const args=['-loop','1','-framerate','24','-i',img];
  if(p.sound==='upload')args.push('-stream_loop','-1','-i',audio);
  else if(p.sound==='ambient')args.push('-f','lavfi','-i','aevalsrc=0.10*sin(2*PI*174.61*t)+0.07*sin(2*PI*220*t)+0.05*sin(2*PI*261.63*t):s=44100');
  else args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100');
  args.push('-vf',vf,'-map','0:v:0','-map','1:a:0','-t','20','-r','24','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',output);
  await ffmpeg(args);
  const bytes=await readFile(output);
  if(bytes.byteLength<2048||bytes.byteLength>maxOutput||bytes.toString('ascii',4,8)!=='ftyp')throw Error('Invalid rendered MP4.');
  const assetId=randomUUID(),storageKey=job.workspace_id+'/'+assetId+'/render-'+job.id+'.mp4';
  const {error:up}=await db.storage.from(bucket).upload(storageKey,bytes,{contentType:'video/mp4',upsert:false});
  if(up)throw up;
  const {error:insert}=await db.from('media_assets').insert({id:assetId,workspace_id:job.workspace_id,storage_key:storageKey,mime_type:'video/mp4',source_url:'ffmpeg://render/'+job.id,rights_basis:'user_uploaded',width:720,height:1280,duration_ms:20000});
  if(insert){await db.storage.from(bucket).remove([storageKey]);throw insert}
  const {error:complete}=await db.from('platform_jobs').update({status:'completed',result:{mediaAssetId:assetId,progress:100,renderer:'ffmpeg'},completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),locked_at:null,locked_by:null,last_error:null}).eq('id',job.id).eq('locked_by',job.locked_by).eq('status','processing');
  if(complete)throw complete;
  console.log('Completed render',job.id,assetId);
 }finally{await rm(work,{force:true,recursive:true});}
}
const workerId='github-render-'+randomUUID();
const {data:jobs,error}=await db.rpc('claim_video_render_jobs',{p_worker:workerId,p_limit:2});
if(error)throw error;
console.log('Claimed jobs',jobs?.length||0);
for(const job of jobs||[]){
 try{await render(job)}
 catch(e){
  const attempts=Number(job.attempts||1),failed=attempts>=3,msg=String(e instanceof Error?e.message:e).slice(0,900);
  console.error('Render failed',job.id,msg);
  await db.from('platform_jobs').update({status:failed?'failed':'retry',last_error:msg,available_at:new Date(Date.now()+Math.min(30*60*1000,attempts*2*60*1000)).toISOString(),updated_at:new Date().toISOString(),locked_at:null,locked_by:null}).eq('id',job.id).eq('locked_by',workerId).eq('status','processing');
 }
}
