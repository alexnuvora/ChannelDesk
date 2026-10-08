"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {ArrowLeft,BarChart3,CalendarDays,FileChartColumn,Home,Image,Inbox,Link2,Plug,Settings,Target,WandSparkles,Workflow} from "lucide-react";
import {signOut} from "@/app/auth/actions";

const sections=[
 {title:"Overview",root:"/overview",icon:Home,tabs:[["/overview","Overview",Home]]},
 {title:"Plan & Create",root:"/planner",icon:CalendarDays,tabs:[["/planner","Calendar",CalendarDays],["/create","Create content",WandSparkles],["/media","Media library",Image]]},
 {title:"Performance",root:"/analytics",icon:BarChart3,tabs:[["/analytics","Analytics",BarChart3],["/reports","Reports",FileChartColumn],["/competitors","Competitors",Target]]},
 {title:"Engage",root:"/inbox",icon:Inbox,tabs:[["/inbox","Inbox",Inbox]]},
 {title:"Automate",root:"/automations",icon:Workflow,tabs:[["/automations","Flows",Workflow],["/smartlinks","SmartLinks",Link2]]},
 {title:"Manage",root:"/connections",icon:Settings,tabs:[["/connections","Accounts",Plug],["/settings","Settings",Settings]]},
] as const;
export function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname();
 const active=(href:string)=>path===href||path.startsWith(href+"/");
 const section=sections.find(s=>s.tabs.some(t=>active(t[0])))??sections[0];
 if(path==="/")return <main className="cd-root-hub">{children}</main>;
 return <main className="cd-simple-shell">
  <header className="cd-simple-header">
   <Link href="/" className="cd-simple-home" aria-label="Back to ChannelDesk home"><ArrowLeft aria-hidden="true"/><span>Home</span></Link>
   <div className="cd-simple-brand"><span className="cd-simple-mark">C</span><strong>ChannelDesk</strong><span className="cd-simple-divider" aria-hidden="true"/> <span className="cd-simple-section">{section.title}</span></div>
   <form action={signOut}><button type="submit" className="cd-simple-signout">Sign out</button></form>
  </header>
  <nav className="cd-section-tabs" aria-label={section.title+" navigation"}>{section.tabs.map(([href,label,Icon])=><Link key={href} href={href} className={active(href)?"active":""} aria-current={active(href)?"page":undefined}><Icon aria-hidden="true"/>{label}</Link>)}</nav>
  <section id="main-content" className="cd-simple-content">{children}</section>
 </main>;
}
