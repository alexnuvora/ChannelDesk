import Link from "next/link";
import { Sparkles } from "lucide-react";
import { signOut } from "@/app/auth/actions";

const nav=[["/","Overview"],["/planner","Planner"],["/create","Create"],["/analytics","Analytics"],["/media","Media"],["/connections","Connections"],["/settings","Settings"]];

export function AppShell({children}:{children:React.ReactNode}) {
 return <main className="shell"><aside className="sidebar"><Link href="/" className="brand"><span>CD</span>ChannelDesk</Link>
 <nav>{nav.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
 <div className="ai"><Sparkles size={18}/><strong>ChannelDesk AI</strong><small>Research, create, schedule and learn across every connected channel.</small></div>
 <form action={signOut}><button className="sidebar-action">Sign out</button></form></aside>
 <section className="content">{children}</section></main>;
}
