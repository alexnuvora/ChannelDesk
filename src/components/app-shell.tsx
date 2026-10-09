"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import {BarChart3,CalendarDays,FileChartColumn,Home,Image,Inbox,Link2,Plug,Settings,Target,WandSparkles,Workflow,Search,Plus,Menu,X,LogOut,Command} from "lucide-react";
import {signOut} from "@/app/auth/actions";
const sections=[
 {title:"Workspace",links:[["/overview","Overview",Home],["/planner","Content calendar",CalendarDays],["/create","Create content",WandSparkles],["/media","Media library",Image]]},
 {title:"Grow & engage",links:[["/analytics","Analytics",BarChart3],["/reports","Reports",FileChartColumn],["/inbox","Inbox",Inbox],["/competitors","Competitors",Target]]},
 {title:"Tools & settings",links:[["/automations","Automations",Workflow],["/smartlinks","SmartLinks",Link2],["/connections","Connected accounts",Plug],["/settings","Settings",Settings]]},
] as const;
const destinations=sections.flatMap(s=>s.links.map(([href,label,Icon])=>({href,label,Icon,group:s.title})));
export function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname(),[mobile,setMobile]=useState(false),[query,setQuery]=useState("");
 const search=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 const active=(href:string)=>path===href||path.startsWith(href+"/");
 const current=destinations.find(d=>active(d.href));
 const openSearch=()=>{setQuery("");search.current?.showModal();input.current?.focus()};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.current?.showModal();input.current?.focus()}if(e.key==="Escape")setMobile(false)};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[]);
 return <div className="cd-simple-shell cd-workspace-shell">
  <a className="cd-skip-link" href="#main-content">Skip to content</a>
  {mobile&&<button className="cd-nav-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
  <aside className={"cd-workspace-nav"+(mobile?" is-open":"")} aria-label="Workspace navigation">
   <Link href="/overview" className="cd-workspace-brand" onClick={()=>setMobile(false)}><span className="cd-simple-mark">C</span><strong>ChannelDesk</strong></Link>
   <button className="cd-nav-search" onClick={openSearch}><Search size={17}/> Quick search <kbd>⌘ K</kbd></button>
   <Link className="button cd-nav-create" href="/create" onClick={()=>setMobile(false)}><Plus size={18}/> Create post</Link>
   <nav>{sections.map(s=><div className="cd-nav-group" key={s.title}><p>{s.title}</p>{s.links.map(([href,label,Icon])=><Link href={href} key={href} className={active(href)?"active":""} aria-current={active(href)?"page":undefined} onClick={()=>setMobile(false)}><Icon size={18} aria-hidden="true"/>{label}</Link>)}</div>)}</nav>
   <div className="cd-nav-footer"><span>Your social workspace</span><form action={signOut}><button><LogOut size={16}/> Sign out</button></form></div>
  </aside>
  <div className="cd-workspace-body">
   <header className="cd-workspace-topbar"><button className="cd-mobile-toggle" aria-label={mobile?"Close navigation":"Open navigation"} aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button><div><span className="cd-topbar-breadcrumb">Workspace</span><span aria-hidden="true"> / </span><strong>{current?.label||"Overview"}</strong></div><button className="cd-topbar-search" aria-label="Search pages" onClick={openSearch}><Search size={18}/><span>Search</span></button></header>
   <main id="main-content" tabIndex={-1} className="cd-simple-content">{children}</main>
  </div>
  <dialog ref={search} className="cd-command-dialog" aria-label="Find a page" onClick={e=>{if(e.target===e.currentTarget)search.current?.close()}}><div className="cd-command-input"><Search size={20}/><input ref={input} aria-label="Search pages" placeholder="Where would you like to go?" value={query} onChange={e=>setQuery(e.target.value)}/><button aria-label="Close search" onClick={()=>search.current?.close()}><X size={18}/></button></div><nav aria-label="Search results">{destinations.filter(d=>d.label.toLowerCase().includes(query.toLowerCase())).map(({href,label,Icon,group})=><Link key={href} href={href} onClick={()=>{search.current?.close();setMobile(false)}}><Icon size={18}/><span>{label}<small>{group}</small></span><Command size={13}/></Link>)}</nav>{!destinations.some(d=>d.label.toLowerCase().includes(query.toLowerCase()))&&<p className="muted">No pages match. Try “calendar”, “accounts” or “reports”.</p>}<footer>Use Tab to browse · Enter to open · Esc to close</footer></dialog>
 </div>;
}
