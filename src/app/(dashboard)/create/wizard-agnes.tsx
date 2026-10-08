'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {planAiContent,generateAiVideo,refreshAiVideo} from './ai-actions';
import type {AiConcept} from '@/lib/agnes';
import {createClient} from '@/lib/supabase/client';

type Asset={id:string;workspace_id:string;mime_type:string;source_url:string|null;storage_key:string;duration_ms:number|null};
type VideoJob={id:string;status:string;progress?:number|null;mediaAssetId?:string|null;error?:string|null};
export function WizardAgnes({platform,workspaceId,onCaption,onTitle,onVideo}:{platform:string;workspaceId:string;onCaption:(text:string)=>void;onTitle:(text:string)=>void;onVideo:(asset:Asset)=>void}){
 const [brief,setBrief]=useState(''),[concept,setConcept]=useState<AiConcept|null>(null),[prompt,setPrompt]=useState(''),[quality,setQuality]=useState<'flash'|'quality'>('flash'),[job,setJob]=useState<VideoJob|null>(null),[error,setError]=useState(''),[busy,start]=useTransition();
 const delivered=useRef<string|null>(null);
 const plan=()=>{setError('');start(async()=>{try{const r=await planAiContent(brief,platform);if(!r.ok){setError(r.error);return;}setConcept(r.data);setPrompt(r.data.videoPrompt);setJob(null);}catch(e){setError(e instanceof Error?e.message:'Could not plan content.');}})};
 const generate=()=>{if(!concept)return;setError('');start(async()=>{try{const r=await generateAiVideo({...concept,videoPrompt:prompt},quality);if(!r.ok){setError(r.error);return;}setJob(r.data);delivered.current=null;}catch(e){setError(e instanceof Error?e.message:'Could not start generation.');}})};
 useEffect(()=>{if(!job||!['queued','generating'].includes(job.status))return;let running=true;const id=job.id;
  const tick=async()=>{const r=await refreshAiVideo(id);if(!running)return;if(!r.ok){setError(r.error);return;}setJob(r.data);if(r.data.status==='failed')setError(r.data.error||'Agnes generation failed.');};
  const timer=setInterval(()=>void tick(),5000);void tick();return()=>{running=false;clearInterval(timer);};
 },[job?.id,job?.status]);
 async function selectGeneratedVideo(){
  if(!job?.mediaAssetId||delivered.current===job.mediaAssetId)return;
  setError('');
  const {data,error:lookupError}=await createClient().from('media_assets').select('id,workspace_id,mime_type,source_url,storage_key,duration_ms').eq('id',job.mediaAssetId).eq('workspace_id',workspaceId).maybeSingle();
  if(lookupError||!data||!data.mime_type.startsWith('video/')){setError('The generated video is not available in this workspace yet. Try again shortly.');return;}
  delivered.current=data.id;onVideo(data);
 }
 return <section className="panel" style={{padding:16,marginBottom:20}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><h3>Create with Agnes AI</h3><small className="muted">Agnes 3.0 Flash + Agnes Video 2.5</small></div>
  <p className="muted">Describe your idea once. Agnes drafts the creative, caption and video prompt. Nothing is published without your review.</p>
  <div className="auth-form">
   <label>What are you promoting?<textarea value={brief} onChange={e=>setBrief(e.target.value)} maxLength={3000} rows={3} placeholder="e.g. Introduce our business, explain the main benefit, and invite people to visit our website."/></label>
   <button type="button" className="secondary-button" disabled={busy||brief.trim().length<8} onClick={plan}>{busy?'Preparing ideas…':'Generate ideas & caption'}</button>
   {concept&&<div className="panel" style={{padding:14}}>
    <b>{concept.title}</b><p><strong>Hook:</strong> {concept.hook}</p><p><strong>Call to action:</strong> {concept.cta}</p><details><summary>View script and suggested caption</summary><p style={{whiteSpace:'pre-wrap'}}>{concept.script}</p><p style={{whiteSpace:'pre-wrap'}}>{concept.caption}</p></details>
    <button type="button" className="secondary-button" onClick={()=>{onCaption([concept.caption,...concept.hashtags.map(h=>'#'+h.replace(/^#/,''))].join(' ').slice(0,2200));onTitle(concept.title.slice(0,100));}}>Use suggested caption & title</button>
    <label>Video prompt (editable)<textarea rows={4} maxLength={4000} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>
    <label>Video quality<select value={quality} disabled={!!job&&['queued','generating'].includes(job.status)} onChange={e=>setQuality(e.target.value as 'flash'|'quality')}><option value="flash">Standard (720p, faster)</option><option value="quality">Quality (1080p)</option></select></label>
    <p className="form-hint">Agnes generates clips up to 12 seconds. For a fixed 20-second video from an image, use the FFmpeg converter below.</p>
    <button type="button" className="publish-button" disabled={busy||prompt.trim().length<8||!!job&&['queued','generating'].includes(job.status)} onClick={generate}>{busy?'Starting generation…':'Generate AI video'}</button>
   </div>}
   {job&&<div className="notice" role="status"><b>AI video: {job.status}</b>{typeof job.progress==='number'?' · '+job.progress+'%':''}{job.status==='completed'&&<button type="button" className="button" onClick={()=>void selectGeneratedVideo()}>Use generated video in post</button>}</div>}
   {error&&<p className="notice error" role="alert">{error}</p>}
  </div>
 </section>;
}
