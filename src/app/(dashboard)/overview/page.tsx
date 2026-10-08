import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {ArrowLeft,CalendarDays,BarChart3,Inbox,Plug} from "lucide-react";

export default async function Overview(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)return null;
 const {data:membership}=await s.from("workspace_members").select("workspace_id").eq("user_id",user.id).limit(1).maybeSingle();
 if(!membership)return <div className="empty-state"><b>No workspace found</b><Link href="/connections">Manage connections</Link></div>;
 const id=membership.workspace_id;
 const [scheduled,published,connections,inbox]=await Promise.all([
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("state","scheduled"),
  s.from("publications").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("state","published"),
  s.from("social_connections").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("active",true),
  s.from("inbox_threads").select("id",{count:"exact",head:true}).eq("workspace_id",id).eq("status","open")
 ]);
 return <div className="cd-overview">
  <Link href="/" className="cd-back"><ArrowLeft/> All features</Link>
  <div className="page-title"><div><p className="eyebrow">OVERVIEW</p><h1>Your workspace at a glance</h1><p className="muted">Real activity from your connected ChannelDesk workspace.</p></div><Link href="/planner" className="button"><CalendarDays/> Open planner</Link></div>
  <div className="cd-overview-grid">
   <Link href="/connections"><Plug/><span>Connected channels</span><strong>{connections.count??0}</strong></Link>
   <Link href="/planner"><CalendarDays/><span>Scheduled posts</span><strong>{scheduled.count??0}</strong></Link>
   <Link href="/analytics"><BarChart3/><span>Published posts</span><strong>{published.count??0}</strong></Link>
   <Link href="/inbox"><Inbox/><span>Open conversations</span><strong>{inbox.count??0}</strong></Link>
  </div>
  <div className="cd-overview-next"><h2>What would you like to do next?</h2><p>Start with your content calendar, review performance, or respond to conversations.</p><div><Link href="/create" className="button">Create content</Link><Link href="/analytics" className="button secondary">View performance</Link></div></div>
 </div>;
}
