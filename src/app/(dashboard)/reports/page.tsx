import {FileChartColumn,Download,CalendarDays} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {reportRange} from '@/lib/report-range';
export default async function Reports({searchParams}:{searchParams:Promise<{days?:string;from?:string;to?:string}>}){
 const params=await searchParams;const filter=new URLSearchParams();for(const key of ['days','from','to'] as const)if(params[key])filter.set(key,params[key]!);
 let range:ReturnType<typeof reportRange>;try{range=reportRange(filter)}catch(e){return <section className="panel"><h1>Choose a report period</h1><p className="notice error" role="alert">{e instanceof Error?e.message:'Invalid dates'}</p><a href="/reports">Reset to last 30 days</a></section>}
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return null;
 const {data:member,error:memberError}=await s.from('workspace_members').select('workspace_id,workspaces(name)').eq('user_id',user.id).limit(1).maybeSingle();
 if(memberError||!member)return <p className="notice error" role="alert">Your workspace could not be loaded.</p>;
 const [snapshots,accounts,saved]=await Promise.all([
 s.from('analytics_snapshots').select('metric_date,connection_id,metrics',{count:'exact'}).eq('workspace_id',member.workspace_id).gte('metric_date',range.from).lte('metric_date',range.to).order('metric_date',{ascending:false}).limit(1000),
 s.from('social_connections').select('id,network,display_name').eq('workspace_id',member.workspace_id),
 s.from('saved_reports').select('id,name,schedule,created_at').eq('workspace_id',member.workspace_id)
 ]);
 const exportParams=new URLSearchParams({from:range.from,to:range.to,workspaceId:member.workspace_id});
 const workspace=(Array.isArray(member.workspaces)?member.workspaces[0]:member.workspaces)?.name||'Your workspace';
 const totals=['views','likes','comments','shares'].map(key=>{let value=0,observations=0;for(const row of snapshots.data||[]){const metrics=row.metrics as Record<string,unknown>|null;const n=metrics?.[key];if(typeof n==='number'&&Number.isFinite(n)){value+=n;observations++}}return {key,value,observations}});
 const partial=(snapshots.count??0)>1000;const lookup=new Map((accounts.data||[]).map(a=>[a.id,a]));
 return <><div className="page-title"><div><p className="eyebrow">PERFORMANCE REPORTS</p><h1>Your results, ready to share.</h1><p className="muted">Measured activity for {workspace}. No estimated or sample metrics.</p></div><a className="button" href={'/api/reports/analytics.csv?'+exportParams}><Download size={17}/> Export CSV</a></div>
 <form className="cd-report-filter" method="get"><label>From<input type="date" name="from" defaultValue={range.from} required/></label><label>To<input type="date" name="to" defaultValue={range.to} max={new Date().toISOString().slice(0,10)} required/></label><button>Update report</button><span className="muted">Up to 90 days · UTC</span></form>
 <nav className="cd-report-presets" aria-label="Report period">{[7,30,90].map(days=><a href={'/reports?days='+days} key={days}>Last {days} days</a>)}</nav>
 {snapshots.error||accounts.error?<p className="notice error" role="alert">Report data could not be loaded. Please try again.</p>:!snapshots.data?.length?<section className="panel cd-quiet-empty"><FileChartColumn/><h2>No measured data for this period</h2><p>Connect a supported account and sync its analytics, or choose another date range.</p><a href="/analytics" className="button secondary-button">Open analytics</a></section>:<>
 <p className="muted">{range.from} – {range.to} · {snapshots.count??snapshots.data.length} daily account snapshots · {new Set(snapshots.data.map(r=>r.connection_id)).size} measured accounts</p>
 {partial&&<p className="notice" role="status">This preview uses the latest 1,000 snapshots. CSV export includes all rows up to the export limit.</p>}
 <div className="stats">{totals.map(t=><article key={t.key}><span>{t.key[0].toUpperCase()+t.key.slice(1)}</span><strong>{t.observations?t.value.toLocaleString('en-GB'):'Unavailable'}</strong><small>{t.observations?'Sum of reported daily metrics':'Not reported by connected accounts'}</small></article>)}</div>
 <section className="panel"><div className="panelhead"><h2>Latest measured activity</h2><CalendarDays size={20}/></div><div className="cd-report-table"><table><caption className="muted">Latest 50 account snapshots. Missing values mean unavailable, not zero.</caption><thead><tr><th>Date (UTC)</th><th>Account</th><th>Views</th><th>Likes</th><th>Comments</th></tr></thead><tbody>{snapshots.data.slice(0,50).map((r,i)=>{const a=lookup.get(r.connection_id),metrics=r.metrics as Record<string,unknown>|null;return <tr key={r.connection_id+r.metric_date+i}><td>{r.metric_date}</td><td>{a?.display_name||a?.network||'Account'}<small>{a?.network}</small></td>{['views','likes','comments'].map(k=><td key={k}>{typeof metrics?.[k]==='number'?Number(metrics[k]).toLocaleString('en-GB'):'—'}</td>)}</tr>})}</tbody></table></div></section></>}
 <section className="settings-section"><h2>Saved report templates</h2>{saved.error?<p role="alert">Templates could not be loaded.</p>:saved.data?.length?saved.data.map(r=><div className="record-row" key={r.id}><FileChartColumn size={18}/><div><strong>{r.name}</strong><small>Created {new Date(r.created_at).toLocaleDateString('en-GB')} · {r.schedule?'Schedule saved; automated delivery is not enabled':'On-demand template'}</small></div></div>):<p className="muted">You can export measured data now. Template editing and scheduled email delivery are not enabled yet.</p>}</section></>;
}
