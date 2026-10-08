import Link from "next/link";
import {redirect} from "next/navigation";
import {BarChart3,CalendarDays,LayoutGrid,Layers3,MessagesSquare,Settings2,Workflow,ArrowUpRight} from "lucide-react";
import {createClient} from "@/lib/supabase/server";

const sections=[
 {href:"/",title:"Overview",description:"Everything important today",Icon:LayoutGrid},
 {href:"/planner",title:"Plan & Create",description:"Content, AI and calendar",Icon:CalendarDays},
 {href:"/analytics",title:"Performance",description:"Analytics and reports",Icon:BarChart3},
 {href:"/inbox",title:"Engage",description:"Inbox and conversations",Icon:MessagesSquare},
 {href:"/automations",title:"Automate",description:"Flows and recurring content",Icon:Workflow},
 {href:"/connections",title:"Manage",description:"Accounts, brands and team",Icon:Settings2},
] as const;

export default async function Home(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 return <div className="cd-hub">
   <div className="cd-hub-panel">
     <header className="cd-hub-heading">
       <div className="cd-hub-brand"><span className="cd-hub-logo"><Layers3 aria-hidden="true"/></span><div><h1>ChannelDesk</h1><p>Everything social. One place.</p></div></div>
       <span className="cd-hub-label">Your workspace</span>
     </header>
     <nav className="cd-hub-grid" aria-label="ChannelDesk features">
       {sections.map(({href,title,description,Icon})=><Link href={href==="/"?"/overview":href} key={title} className="cd-hub-tile">
         <Icon className="cd-hub-icon" aria-hidden="true"/>
         <span className="cd-hub-copy"><strong>{title}</strong><span>{description}</span></span>
         <ArrowUpRight className="cd-hub-arrow" aria-hidden="true"/>
       </Link>)}
     </nav>
   </div>
 </div>;
}
