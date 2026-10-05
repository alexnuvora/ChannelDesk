import { NETWORKS, type Network } from "@/lib/networks";

const labels: Record<Network,string> = {
  youtube:"YouTube", tiktok:"TikTok", instagram:"Instagram", facebook:"Facebook",
  linkedin:"LinkedIn", x:"X", threads:"Threads", bluesky:"Bluesky",
  pinterest:"Pinterest", google_business:"Google Business Profile",
};

export default function Connections(){
  return <><p className="eyebrow">CONNECTIONS</p><h1>Social channels</h1>
    <p className="muted">Connect the accounts ChannelDesk can publish to and measure.</p>
    <div className="connection-grid">{NETWORKS.map(network=>
      <article className="panel connection" key={network}>
        <b>{labels[network]}</b><span>Not connected</span><button disabled>Connect</button>
      </article>
    )}</div>
  </>;
}