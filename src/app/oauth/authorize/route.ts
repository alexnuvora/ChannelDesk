import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashSecret, issuer, mcpResource, normalizeScope, randomSecret, validClientId, validRedirect } from "@/lib/mcp-oauth";

function oauthError(redirect:string,state:string|null,error:string,description:string){
 const u=new URL(redirect); u.searchParams.set("error",error); u.searchParams.set("error_description",description); if(state) u.searchParams.set("state",state); u.searchParams.set("iss",issuer()); return NextResponse.redirect(u);
}
export async function GET(request:Request){
 const u=new URL(request.url), q=u.searchParams;
 const clientId=q.get("client_id")??"", redirect=q.get("redirect_uri")??"", state=q.get("state"), resource=q.get("resource")??"", challenge=q.get("code_challenge")??"";
 if(!validClientId(clientId)||!validRedirect(redirect)) return new NextResponse("Invalid OAuth client or redirect URI.",{status:400});
 if(q.get("response_type")!=="code"||q.get("code_challenge_method")!=="S256"||!challenge) return oauthError(redirect,state,"invalid_request","Authorization Code with PKCE S256 is required.");
 if(resource!==mcpResource()) return oauthError(redirect,state,"invalid_target","The requested MCP resource is invalid.");
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user){ const next=u.pathname+u.search; return NextResponse.redirect(new URL("/login?next="+encodeURIComponent(next),u.origin)); }
 const code=randomSecret(), scope=normalizeScope(q.get("scope"));
 const {error}=await supabase.rpc("issue_mcp_oauth_code",{p_code_hash:hashSecret(code),p_client_id:clientId,p_redirect_uri:redirect,p_resource:resource,p_scope:scope,p_code_challenge:challenge,p_expires_at:new Date(Date.now()+5*60_000).toISOString()});
 if(error) return oauthError(redirect,state,"server_error","Could not create authorization code.");
 const out=new URL(redirect); out.searchParams.set("code",code); if(state) out.searchParams.set("state",state); out.searchParams.set("iss",issuer()); return NextResponse.redirect(out);
}
