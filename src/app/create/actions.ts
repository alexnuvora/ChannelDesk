"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createYouTubePublication } from "@/lib/publishing";
export async function submitYouTube(formData:FormData){
 const supabase=await createClient(); const {data:claims}=await supabase.auth.getClaims(); if(!claims?.claims?.sub) redirect("/login");
 const {data:members,error}=await supabase.from("workspace_members").select("workspace_id").limit(1); if(error||!members?.[0]) redirect("/create?error="+encodeURIComponent(error?.message??"Workspace required"));
 const title=String(formData.get("title")??"").trim(),description=String(formData.get("description")??"").trim(),mediaUrl=String(formData.get("mediaUrl")??"").trim(),scheduleLocal=String(formData.get("scheduledFor")??"").trim();
 const privacy=String(formData.get("privacy")??"public") as "private"|"unlisted"|"public",madeForKids=formData.get("madeForKids")==="on";
 if(!title||!mediaUrl) redirect("/create?error="+encodeURIComponent("Title and video URL are required."));
 let scheduledFor:string|undefined;
 if(scheduleLocal){const d=new Date(scheduleLocal);if(!Number.isFinite(d.getTime()))redirect("/create?error="+encodeURIComponent("Invalid schedule time."));scheduledFor=d.toISOString();}
 let result;
 try{result=await createYouTubePublication({title,description,mediaUrl,scheduledFor,privacy,madeForKids},members[0].workspace_id);}
 catch(e){redirect("/create?error="+encodeURIComponent(e instanceof Error?e.message:"YouTube publishing failed."));}
 redirect("/create?success="+encodeURIComponent(result.state==="scheduled"?`Scheduled YouTube video ${result.videoId}`:`YouTube upload accepted: ${result.videoId} (${result.state})`));
}
