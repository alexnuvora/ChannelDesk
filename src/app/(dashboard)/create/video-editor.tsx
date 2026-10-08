'use client';
import {useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

type Asset={id:string;workspace_id:string;mime_type:string;source_url:string|null;storage_key:string;duration_ms:number|null};
type Effect='none'|'zoom'|'pan'|'pulse';
const LENGTH=20,FPS=24,MAX_AUDIO=30*1024*1024,MAX_RENDER=256*1024*1024;
export function VideoEditor({asset,workspaceId,onRendered}:{asset:Asset;workspaceId:string;onRendered:(a:Asset)=>void}){
 const [effect,setEffect]=useState<Effect>('zoom'),[caption,setCaption]=useState(''),[sound,setSound]=useState<'none'|'ambient'|'upload'>('ambient'),[audio,setAudio]=useState<File|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),abort=useRef(false);
 async function render(){
  if(!asset.mime_type.startsWith('image/')){setError('Select an image to convert.');return;}
  if(sound==='upload'&&(!audio||!audio.type.startsWith('audio/')||audio.size>MAX_AUDIO)){setError('Choose an audio file under 30 MB.');return;}
  if(!('MediaRecorder' in window)||!('AudioContext' in window)){setError('Your browser cannot render video. Use a browser with MP4 MediaRecorder support.');return;}
  const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime){setError('This browser cannot export compatible MP4 video. Please use a supported browser or upload a pre-rendered MP4.');return;}
  setBusy(true);setProgress(0);setError('');abort.current=false;
  let imageUrl:string|undefined,ctx:AudioContext|undefined,rec:MediaRecorder|undefined,stream:MediaStream|undefined;
  try{
   // Same-origin private asset access is authorised by the existing ChannelDesk session.
   const response=await fetch('/media/'+asset.id,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw new Error('Could not read image from your Media Library.');
   const imgBlob=await response.blob();if(!imgBlob.type.startsWith('image/'))throw new Error('The source is not an image.');
   imageUrl=URL.createObjectURL(imgBlob);
   const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Image could not be decoded.'));img.src=imageUrl!;});
   if(img.naturalWidth<64||img.naturalHeight<64)throw new Error('The image resolution is too small.');
   const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;const draw=canvas.getContext('2d',{alpha:false});if(!draw)throw new Error('Canvas rendering is unavailable.');
   stream=canvas.captureStream(FPS);ctx=new AudioContext();await ctx.resume();const destination=ctx.createMediaStreamDestination();
   let stopSound:()=>void=()=>{};
   if(sound==='ambient'){
    const nodes:OscillatorNode[]=[];const volumes:GainNode[]=[];
    // An original, synthesized ambient sequence; no third-party copyrighted soundtrack.
    [174.61,220,261.63].forEach((freq,i)=>{const osc=ctx!.createOscillator(),gain=ctx!.createGain();osc.type=i===0?'sine':'triangle';osc.frequency.value=freq;gain.gain.value=0.018;osc.connect(gain).connect(destination);osc.start();nodes.push(osc);volumes.push(gain);});
    stopSound=()=>nodes.forEach(o=>{try{o.stop();}catch{}});
   }else if(sound==='upload'&&audio){
    const buf=await ctx.decodeAudioData(await audio.arrayBuffer()),source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=buf;source.loop=true;gain.gain.value=.7;source.connect(gain).connect(destination);source.start();stopSound=()=>{try{source.stop();}catch{}};
   }else{const osc=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=0;osc.connect(gain).connect(destination);osc.start();stopSound=()=>{try{osc.stop();}catch{}};}
   destination.stream.getAudioTracks().forEach(track=>stream!.addTrack(track));
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000,audioBitsPerSecond:128000});rec=recorder;const chunks:Blob[]=[];
   const completed=new Promise<void>((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);if(chunks.reduce((n,b)=>n+b.size,0)>MAX_RENDER){abort.current=true;recorder.stop();}};recorder.onerror=()=>reject(new Error('Video encoder failed.'));recorder.onstop=()=>resolve();});
   const started=performance.now();let raf=0;
   const paint=()=>{if(abort.current||!draw)return;const t=Math.min(1,(performance.now()-started)/(LENGTH*1000));const cw=canvas.width,ch=canvas.height;
    draw.fillStyle='#08090d';draw.fillRect(0,0,cw,ch);
    const cover=Math.max(cw/img.naturalWidth,ch/img.naturalHeight),scale=effect==='zoom'?1+.10*t:effect==='pulse'?1+.035*Math.sin(t*Math.PI*6):1.05;
    const w=img.naturalWidth*cover*scale,h=img.naturalHeight*cover*scale,offset=effect==='pan'?Math.sin(t*Math.PI*2)*25:0;
    draw.drawImage(img,(cw-w)/2+offset,(ch-h)/2,w,h);
    draw.fillStyle='rgba(0,0,0,.24)';draw.fillRect(0,0,cw,ch);
    if(caption.trim()){draw.fillStyle='rgba(0,0,0,.62)';draw.fillRect(28,ch-285,cw-56,190);draw.font='bold 37px sans-serif';draw.textAlign='center';draw.fillStyle='#fff';const words=caption.trim().split(/\s+/);const lines:string[]=[];let line='';for(const word of words){const next=(line+' '+word).trim();if(draw.measureText(next).width>cw-100&&line){lines.push(line);line=word}else line=next;}if(line)lines.push(line);lines.slice(0,3).forEach((line,i)=>draw.fillText(line,cw/2,ch-210+i*48));}
    setProgress(Math.min(99,Math.round(t*100)));if(t<1)raf=requestAnimationFrame(paint);else recorder.stop();
   };
   recorder.start(1000);raf=requestAnimationFrame(paint);await completed;cancelAnimationFrame(raf);stopSound();
   if(abort.current)throw new Error('Rendering cancelled or output too large.');
   const video=new Blob(chunks,{type:'video/mp4'});if(video.size<1000||video.size>MAX_RENDER)throw new Error('Rendered video is invalid or too large.');
   // Fail closed if the device's MP4 encoder produced a non-MP4 container.
   const header=new Uint8Array(await video.slice(0,24).arrayBuffer());if(String.fromCharCode(...header.slice(4,8))!=='ftyp')throw new Error('The browser encoded an unsupported container, not MP4.');
   const db=createClient(),id=crypto.randomUUID(),key=workspaceId+'/'+id+'/channeldesk-edit-'+id+'.mp4';
   const {error:up}=await db.storage.from('channeldesk-media').upload(key,video,{contentType:'video/mp4',upsert:false,cacheControl:'3600'});if(up)throw up;
   const item={id,workspace_id:workspaceId,storage_key:key,mime_type:'video/mp4',source_url:location.origin+'/media/'+id,rights_basis:'user_uploaded',width:720,height:1280,duration_ms:LENGTH*1000};
   const {error:save}=await db.from('media_assets').insert(item);
   if(save){await db.storage.from('channeldesk-media').remove([key]);throw save;}
   setProgress(100);onRendered({...item}); 
  }catch(e){setError(e instanceof Error?e.message:'Unable to render video.');}
  finally{rec?.stream?.getTracks().forEach(t=>t.stop());stream?.getTracks().forEach(t=>t.stop());await ctx?.close().catch(()=>{});if(imageUrl)URL.revokeObjectURL(imageUrl);setBusy(false);}
 }
 return <div className="panel" style={{padding:16,marginTop:16}}><h3>Convert image to 20-second MP4</h3><p className="muted">Create a 9:16 vertical video with optional music, motion and on-screen caption. Rendering happens on this device, then saves privately to Supabase Storage.</p><div className="auth-form">
 <label>Visual effect<select value={effect} disabled={busy} onChange={e=>setEffect(e.target.value as Effect)}><option value="zoom">Slow zoom</option><option value="pan">Gentle pan</option><option value="pulse">Soft pulse</option><option value="none">Still frame</option></select></label>
 <label>On-screen caption<input value={caption} disabled={busy} onChange={e=>setCaption(e.target.value)} maxLength={150} placeholder="Optional headline (up to 3 lines)"/></label>
 <label>Sound<select value={sound} disabled={busy} onChange={e=>setSound(e.target.value as typeof sound)}><option value="ambient">Original ambient music</option><option value="upload">Upload your own soundtrack</option><option value="none">Silent</option></select></label>
 {sound==='upload'&&<label>Audio file<input type="file" accept="audio/*" disabled={busy} onChange={e=>setAudio(e.target.files?.[0]||null)}/><small>Only use audio you own or are licensed to use. Maximum 30 MB.</small></label>}
 <div className="publish-actions"><button type="button" className="publish-button" disabled={busy} onClick={render}>{busy?'Rendering '+progress+'%':'Render 20-second MP4'}</button>{busy&&<button type="button" className="secondary-button" onClick={()=>{abort.current=true}}>Cancel</button>}</div>
 {busy&&<progress value={progress} max={100} aria-label="Rendering progress" style={{width:'100%'}}/>}{error&&<p className="notice error" role="alert">{error}</p>}</div></div>;
}
