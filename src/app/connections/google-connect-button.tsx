"use client";

import { useState } from "react";

export function GoogleConnectButton({network}:{network:"youtube"|"google_business"}){
 const [busy,setBusy]=useState(false);
 return <button className="google-button" disabled={busy} onClick={()=>{
   setBusy(true);
   window.location.assign(`/api/oauth/google/start?network=${network}`);
 }}>{busy ? "Opening Google…" : <><span className="google-g">G</span> Connect with Google</>}</button>;
}
