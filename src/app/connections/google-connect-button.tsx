export function GoogleConnectButton({network}:{network:"youtube"|"google_business"}){
 return <a className="google-button google-connect-link" href={`/api/oauth/google/start?network=${encodeURIComponent(network)}`}>
   <span className="google-g">G</span> Connect with Google
 </a>;
}
