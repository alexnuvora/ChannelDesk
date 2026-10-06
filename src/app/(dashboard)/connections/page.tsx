import { NETWORKS, type Network } from "@/lib/networks";
import { createClient } from "@/lib/supabase/server";
import { GoogleConnectButton } from "./google-connect-button";
import { TikTokConnectButton } from "./tiktok-connect-button";
import { MetaConnectButton } from "./meta-connect-button";
import { LinkedInConnectButton } from "./linkedin-connect-button";
import { XConnectButton } from "./x-connect-button";
import { PinterestConnectButton } from "./pinterest-connect-button";
import { ThreadsConnectButton } from "./threads-connect-button";
import { BlueskyConnectButton } from "./bluesky-connect-button";
import { TwitchConnectButton } from "./twitch-connect-button";
import { GoogleBusinessConnectButton } from "./google-business-connect-button";
import { syncTikTokDisplay } from "./tiktok-actions";
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
  threads_not_configured:"Threads OAuth is not configured on this deployment.",
  threads_oauth_state_invalid:"The Threads connection session expired or could not be verified.",
  threads_token_exchange_failed:"Threads authorization succeeded, but token exchange failed.",
  threads_profile_failed:"ChannelDesk could not load the Threads profile.",
  twitch_not_configured:"Twitch OAuth is not configured on this deployment.",
  twitch_oauth_state_invalid:"The Twitch connection session expired or could not be verified.",
  twitch_token_exchange_failed:"Twitch authorization succeeded, but token exchange failed.",
  twitch_profile_failed:"ChannelDesk could not load the Twitch profile.",
  google_business_not_configured:"Google Business Profile OAuth is not configured on this deployment.",
  google_business_oauth_state_invalid:"The Google Business Profile connection session expired or could not be verified.",
  google_business_token_exchange_failed:"Google authorization succeeded, but token exchange failed.",
  google_business_accounts_failed:"ChannelDesk could not load your Google Business Profile accounts.",
  google_business_locations_failed:"No accessible Google Business Profile locations were found.",
  oauth_failed:"The Google connection failed. Please try again.",
};

export default async function Connections({searchParams}:{searchParams:Promise<{error?:string;connected?:string}>}){
  const params=await searchParams;
  const supabase=await createClient();
  const {data:members}=await supabase.from("workspace_members").select("workspace_id,role,workspaces(name)");
  const workspaces=(members||[]).filter(m=>["owner","admin","editor"].includes(m.role)).map(m=>({workspace_id:m.workspace_id,name:(Array.isArray(m.workspaces)?m.workspaces[0]:m.workspaces)?.name||m.workspace_id}));
  const {data:connections}=await supabase.from("social_connections").select("id,workspace_id,network,display_name,active,scopes").eq("active",true);
  const tiktokConnections=(connections||[]).filter(c=>c.network==="tiktok");
  const tiktokIds=tiktokConnections.map(c=>c.id);
  const [{data:tiktokProfiles},{data:tiktokVideos}]=tiktokIds.length?await Promise.all([
    supabase.from("tiktok_profiles").select("connection_id,workspace_id,username,profile_deep_link,bio_description,is_verified,follower_count,following_count,likes_count,video_count,synced_at").in("connection_id",tiktokIds),
    supabase.from("tiktok_videos").select("connection_id,video_id,title,description,share_url,create_time,like_count,comment_count,share_count,view_count").in("connection_id",tiktokIds).order("create_time",{ascending:false}).limit(12)
  ]):[{data:[]},{data:[]}];
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
          network==="threads" ? <ThreadsConnectButton workspaces={workspaces} label={account?"Reconnect Threads":"Connect Threads"} /> :
          network==="bluesky" ? <BlueskyConnectButton workspaces={workspaces} label={account?"Reconnect Bluesky":"Connect Bluesky"} /> :
          network==="twitch" ? <TwitchConnectButton workspaces={workspaces} label={account?"Reconnect Twitch":"Connect Twitch"} /> :
          network==="google_business" ? <GoogleBusinessConnectButton workspaces={workspaces} label={account?"Reconnect Google Business":"Connect Google Business"} /> :
          account ? <span>Account linked; publishing adapter pending</span> : <button disabled>Coming next</button>}
      </article>
    })}</div>
    {tiktokConnections.length>0 && <section className="panel" style={{marginTop:20}}>
      <div className="panelhead"><div><b>TikTok profile & videos</b><p className="muted">Uses user.info.profile, user.info.stats and video.list so account details and recent public videos can be shown inside ChannelDesk.</p></div></div>
      <div style={{display:"grid",gap:18}}>
        {tiktokConnections.map(account=>{const profile=(tiktokProfiles||[]).find(p=>p.connection_id===account.id);const videos=(tiktokVideos||[]).filter(v=>v.connection_id===account.id);return <article key={account.id} style={{display:"grid",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}>
            <div><b>{account.display_name}</b>{profile?.username&&<p className="muted" style={{margin:"3px 0"}}>@{profile.username}{profile.is_verified?" · Verified":""}</p>}{profile?.bio_description&&<p style={{margin:"6px 0",maxWidth:720}}>{profile.bio_description}</p>}{profile?.profile_deep_link&&<a href={profile.profile_deep_link} target="_blank" rel="noreferrer">Open TikTok profile</a>}</div>
            <form action={syncTikTokDisplay}><input type="hidden" name="connectionId" value={account.id}/><input type="hidden" name="workspaceId" value={account.workspace_id}/><button className="secondary-button">Refresh TikTok data</button></form>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
            <div className="metric-card"><small>Followers</small><b>{Number(profile?.follower_count||0).toLocaleString()}</b></div>
            <div className="metric-card"><small>Following</small><b>{Number(profile?.following_count||0).toLocaleString()}</b></div>
            <div className="metric-card"><small>Likes</small><b>{Number(profile?.likes_count||0).toLocaleString()}</b></div>
            <div className="metric-card"><small>Videos</small><b>{Number(profile?.video_count||0).toLocaleString()}</b></div>
          </div>
          <div><small className="eyebrow">AUTHORIZED SCOPES</small><p className="muted">{(account.scopes||[]).join(" · ")}</p></div>
          <div><b>Recent public TikTok videos</b>{videos.length===0?<p className="muted">No public videos have been synced yet. Reconnect TikTok with video.list approval, then refresh.</p>:<div style={{display:"grid",gap:8,marginTop:8}}>{videos.map(v=><div key={v.video_id} style={{padding:"10px 0",borderTop:"1px solid var(--line)"}}><a href={v.share_url||"#"} target="_blank" rel="noreferrer"><b>{v.title||v.description||"TikTok video"}</b></a><p className="muted" style={{margin:"4px 0 0"}}>{Number(v.view_count||0).toLocaleString()} views · {Number(v.like_count||0).toLocaleString()} likes · {Number(v.comment_count||0).toLocaleString()} comments · {Number(v.share_count||0).toLocaleString()} shares</p></div>)}</div>}</div>
        </article>})}
      </div>
    </section>}
  </>;
}
