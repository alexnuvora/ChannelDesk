import { redirect } from "next/navigation";
import { CalendarDays, ChartNoAxesCombined, CirclePlay, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
 const supabase=await createClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub) redirect("/login");
 const [{data:memberships},{count:scheduled},{count:published},{count:connections}]=await Promise.all([
   supabase.from("workspace_members").select("workspace_id,role,workspaces(name,slug)").limit(1),
   supabase.from("publications").select("*",{count:"exact",head:true}).eq("state","scheduled"),
   supabase.from("publications").select("*",{count:"exact",head:true}).eq("state","published"),
   supabase.from("social_connections").select("*",{count:"exact",head:true}).eq("active",true),
 ]);
 const membership=memberships?.[0];
 const workspace=Array.isArray(membership?.workspaces)?membership.workspaces[0]:membership?.workspaces;
 return <AppShell><header><div><p className="eyebrow">SOCIAL COMMAND CENTRE</p><h1>{workspace?.name ?? "Your workspace"}</h1><p>Everything you publish, measure and improve — in one place.</p></div><a className="button" href="/create">+ Create post</a></header>
 <div className="stats"><article><CalendarDays/><span>Scheduled</span><strong>{scheduled ?? 0}</strong><small>In your queue</small></article><article><CirclePlay/><span>Published</span><strong>{published ?? 0}</strong><small>All time</small></article><article><ChartNoAxesCombined/><span>Connections</span><strong>{connections ?? 0}</strong><small>Active channels</small></article><article><Sparkles/><span>Workspace role</span><strong className="role">{membership?.role ?? "—"}</strong><small>Current access</small></article></div>
 <div className="grid"><article className="panel"><div className="panelhead"><div><p className="eyebrow">PLANNER</p><h2>Upcoming content</h2></div><a href="/planner">Open calendar →</a></div><div className="empty"><CalendarDays size={32}/><b>{scheduled ? "Your queue is ready" : "Nothing scheduled yet"}</b><span>{scheduled ? "Open Planner to review your upcoming publishing queue." : "Create a publication and schedule it to start building your content calendar."}</span></div></article><article className="panel"><p className="eyebrow">CONNECTED NETWORKS</p><h2>Publish everywhere</h2><div className="empty compact"><b>{connections ?? 0} active</b><span>Connect your first social account to start publishing from ChannelDesk.</span><a className="button secondary" href="/connections">Manage connections</a></div></article></div>
 </AppShell>;
}
