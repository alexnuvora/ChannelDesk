import { createClient } from "@/lib/supabase/server";

export default async function Settings(){
 const supabase=await createClient();
 const {data:members}=await supabase.from("workspace_members").select("workspace_id,role,workspaces(name,slug)").limit(1);
 const member=members?.[0];
 const workspace=Array.isArray(member?.workspaces)?member.workspaces[0]:member?.workspaces;
 return <><p className="eyebrow">SETTINGS</p><h1>Workspace settings</h1>
  <div className="panel"><h2>{workspace?.name ?? "ChannelDesk workspace"}</h2><p className="muted">Team access, approvals and workspace preferences.</p>
   {member && <><p><b>Workspace ID</b></p><code>{member.workspace_id}</code><p className="muted">Pass this workspace ID to ChannelDesk MCP tool calls so the request is scoped to this workspace.</p></>}
  </div>
  <div className="panel"><h2>ChatGPT / MCP</h2><p className="muted">ChannelDesk exposes a remote Streamable HTTP MCP endpoint at <code>/mcp</code>. It requires a server-side bearer token and never exposes your social OAuth tokens.</p>
   <p><b>Tools:</b> list social accounts, calendar, publish YouTube, schedule YouTube, publication status.</p>
  </div>
 </>;
}
