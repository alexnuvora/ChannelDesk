import { NETWORKS, type Network } from "@/lib/networks";
import { createClient } from "@/lib/supabase/server";
import { GoogleConnectButton } from "./google-connect-button";

const labels: Record<Network,string> = {
  youtube:"YouTube", tiktok:"TikTok", instagram:"Instagram", facebook:"Facebook",
  linkedin:"LinkedIn", x:"X", threads:"Threads", bluesky:"Bluesky",
  pinterest:"Pinterest", google_business:"Google Business Profile", twitch:"Twitch",
};
const googleNetworks = new Set<Network>(["youtube"]);
const errorMessages: Record<string,string> = {
  unsupported_provider:"That connection provider is not supported.",
  google_not_configured:"Google OAuth is not configured on this deployment.",
  oauth_state_missing:"The Google connection session expired. Please try again.",
  oauth_state_invalid:"The Google connection could not be verified. Please try again.",
  workspace_required:"Create or select a ChannelDesk workspace before connecting YouTube.",
  google_token_exchange_failed:"Google authorization succeeded, but ChannelDesk could not exchange the authorization code.",
  youtube_api_not_enabled:"YouTube Data API v3 is not enabled for the Google Cloud project used by ChannelDesk.",
  youtube_scope_missing:"Google did not grant ChannelDesk the required YouTube permission. Reconnect and approve the YouTube permissions.",
  youtube_authorization_failed:"The YouTube authorization token was rejected. Reconnect the account and approve access.",
  youtube_channel_lookup_failed:"ChannelDesk could not read the selected YouTube channel. Check that YouTube Data API v3 is enabled for this OAuth project.",
  youtube_channel_missing:"No YouTube channel was found for that Google account.",
  oauth_failed:"The Google connection failed. Please try again.",
};

export default async function Connections({searchParams}:{searchParams:Promise<{error?:string;connected?:string}>}){
  const params=await searchParams;
  const supabase=await createClient();
  const {data:members}=await supabase.from("workspace_members").select("workspace_id,role,workspaces(name)");
  const workspaces=(members||[]).filter(m=>["owner","admin","editor"].includes(m.role)).map(m=>({workspace_id:m.workspace_id,name:(Array.isArray(m.workspaces)?m.workspaces[0]:m.workspaces)?.name||m.workspace_id}));
  const {data:connections}=await supabase.from("social_connections").select("network,display_name,active").eq("active",true);
  const connected=new Map((connections ?? []).map(c=>[c.network as Network,c.display_name]));
  const error=params.error ? (errorMessages[params.error] ?? params.error) : null;
  return <><p className="eyebrow">CONNECTIONS</p><h1>Social channels</h1>
    <p className="muted">Connect the accounts ChannelDesk can publish to and measure.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {params.connected && <p className="notice" role="status">{labels[params.connected as Network] ?? "Account"} connected successfully.</p>}
    <div className="connection-grid">{NETWORKS.map(network=>{
      const account=connected.get(network);
      return <article className="panel connection" key={network}>
        <b>{labels[network]}</b><span>{account ? account : "Not connected"}</span>
        {account&&network!=="youtube" ? <span>Account linked; publishing adapter pending</span> :
          googleNetworks.has(network) ? <GoogleConnectButton workspaces={workspaces} label={account?"Reconnect YouTube":"Connect with Google"} /> :
          <button disabled>Coming next</button>}
      </article>
    })}</div>
  </>;
}
