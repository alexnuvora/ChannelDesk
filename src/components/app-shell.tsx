"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {BarChart3,Bot,CalendarDays,ChevronLeft,ChevronRight,FileChartColumn,Home,Image,Inbox,Link2,Menu,Plug,Settings,Target,WandSparkles,Workflow,X} from "lucide-react";
import {signOut} from "@/app/auth/actions";

const groups=[
 {href:"/",label:"Overview",icon:Home,children:[]},
 {href:"/planner",label:"Plan & Create",icon:CalendarDays,children:[["/create","Create content",WandSparkles],["/media","Media library",Image]]},
 {href:"/analytics",label:"Performance",icon:BarChart3,children:[["/reports","Reports",FileChartColumn],["/competitors","Competitors",Target]]},
 {href:"/inbox",label:"Engage",icon:Inbox,children:[]},
 {href:"/automations",label:"Automate",icon:Workflow,children:[["/smartlinks","SmartLinks",Link2]]},
 {href:"/connections",label:"Manage",icon:Settings,children:[["/settings","Settings",Settings]]}
] as const;
export function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname();
 const [collapsed,setCollapsed]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{setCollapsed(localStorage.getItem("cd-sidebar-collapsed")==="1")},[]);
 useEffect(()=>{setMobileOpen(false)},[path]);
 const toggle=()=>setCollapsed(v=>{const n=!v;localStorage.setItem("cd-sidebar-collapsed",n?"1":"0");return n});
 const active=(href:string)=>href==="/"?path==="/":path===href||path.startsWith(href+"/");
 const renderGroups=(mobile=false)=>groups.map(group=>{
  const Icon=group.icon;
  const selected=active(group.href)||group.children.some(child=>active(child[0]));
  return <div className="nav-group" key={group.href}>
   <Link href={group.href} className={"nav-primary"+(selected?" active":"")} aria-current={active(group.href)?"page":undefined} title={group.label}><Icon aria-hidden="true"/><span>{group.label}</span></Link>
   {!collapsed||mobile?<div className="nav-children">{group.children.map(([href,label,ChildIcon])=><Link key={href} href={href} className={active(href)?"active":""} aria-current={active(href)?"page":undefined}><ChildIcon aria-hidden="true"/><span>{label}</span></Link>)}</div>:null}
  </div>
 });
 return <main className={"shell cd-shell"+(collapsed?" sidebar-collapsed":"")}>
  <aside className="sidebar cd-sidebar"><div className="sidebar-head"><Link href="/" className="brand"><span className="brand-mark">C</span><strong>ChannelDesk</strong></Link><button type="button" className="sidebar-toggle" onClick={toggle} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"}>{collapsed?<ChevronRight/>:<ChevronLeft/>}</button><small>Everything social. One desk.</small></div>
   <nav aria-label="Main navigation" className="cd-navigation">{renderGroups()}</nav>
   <div className="sidebar-bottom"><Link href="/create" className="ai"><Bot aria-hidden="true"/><span><strong>AI Assistant</strong><small>Create smarter content</small></span></Link><form action={signOut}><button type="submit" className="sidebar-action">Sign out</button></form></div>
  </aside>
  <div className="workspace"><div className="topbar cd-topbar"><div className="cd-topbar-title">Your workspace <span>· Plan, publish and grow</span></div><div className="cd-topbar-actions"><Link href="/connections" className="cd-topbar-link"><Plug/> Accounts</Link><Link href="/create" className="button"><WandSparkles/> Create post</Link></div></div>
   <div className="mobile-topbar"><button type="button" className="icon-button cd-mobile-toggle" onClick={()=>setMobileOpen(v=>!v)} aria-label={mobileOpen?"Close navigation":"Open navigation"} aria-expanded={mobileOpen} aria-controls="cd-mobile-menu">{mobileOpen?<X/>:<Menu/>}</button><Link href="/" className="brand"><span className="brand-mark">C</span><strong>ChannelDesk</strong></Link><Link className="mobile-create" href="/create"><WandSparkles/>Create</Link></div>
   {mobileOpen?<><button className="cd-mobile-backdrop" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/><nav id="cd-mobile-menu" aria-label="Mobile navigation" className="cd-mobile-menu">{renderGroups(true)}<form action={signOut}><button type="submit" className="sidebar-action">Sign out</button></form></nav></>:null}
   <section className="content" id="main-content">{children}</section>
  </div>
 </main>;
}
