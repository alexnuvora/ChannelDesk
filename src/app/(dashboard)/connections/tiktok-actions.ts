'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {syncTikTokDisplayData} from '@/lib/tiktok-display';

export async function syncTikTokDisplay(formData:FormData){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');
 const connectionId=String(formData.get('connectionId')||''),workspaceId=String(formData.get('workspaceId')||'');
 try{await syncTikTokDisplayData(connectionId,workspaceId,user.id);redirect('/connections?connected=tiktok');}
 catch(e){redirect('/connections?error='+encodeURIComponent(e instanceof Error?e.message:'tiktok_display_sync_failed'));}
}
