'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Clock3,LoaderCircle} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

type Job={id:string;status:string;result:any;created_at:string};

export default function MediaGenerationStatus({workspaceId}:{workspaceId:string}){
 const [jobs,setJobs]=useState<Job[]>([]),router=useRouter();
 useEffect(()=>{let live=true,lastCompleted='';const supabase=createClient();
  const load=async()=>{const {data}=await supabase.from('ai_generation_jobs').select('id,status,result,created_at').eq('workspace_id',workspaceId).in('status',['queued','generating']).order('created_at',{ascending:true});if(!live)return;setJobs((data||[]) as Job[]);
   const {data:done}=await supabase.from('ai_generation_jobs').select('id,completed_at').eq('workspace_id',workspaceId).eq('status','completed').order('completed_at',{ascending:false}).limit(1).maybeSingle();const latest=done?.id||'';if(lastCompleted&&latest&&latest!==lastCompleted)router.refresh();lastCompleted=latest;
  };load();const timer=setInterval(load,5000);return()=>{live=false;clearInterval(timer)}},[workspaceId,router]);
 const rows=useMemo(()=>jobs.map(j=>({...j,queuePosition:j.status==='queued'?jobs.filter(x=>x.status==='queued'&&x.created_at<=j.created_at).length:null,progress:j.status==='generating'?Math.max(0,Math.min(100,Math.round(Number(j.result?.progress||0)))):0})),[jobs]);
 if(!rows.length)return null;
 return <section className="panel media-generation"><div className="panelhead"><div><b>AI video generation</b><p className="muted">Completed videos are added to this Media Library automatically.</p></div></div><div className="media-generation-list">{rows.map(j=><div key={j.id}>{j.status==='generating'?<LoaderCircle className="spin"/>:<Clock3/>}<span><b>{j.status==='generating'?'Generating · '+j.progress+'%':'Queued · position '+j.queuePosition}</b><small>{j.status==='generating'?'Agnes is creating this video now.':'Waiting for the active generation to finish.'}</small>{j.status==='generating'?<span className="media-generation-progress"><i style={{width:j.progress+'%'}}/></span>:null}</span></div>)}</div></section>
}