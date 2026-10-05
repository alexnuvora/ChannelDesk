import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const scopes={
 youtube:["openid","email","profile","https://www.googleapis.com/auth/youtube.readonly","https://www.googleapis.com/auth/youtube.upload"],
 google_business:["openid","email","profile","https://www.googleapis.com/auth/business.manage"],
} as const;

export async function GET(request:NextRequest){
 const network=request.nextUrl.searchParams.get("network") as keyof typeof scopes | null;
 if(!network || !(network in scopes)) return NextResponse.redirect(new URL("/connections?error=unsupported_provider",request.url));
 const supabase=await createClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub) return NextResponse.redirect(new URL("/login",request.url));
 const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID;
 if(!clientId) return NextResponse.redirect(new URL("/connections?error=google_not_configured",request.url));
 const state=crypto.randomUUID();
 const response=NextResponse.redirect(new URL("https://accounts.google.com/o/oauth2/v2/auth"));
 const redirectUri=new URL("/api/oauth/google/callback",request.nextUrl.origin).toString();
 const authUrl=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 authUrl.searchParams.set("client_id",clientId);
 authUrl.searchParams.set("redirect_uri",redirectUri);
 authUrl.searchParams.set("response_type","code");
 authUrl.searchParams.set("scope",scopes[network].join(" "));
 authUrl.searchParams.set("access_type","offline");
 authUrl.searchParams.set("prompt","consent");
 authUrl.searchParams.set("include_granted_scopes","true");
 authUrl.searchParams.set("state",state);
 response.headers.set("location",authUrl.toString());
 response.cookies.set("cd_google_oauth",JSON.stringify({state,network}),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:600,path:"/"});
 return response;
}
