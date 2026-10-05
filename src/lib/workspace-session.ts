import type {User} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
export async function ensureWorkspace(supabase:Awaited<ReturnType<typeof createClient>>,user:User){
 const {data:members,error}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).limit(1);if(error)throw error;if(members?.length)return;
 const name=String(user.user_metadata?.full_name??user.user_metadata?.name??user.email?.split('@')[0]??'My').slice(0,80);
 const slug=(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'workspace')+'-'+user.id.replaceAll('-','').slice(0,8);
 const {error:createError}=await supabase.rpc('create_workspace',{workspace_name:`${name}'s Workspace`,workspace_slug:slug});
 if(createError){const retry=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).limit(1);if(retry.error||!retry.data?.length)throw createError;}
}
