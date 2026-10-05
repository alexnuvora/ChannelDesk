import { CalendarDays, ChartNoAxesCombined, CirclePlay, Sparkles } from "lucide-react";

const networks = ["YouTube","TikTok","Instagram","Facebook","LinkedIn","X","Threads","Bluesky","Pinterest","Google Business"];

export default function Home() {
 return <main className="shell">
  <aside className="sidebar"><div className="brand"><span>CD</span>ChannelDesk</div><nav><b>Overview</b><a>Planner</a><a>Create</a><a>Analytics</a><a>Media</a><a>Connections</a></nav><div className="ai"><Sparkles size={18}/><strong>ChannelDesk AI</strong><small>Research, clip, write and schedule from one conversation.</small></div></aside>
  <section className="content"><header><div><p className="eyebrow">SOCIAL COMMAND CENTRE</p><h1>Good morning.</h1><p>Everything you publish, measure and improve — in one place.</p></div><button>+ Create post</button></header>
  <div className="stats"><article><CalendarDays/><span>Scheduled</span><strong>18</strong><small>Next 7 days</small></article><article><CirclePlay/><span>Published</span><strong>124</strong><small>This month</small></article><article><ChartNoAxesCombined/><span>Reach</span><strong>842K</strong><small>Across channels</small></article><article><Sparkles/><span>AI opportunities</span><strong>7</strong><small>Ready to review</small></article></div>
  <div className="grid"><article className="panel"><div className="panelhead"><div><p className="eyebrow">PLANNER</p><h2>Upcoming content</h2></div><a>Open calendar →</a></div><div className="empty"><CalendarDays size={32}/><b>Your publishing command centre</b><span>Connect channels and ChannelDesk will coordinate drafts, approvals, schedules and publishing.</span></div></article><article className="panel"><p className="eyebrow">CONNECTED NETWORKS</p><h2>Publish everywhere</h2><div className="networks">{networks.map(n=><span key={n}>{n}</span>)}</div><button className="secondary">Connect a channel</button></article></div>
 </section></main>
}
