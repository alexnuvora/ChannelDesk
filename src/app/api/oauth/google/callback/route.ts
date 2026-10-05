import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCipheriv, randomBytes } from "crypto";

function encrypt(value:string){
 const key=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "","base64");
 if(key.length!==32) throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
 const iv=randomBytes(12); const cipher=createCipheriv("aes-256-gcm",key,iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return [iv.toString("base64"),cipher.getAuthTag().toString("base64"),encrypted.toString("base64")].join(".");
}

export async function GET(request:NextRequest){
 const base=new URL("/connections",request.nextUrl.origin);
 try{
  const code=request.nextUrl.searchParams.get("code"); const state=request.nextUrl.searchParams.get("state");
  const saved=request.cookies.get("cd_google_oauth")?.value;
  if(!code||!state||!saved) throw new Error("oauth_state_missing");
  const parsed=JSON.parse(saved) as {state:string;network:"youtube"|"google_business"};
  if(parsed.state!==state) throw new Error("oauth_state_invalid");
  const supabase=await createClient(); const {data:claims}=await supabase.auth.getClaims();
  if(!claims?.claims?.sub) return NextResponse.redirect(new URL("/login",request.url));
  const {data:members}=await supabase.from("workspace_members").select("workspace_id,role").limit(1);
  const member=members?.[0]; if(!member) throw new Error("workspace_required");
  const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID; const clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if(!clientId||!clientSecret) throw new Error("google_not_configured");
  const redirectUri=new URL("/api/oauth/google/callback",request.nextUrl.origin).toString();
  const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code"})});
  if(!tokenRes.ok) throw new Error("google_token_exchange_failed");
  const tokens=await tokenRes.json() as {access_token:string;refresh_token?:string;expires_in?:number;scope?:string};
  let externalId="google"; let displayName="Google account";
  if(parsed.network==="youtube"){
    const channelRes=await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",{headers:{authorization:`Bearer ${tokens.access_token}`}});
    if(!channelRes.ok) throw new Error("youtube_channel_lookup_failed");
    const channels=await channelRes.json() as {items?:Array<{id:string;snippet?:{title?:string}}>};
    const channel=channels.items?.[0]; if(!channel) throw new Error("youtube_channel_missing");
    externalId=channel.id; displayName=channel.snippet?.title ?? "YouTube channel";
  } else {
    const infoRes=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{authorization:`Bearer ${tokens.access_token}`}});
    if(infoRes.ok){const info=await infoRes.json() as {sub?:string;name?:string;email?:string};externalId=info.sub ?? "google";displayName=info.name ?? info.email ?? "Google Business account";}
  }
  const expires=tokens.expires_in ? new Date(Date.now()+tokens.expires_in*1000).toISOString() : null;
  const {error}=await supabase.from("social_connections").upsert({workspace_id:member.workspace_id,network:parsed.network,external_account_id:externalId,display_name:displayName,token_ciphertext:encrypt(tokens.access_token),refresh_token_ciphertext:tokens.refresh_token?encrypt(tokens.refresh_token):null,scopes:(tokens.scope??"").split(" ").filter(Boolean),token_expires_at:expires,active:true},{onConflict:"workspace_id,network,external_account_id"});
  if(error) throw error;
  base.searchParams.set("connected",parsed.network);
 }catch(error){base.searchParams.set("error",error instanceof Error?error.message:"oauth_failed");}
 const response=NextResponse.redirect(base); response.cookies.delete("cd_google_oauth"); return response;
}
