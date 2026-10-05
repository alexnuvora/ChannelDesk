import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function slugBase(value:string){
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40) || "workspace";
}

async function ensureWorkspace(supabase:Awaited<ReturnType<typeof createClient>>){
  const {data:members,error:memberError}=await supabase.from("workspace_members").select("workspace_id").limit(1);
  if(memberError) throw memberError;
  if(members?.length) return;

  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError || !user) throw userError ?? new Error("Authenticated user could not be loaded.");
  const displayName=String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "My");
  const workspaceName=`${displayName}'s Workspace`;
  const base=slugBase(displayName);
  const suffix=user.id.replace(/-/g,"").slice(0,8);
  const {error:createError}=await supabase.rpc("create_workspace",{
    workspace_name:workspaceName,
    workspace_slug:`${base}-${suffix}`,
  });
  if(createError) throw createError;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  if (code) {
    const supabase = await createClient();
    const flowId = url.searchParams.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (!error) {
      try {
        await ensureWorkspace(supabase);
      } catch (workspaceError) {
        const message=workspaceError instanceof Error ? workspaceError.message : "Workspace setup failed.";
        return NextResponse.redirect(`${url.origin}/login?error=${encodeURIComponent(message)}`);
      }
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
      if (process.env.NODE_ENV !== "development" && forwardedHost) return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${next}`);
      return NextResponse.redirect(`${url.origin}${next}`);
    }
    return NextResponse.redirect(`${url.origin}/login?error=${encodeURIComponent(error.message)}`);
  }
  return NextResponse.redirect(`${url.origin}/login?error=${encodeURIComponent("Google sign-in did not return an authorization code.")}`);
}
