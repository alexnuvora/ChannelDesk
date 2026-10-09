import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {CalendarDays,Inbox,Plug,ArrowUpRight,CheckCircle2,AlertCircle,Plus} from "lucide-react";
export default async function Overview(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return null;
 const {data:membership,error:membershipError}=await s.from("workspace_members").select("workspace_id,workspaces(name)").eq("user_id",user.id).limit(1).maybeSingle();
 if(membershipError)return <p className="notice error" role="alert">Your workspace could not be loaded. Refresh to try again.</p>;
 if(!membership)return <div className="empty-state"><h1>Let’s set up your workspace</h1><p>Sign out and back in to finish creating your workspace, then connect your first account.</p><Link href="/connections">Manage accounts</Link></div>;
 const id=membership.workspace_id;const now=new Date().toISOString();
 const [scheduled,published,connections,inbox,attention,upcoming,drafts,media]=await Promise.all([
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("state","scheduled"),
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("state","published"),
  s.from("social_connections").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("active",true),
  s.from("inbox_threads").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("status","open"),
  s.from("publications").select("id,text,state",{count:"exact"}).eq("workspace_id",id).in("state",["failed","needs_review","pending_approval"]).order("updated_at",{ascending:false}).limit(5),
  s.from("publications").select("id,text,scheduled_for,publication_targets(social_connections(network,display_name))").eq("workspace_id",id).eq("state","scheduled").gte("scheduled_for",now).order("scheduled_for").limit(5),
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",id).in("state",["draft","rejected"]),
  s.from("media_assets").select("id",{count:"exact",head:true}).eq("workspace_id",id)
 ]);
 const workspace=(Array.isArray(membership.workspaces)?membership.workspaces[0]:membership.workspaces)?.name||"Your workspace";
 const number=(r:{error:unknown;count:number|null})=>r.error?"Unavailable":r.count??0;
 const steps=[{title:"Connect your first channel",detail:"Bring your social accounts into one place.",href:"/connections",done:!connections.error&&(connections.count??0)>0},{title:"Add your creative",detail:"Upload an image or video to your media library.",href:"/media",done:!media.error&&(media.count??0)>0},{title:"Plan your first post",detail:"Create content and choose when it goes live.",href:"/create",done:!scheduled.error&&!published.error&&((scheduled.count??0)+(published.count??0))>0}];
 return <div className="cd-overview">
  <div className="page-title"><div><p className="eyebrow">{workspace}</p><h1>A clear view of what’s next.</h1><p className="muted">Plan your content, keep delivery on track, and make room for your next idea.</p></div><Link href="/create" className="button"><Plus size={18}/> Create post</Link></div>
  <div className="cd-overview-grid">{[{href:"/connections",icon:Plug,label:"Connected channels",value:number(connections)},{href:"/planner",icon:CalendarDays,label:"Scheduled posts",value:number(scheduled)},{href:"/planner",icon:AlertCircle,label:"Needs attention",value:number(attention)},{href:"/inbox",icon:Inbox,label:"Open conversations",value:number(inbox)}].map(({href,icon:Icon,label,value})=><Link href={href} key={label}><Icon aria-hidden="true"/><span>{label}</span><strong>{value}</strong></Link>)}</div>
  {!connections.error&&(connections.count??0)===0&&<section className="cd-get-started"><div><p className="eyebrow">YOUR FIRST STEPS</p><h2>From a blank calendar to your first post.</h2><p className="muted">Start with an account. Add your creative when you’re ready.</p></div><ol>{steps.map((step,i)=><li key={step.title}><span className="cd-step-number">{step.done?<CheckCircle2 size={18}/>:i+1}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div><Link href={step.href} aria-label={step.title}><ArrowUpRight size={20}/></Link></li>)}</ol></section>}
  <div className="cd-overview-columns"><section className="panel"><div className="panelhead"><h2>Next in your calendar</h2><Link href="/planner">View calendar →</Link></div>{upcoming.error?<p role="alert">Scheduled content could not be loaded.</p>:upcoming.data?.length?<div className="cd-activity-list">{upcoming.data.map(p=><Link href={"/planner?post="+p.id} key={p.id}><CalendarDays size={20}/><div><strong>{p.text||"Social post"}</strong><small>{p.scheduled_for?new Date(p.scheduled_for).toLocaleString("en-GB",{timeZone:"UTC",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" UTC":"Unscheduled"}</small></div><ArrowUpRight size={16}/></Link>)}</div>:<div className="cd-quiet-empty"><CalendarDays/><h3>Your next post starts here</h3><p>Schedule your content once, then keep an eye on delivery here.</p><Link href="/create" className="button secondary-button">Plan a post</Link></div>}</section>
  <section className="panel"><div className="panelhead"><h2>Needs your attention</h2><span className="status">{number(attention)}</span></div>{attention.error?<p role="alert">Review queue could not be loaded.</p>:attention.data?.length?<div className="cd-activity-list">{attention.data.map(p=><Link href={"/planner?post="+p.id} key={p.id}><AlertCircle size={20}/><div><strong>{p.text||"Social post"}</strong><small>{p.state.replaceAll("_"," ")}</small></div><ArrowUpRight size={16}/></Link>)}</div>:<div className="cd-quiet-empty"><CheckCircle2/><h3>You’re all caught up</h3><p>Posts awaiting approval or a delivery review will appear here.</p></div>}<Link className="cd-overview-drafts" href="/planner?status=draft">{number(drafts)} drafts · Continue an idea →</Link></section></div>
 </div>;
}
