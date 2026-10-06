import { NETWORKS, type Network } from "@/lib/networks";
import { createClient } from "@/lib/supabase/server";
import { GoogleConnectButton } from "./google-connect-button";
import { TikTokConnectButton } from "./tiktok-connect-button";
import { MetaConnectButton } from "./meta-connect-button";
import { LinkedInConnectButton } from "./linkedin-connect-button";
import { XConnectButton } from "./x-connect-button";
import { PinterestConnectButton } from "./pinterest-connect-button";
import { SocialIcon } from "@/components/social-icon";

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
  youtube_management_scope_missing:"Google did not grant all required YouTube publishing and analytics permissions. Reconnect and approve every requested permission.",
  youtube_authorization_failed:"The YouTube authorization token was rejected. Reconnect the account and approve access.",
  youtube_channel_lookup_failed:"ChannelDesk could not read the selected YouTube channel. Check that YouTube Data API v3 is enabled for this OAuth project.",
  youtube_channel_missing:"No YouTube channel was found for that Google account.",
  tiktok_not_configured:"TikTok OAuth is not configured on this deployment.",
  tiktok_oauth_state_missing:"The TikTok connection session expired. Please try again.",
  tiktok_oauth_state_invalid:"The TikTok connection could not be verified. Please try again.",
  tiktok_authorization_denied:"TikTok authorization was cancelled or denied.",
  tiktok_token_exchange_failed:"TikTok authorization succeeded, but ChannelDesk could not exchange the authorization code.",
  tiktok_basic_scope_missing:"TikTok did not grant the basic profile permission.",
  tiktok_profile_lookup_failed:"ChannelDesk could not read the selected TikTok profile.",
  meta_not_configured:"Meta OAuth is not configured on this deployment.",
  meta_oauth_state_invalid:"The Meta connection session expired or could not be verified.",
  meta_token_exchange_failed:"Meta authorization succeeded, but ChannelDesk could not exchange the authorization code.",
  meta_accounts_failed:"ChannelDesk could not load the Facebook Pages available to this Meta account.",
  linkedin_not_configured:"LinkedIn OAuth is not configured on this deployment.",
  linkedin_oauth_state_invalid:"The LinkedIn connection session expired or could not be verified.",
  linkedin_token_exchange_failed:"LinkedIn authorization succeeded, but token exchange failed.",
  linkedin_profile_failed:"ChannelDesk could not load the LinkedIn member profile.",
  x_not_configured:"X OAuth is not configured on this deployment.",
  x_oauth_state_invalid:"The X connection session expired or could not be verified.",
  x_token_exchange_failed:"X authorization succeeded, but token exchange failed.",
  x_profile_failed:"ChannelDesk could not load the X profile.",
  pinterest_not_configured:"Pinterest OAuth is not configured on this deployment.",
  pinterest_oauth_state_invalid:"The Pinterest connection session expired or could not be verified.",
  pinterest_token_exchange_failed:"Pinterest authorization succeeded, but token exchange failed.",
  pinterest_profile_failed:"ChannelDesk could not load the Pinterest profile.",
  oauth_failed:"The Google connection failed. Please try again.",
};

export default async function Connections({searchParams}:{searchParams:Promise<{error?:string;connected?:string}>}){
  const params=await searchParams;
  const supabase=await createClient();
  const {data:members}=await supabase.from("workspace_members").select("workspace_id,role,workspaces(name)");
  const workspaces=(members||[]).filter(m=>["owner","admin","editor"].includes(m.role)).map(m=>({workspace_id:m.workspace_id,name:(Array.isArray(m.workspaces)?m.workspaces[0]:m.workspaces)?.name||m.workspace_id}));
  const {data:connections}=await supabase.from("social_connections").select("network,display_name,active").eq("active",true);
  const connected=new Map((connections ?? []).map(c=>[c.network as Network,c.display_name]));
  const error=params.error ? (errorMessages[params.error] ?? (params.error.startsWith('tiktok_token_exchange_failed:') ? 'TikTok rejected the configured client credentials. Check the ChannelDesk TikTok Client Key and Client Secret, redeploy, then reconnect.' : params.error)) : null;
  return <><div className="page-title"><div><p className="eyebrow">CONNECTIONS</p><h1>Social channels</h1><p className="muted">One place for the accounts ChannelDesk can publish to and measure.</p></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {params.connected && <p className="notice" role="status">{labels[params.connected as Network] ?? "Account"} connected successfully.</p>}
    <div className="connection-grid">{NETWORKS.map(network=>{
      const account=connected.get(network);
      return <article className="panel connection" key={network}>
        <div className="connection-title"><SocialIcon network={network}/><b>{labels[network]}</b></div><span>{account ? account : "Not connected"}</span>
        {network==="youtube" ? <GoogleConnectButton workspaces={workspaces} label={account?"Reconnect YouTube":"Connect with Google"} /> :
          network==="tiktok" ? <TikTokConnectButton workspaces={workspaces} label={account?"Reconnect TikTok":"Connect TikTok"} /> :
          (network==="facebook"||network==="instagram") ? <MetaConnectButton workspaces={workspaces} label={account?"Reconnect Meta":"Connect Meta"} /> :
          network==="linkedin" ? <LinkedInConnectButton workspaces={workspaces} label={account?"Reconnect LinkedIn":"Connect LinkedIn"} /> :
          network==="x" ? <XConnectButton workspaces={workspaces} label={account?"Reconnect X":"Connect X"} /> :
          network==="pinterest" ? <PinterestConnectButton workspaces={workspaces} label={account?"Reconnect Pinterest":"Connect Pinterest"} /> :
          account ? <span>Account linked; publishing adapter pending</span> : <button disabled>Coming next</button>}
      </article>
    })}</div>
  </>;
}
