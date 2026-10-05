'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {admin,mcpResource} from '@/lib/mcp-oauth';
import {logFailure} from '@/lib/config';
export async function revokeChatGPT(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');let failed=false;try{const {error}=await admin().from('mcp_oauth_tokens').update({revoked_at:new Date().toISOString()}).eq('user_id',user.id).eq('resource',mcpResource()).is('revoked_at',null);if(error)throw error;}catch(e){logFailure('mcp.revoke.failed',e);failed=true;}redirect('/settings?'+(failed?'error=Could+not+revoke+access.+Check+server+configuration.':'message=ChatGPT+access+revoked.+Reconnect+from+ChatGPT+to+grant+access+again.'));}
