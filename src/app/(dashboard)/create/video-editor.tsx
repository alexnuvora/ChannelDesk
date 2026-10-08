'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {queueVideoRender} from './render-actions';

type Asset={id:string;workspace_id:string;mime_type:string;source_url:string|null;storage_key:string;duration_ms:number|null};
type Effect='none'|'zoom'|'pan'|'pulse';
const audioMimes=['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm'];
export function VideoEditor({asset,workspaceId,onRendered}:{asset:Asset;workspaceId:string;onRendered:(a:Asset)=>void}){
 const [effect,setEffect]=useState<Effect>('zoom'),[caption,setCaption]=useState(''),[sound,setSound]=useState<'none'|'ambient'|'upload'>('ambient');
 const [audio,setAudio]=useState<File|null>(null),[busy,setBusy]=useState(false),[jobId,setJobId]=useState<string|null>(null),[state,setState]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  if(!jobId)return;
  const db=createClient();let disposed=false;
  async function check(){
   const {data,error}=await db.from('platform_jobs').select('status,last_error,result').eq('id',jobId).eq('workspace_id',workspaceId).maybeSingle();
   if(disposed)return;
   if(error){setError('Unable to read render status.');return;}
   if(!data)return;
   setState(data.status);
   if(data.status==='completed'){
    const mediaId=data.result?.mediaAssetId;
    if(typeof mediaId!=='string'){setError('Render completed without an output.');return;}
    const {data:media, error:mediaError}=await db.from('media_assets').select('id,workspace_id,mime_type,source_url,storage_key,duration_ms').eq('id',mediaId).eq('workspace_id',workspaceId).maybeSingle();
    if(!disposed&&media&&!mediaError){onRendered(media);setBusy(false);setJobId(null);}
   }else if(data.status==='failed'||data.status==='cancelled'){setError(data.last_error||'Rendering failed.');setBusy(false);setJobId(null);}
  }
  void check();
  const timer=setInterval(()=>void check(),4000);
  return()=>{disposed=true;clearInterval(timer);};
 },[jobId,workspaceId,onRendered]);
 async function render(){
  setError('');setState('uploading');setBusy(true);
  try{
   if(!asset.mime_type.startsWith('image/'))throw new Error('Select an image.');
   const db=createClient();
   let audioKey: string|undefined;
   if(sound==='upload'){
    if(!audio||!audioMimes.includes(audio.type)||audio.size>30*1024*1024)throw new Error('Use MP3, MP4 audio, WAV, OGG or WebM audio under 30 MB.');
    const {data:{user}}=await db.auth.getUser();
    if(!user)throw new Error('You must be signed in.');
    const extension=({ 'audio/mpeg':'mp3','audio/mp4':'m4a','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/webm':'webm' } as Record<string,string>)[audio.type];
    audioKey=workspaceId+'/'+user.id+'/'+crypto.randomUUID()+'.'+extension;
    const {error}=await db.storage.from('channeldesk-audio').upload(audioKey,audio,{contentType:audio.type,upsert:false});
    if(error)throw error;
   }
   const job=await queueVideoRender({workspaceId,imageId:asset.id,effect,caption,sound,audioKey});
   setJobId(job.jobId);setState('queued');
  }catch(e){setError(e instanceof Error?e.message:'Unable to queue rendering.');setBusy(false);}
 }
 return <div className="panel" style={{padding:16,marginTop:16}}>
  <h3>Convert image to 20-second MP4</h3>
  <p className="muted">Server-rendered vertical video (720 × 1280, H.264/AAC). You can leave this page while FFmpeg processes your file. Rendering jobs are checked automatically.</p>
  <div className="auth-form">
   <label>Motion effect<select value={effect} disabled={busy} onChange={e=>setEffect(e.target.value as Effect)}><option value="zoom">Slow zoom</option><option value="pan">Gentle pan</option><option value="pulse">Soft pulse</option><option value="none">Still frame</option></select></label>
   <label>On-screen caption<input value={caption} disabled={busy} onChange={e=>setCaption(e.target.value)} maxLength={150} placeholder="Optional headline"/></label>
   <label>Soundtrack<select value={sound} disabled={busy} onChange={e=>setSound(e.target.value as typeof sound)}><option value="ambient">Original synthesized ambient audio</option><option value="upload">Upload my own licensed audio</option><option value="none">No sound</option></select></label>
   {sound==='upload'&&<label>Sound file<input type="file" accept=".mp3,.m4a,.wav,.ogg,.webm,audio/*" disabled={busy} onChange={e=>setAudio(e.target.files?.[0]||null)}/><small>Max 30 MB. Confirm you have rights to use this audio.</small></label>}
   <div className="publish-actions"><button type="button" className="publish-button" disabled={busy} onClick={render}>{busy?'Rendering: '+state:'Create 20-second video'}</button></div>
   {jobId&&<p className="notice" role="status">Render job {jobId}: {state}. Processing typically starts at the next scheduled worker run. You can return later; outputs will appear in Media Library.</p>}
   {error&&<p className="notice error" role="alert">{error}</p>}
  </div>
 </div>;
}
