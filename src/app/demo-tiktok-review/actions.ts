'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {admin} from '@/lib/mcp-oauth';

const DEMO_EMAIL='alex.nuvora+channeldesk-demo@gmail.com';
const OWNER_EMAIL='alex.nuvora@gmail.com';
const EXPIRES_AT=Date.parse('2026-10-07T23:59:59Z');

export async function grantTikTokReviewAccess(){
 if(Date.now()>EXPIRES_AT)throw new Error('Demo access window expired.');
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user||user.email?.toLowerCase()!==DEMO_EMAIL)redirect('/login');
 const db=admin();
 const {data:users,error:userError}=await db.auth.admin.listUsers({page:1,perPage:1000});
 if(userError)throw userError;
 const owner=users.users.find(u=>u.email?.toLowerCase()===OWNER_EMAIL);
 if(!owner)throw new Error('ChannelDesk owner account not found.');
 const [{data:owned,error:ownedError},{data:tiktok,error:tiktokError}]=await Promise.all([
  db.from('workspace_members').select('workspace_id').eq('user_id',owner.id).eq('role','owner'),
  db.from('social_connections').select('workspace_id').eq('network','tiktok').eq('active',true)
 ]);
 if(ownedError)throw ownedError;if(tiktokError)throw tiktokError;
 const active=new Set((tiktok||[]).map(x=>x.workspace_id));
 const workspaceId=(owned||[]).map(x=>x.workspace_id).find(id=>active.has(id));
 if(!workspaceId)throw new Error('No owner workspace with an active TikTok connection was found.');
 const {error}=await db.from('workspace_members').upsert({workspace_id:workspaceId,user_id:user.id,role:'editor'},{onConflict:'workspace_id,user_id'});
 if(error)throw error;
 redirect('/connections?connected=tiktok');
}
