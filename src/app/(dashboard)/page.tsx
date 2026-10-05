import Link from "next/link";
import {redirect} from "next/navigation";
import {CalendarDays,ChartNoAxesCombined,CirclePlay,Inbox,Sparkles,WandSparkles} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
export default async function Home(){
 const s=await createClient();const {data:claims}=await s.auth.getClaims();if(!claims?.claims?.sub)redirect("/login");
 const {data:memberships}=await s.from("workspace_members").select("workspace_id,role,workspaces(name,slug)").limit(1);const m=memberships?.[0],workspace=Array.isArray(m?.workspaces)?m.workspaces[0]:m?.workspaces;if(!m)return null;
 const [{count:scheduled},{count:published},{count:connections},{count:inbox},{data:upcoming},{data:recent}]=await Promise.all([
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",m.workspace_id).eq("state","scheduled"),
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",m.workspace_id).eq("state","published"),
  s.from("social_connections").select("id",{count:"exact",head:true}).eq("workspace_id",m.workspace_id).eq("active",true),
  s.from("inbox_threads").select("id",{count:"exact",head:true}).eq("workspace_id",m.workspace_id).eq("status","open"),
  s.from("publications").select("id,text,scheduled_for,state").eq("workspace_id",m.workspace_id).eq("state","scheduled").order("scheduled_for",{ascending:true}).limit(4),
  s.from("publications").select("id,text,state,created_at").eq("workspace_id",m.workspace_id).order("created_at",{ascending:false}).limit(5)
 ]);
 return <><header><div><p className="eyebrow">SOCIAL COMMAND CENTRE</p><h1>{workspace?.name??"Your workspace"}</h1><p>Plan, publish, engage and learn from one place.</p></div><Link className="button" href="/create">+ Create post</Link></header>
 <div className="stats"><article><CalendarDays/><span>Scheduled</span><strong>{scheduled??0}</strong><small>In your queue</small></article><article><CirclePlay/><span>Published</span><strong>{published??0}</strong><small>All time</small></article><article><Inbox/><span>Inbox</span><strong>{inbox??0}</strong><small>Open conversations</small></article><article><ChartNoAxesCombined/><span>Channels</span><strong>{connections??0}</strong><small>Connected accounts</small></article></div>
 <section className="quick-actions"><Link href="/create"><WandSparkles/><span><b>Create content</b><small>Publish or schedule</small></span></Link><Link href="/inbox"><Inbox/><span><b>Reply to people</b><small>Unified inbox</small></span></Link><Link href="/analytics"><ChartNoAxesCombined/><span><b>Understand results</b><small>Performance insights</small></span></Link><Link href="/automations"><Sparkles/><span><b>Automate work</b><small>Build smart flows</small></span></Link></section>
 <div className="grid"><article className="panel"><div className="panelhead"><div><p className="eyebrow">NEXT UP</p><h2>Publishing queue</h2></div><Link href="/planner">Open planner →</Link></div>{upcoming?.length?<div className="home-list">{upcoming.map(x=><div key={x.id}><span className="status status-scheduled">scheduled</span><b>{x.text||"Scheduled post"}</b><small>{x.scheduled_for?new Date(x.scheduled_for).toLocaleString("en-GB"):""}</small></div>)}</div>:<div className="empty compact"><CalendarDays size={30}/><b>Your calendar is clear</b><span>Schedule your next post when you&apos;re ready.</span><Link className="button secondary" href="/create">Create content</Link></div>}</article>
 <article className="panel"><div className="panelhead"><div><p className="eyebrow">ACTIVITY</p><h2>Latest content</h2></div></div>{recent?.length?<div className="home-list">{recent.map(x=><div key={x.id}><span className={"status status-"+x.state}>{x.state.replace("_"," ")}</span><b>{x.text||"Social post"}</b><small>{new Date(x.created_at).toLocaleString("en-GB")}</small></div>)}</div>:<div className="empty compact"><b>Nothing published yet</b><span>Your latest work will appear here.</span></div>}</article></div>
 </>;
}