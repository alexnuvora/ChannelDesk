import { NETWORKS, type Network } from "@/lib/networks";
import { createClient } from "@/lib/supabase/server";
import { GoogleConnectButton } from "./google-connect-button";

const labels: Record<Network,string> = {
  youtube:"YouTube", tiktok:"TikTok", instagram:"Instagram", facebook:"Facebook",
  linkedin:"LinkedIn", x:"X", threads:"Threads", bluesky:"Bluesky",
  pinterest:"Pinterest", google_business:"Google Business Profile",
};
const googleNetworks = new Set<Network>(["youtube","google_business"]);

export default async function Connections(){
  const supabase=await createClient();
  const {data:connections}=await supabase.from("social_connections").select("network,display_name,active").eq("active",true);
  const connected=new Map((connections ?? []).map(c=>[c.network as Network,c.display_name]));
  return <><p className="eyebrow">CONNECTIONS</p><h1>Social channels</h1>
    <p className="muted">Connect the accounts ChannelDesk can publish to and measure.</p>
    <div className="connection-grid">{NETWORKS.map(network=>{
      const account=connected.get(network);
      return <article className="panel connection" key={network}>
        <b>{labels[network]}</b><span>{account ? account : "Not connected"}</span>
        {account ? <button className="secondary" disabled>Connected</button> :
          googleNetworks.has(network) ? <GoogleConnectButton network={network as "youtube"|"google_business"} /> :
          <button disabled>Coming next</button>}
      </article>
    })}</div>
  </>;
}