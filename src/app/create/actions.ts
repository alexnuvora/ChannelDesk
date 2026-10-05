"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createYouTubePublication } from "@/lib/publishing";

export async function submitYouTube(formData:FormData){
 const supabase=await createClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub) redirect("/login");
 const {data:members,error}=await supabase.from("workspace_members").select("workspace_id").limit(1);
 if(error||!members?.[0]) redirect("/create?error="+encodeURIComponent(error?.message??"Workspace required"));
 const title=String(formData.get("title")??"").trim();
 const description=String(formData.get("description")??"").trim();
 const mediaUrl=String(formData.get("mediaUrl")??"").trim();
 const scheduleLocal=String(formData.get("scheduledFor")??"").trim();
 const privacy=String(formData.get("privacy")??"public") as "private"|"unlisted"|"public";
 const madeForKids=formData.get("madeForKids")==="on";
 if(!title||!mediaUrl) redirect("/create?error="+encodeURIComponent("Title and video URL are required."));
 const scheduledFor=scheduleLocal?new Date(scheduleLocal).toISOString():undefined;
 try{
   const result=await createYouTubePublication({title,description,mediaUrl,scheduledFor,privacy,madeForKids},members[0].workspace_id);
   redirect("/create?success="+encodeURIComponent(result.state==="scheduled"?`Scheduled YouTube video ${result.videoId}`:`Published YouTube video ${result.videoId}`));
 }catch(e){
   redirect("/create?error="+encodeURIComponent(e instanceof Error?e.message:"YouTube publishing failed."));
 }
}
