'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {assertWorkspaceAccess} from '@/lib/mcp-oauth';
import {smartLinkDestination} from '@/lib/smart-link-url';
const schema=z.object({workspaceId:z.string().uuid(),title:z.string().trim().min(1).max(160),slug:z.string().regex(/^[a-z0-9-]{3,80}$/),description:z.string().trim().max(500),items:z.array(z.object({label:z.string().trim().min(1).max(120),url:z.string().refine(v=>!!smartLinkDestination(v),'Use a complete http or https URL without credentials.')})).min(1).max(20)});
export async function createSmartLink(raw:unknown){
 const parsed=schema.safeParse(raw);if(!parsed.success)return {ok:false as const,error:parsed.error.issues[0]?.message||'Check your page and destination details.'};
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return {ok:false as const,error:'Sign in to continue.'};
 const p=parsed.data;try{await assertWorkspaceAccess(user.id,p.workspaceId,true)}catch{return {ok:false as const,error:'Your role cannot manage this workspace.'}}
 const {error}=await s.rpc('create_smart_link_page',{p_workspace_id:p.workspaceId,p_slug:p.slug,p_title:p.title,p_description:p.description,p_items:p.items.map(item=>({...item,url:smartLinkDestination(item.url)!}))});
 if(error)return {ok:false as const,error:error.code==='23505'?'That address is already in use. Choose another slug.':'This page could not be published. No partial page was saved.'};
 revalidatePath('/smartlinks');return {ok:true as const,slug:p.slug};
}
export async function setSmartLinkActive(form:FormData){
 const id=String(form.get('id')||''),workspaceId=String(form.get('workspaceId')||'');if(!z.string().uuid().safeParse(id).success||!z.string().uuid().safeParse(workspaceId).success)return;
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return;await assertWorkspaceAccess(user.id,workspaceId,true);
 const {error}=await s.rpc('set_smart_link_visibility',{p_id:id,p_active:form.get('active')==='true'});if(error)throw new Error('The page could not be updated.');revalidatePath('/smartlinks');
}
