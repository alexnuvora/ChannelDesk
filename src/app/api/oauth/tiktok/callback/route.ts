import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {admin,assertWorkspaceAccess} from '@/lib/mcp-oauth';
import {appOrigin,logFailure} from '@/lib/config';
import {encrypt} from '@/lib/publishing';

export async function GET(request:NextRequest){
 const base=new URL('/connections',appOrigin());
 try{
  const code=request.nextUrl.searchParams.get('code'),state=request.nextUrl.searchParams.get('state'),providerError=request.nextUrl.searchParams.get('error'),saved=request.cookies.get('cd_tiktok_oauth')?.value;
  if(providerError)throw new Error('tiktok_authorization_denied');
  if(!code||!state||!saved)throw new Error('tiktok_oauth_state_missing');
  const parsed=JSON.parse(saved);if(parsed.state!==state||parsed.redirectUri!==appOrigin()+'/api/oauth/tiktok/callback')throw new Error('tiktok_oauth_state_invalid');
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user||user.id!==parsed.userId)throw new Error('tiktok_oauth_state_invalid');await assertWorkspaceAccess(user.id,parsed.workspaceId,true);
  const clientKey=process.env.TIKTOK_CLIENT_KEY,clientSecret=process.env.TIKTOK_CLIENT_SECRET;if(!clientKey||!clientSecret)throw new Error('tiktok_not_configured');
  const tokenRes=await fetch('https://open.tiktokapis.com/v2/oauth/token/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_key:clientKey,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:parsed.redirectUri}),signal:AbortSignal.timeout(20000),redirect:'error'});
  const tokens=await tokenRes.json().catch(()=>null);
  if(!tokenRes.ok||!tokens?.access_token||!tokens?.open_id){
   const providerError=typeof tokens?.error==='string'?tokens.error:'unknown_error';
   const providerDescription=typeof tokens?.error_description==='string'?tokens.error_description:'TikTok did not return valid account tokens.';
   const providerLogId=typeof tokens?.log_id==='string'?tokens.log_id:'';
   console.error(JSON.stringify({event:'tiktok.oauth.token_exchange_failed',status:tokenRes.status,providerError,providerLogId}));
   const safeDescription=providerDescription.replace(/[\r\n]/g,' ').slice(0,240);
   throw new Error('tiktok_token_exchange_failed:'+providerError+':'+safeDescription+(providerLogId?':log_'+providerLogId:''));
  }
  const granted=String(tokens.scope||'').split(',').map((s:string)=>s.trim()).filter(Boolean);if(!granted.includes('user.info.basic'))throw new Error('tiktok_basic_scope_missing');
  const fields='open_id,union_id,avatar_url,display_name';const userRes=await fetch('https://open.tiktokapis.com/v2/user/info/?fields='+encodeURIComponent(fields),{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(20000),redirect:'error'});const info=await userRes.json().catch(()=>null);if(!userRes.ok||info?.error?.code!=='ok')throw new Error('tiktok_profile_lookup_failed');
  const profile=info?.data?.user||{};const db=admin();const {data:old}=await db.from('social_connections').select('id,refresh_token_ciphertext').eq('workspace_id',parsed.workspaceId).eq('network','tiktok').eq('external_account_id',tokens.open_id).maybeSingle();
  const {error}=await db.from('social_connections').upsert({workspace_id:parsed.workspaceId,network:'tiktok',external_account_id:tokens.open_id,display_name:profile.display_name||profile.username||'TikTok account',token_ciphertext:encrypt(tokens.access_token),refresh_token_ciphertext:tokens.refresh_token?encrypt(tokens.refresh_token):old?.refresh_token_ciphertext||null,scopes:granted,token_expires_at:tokens.expires_in?new Date(Date.now()+tokens.expires_in*1000).toISOString():null,active:true},{onConflict:'workspace_id,network,external_account_id'});if(error)throw error;
  await db.from('audit_events').insert({workspace_id:parsed.workspaceId,actor_id:user.id,action:'tiktok.connected',entity_type:'social_connection',entity_id:tokens.open_id,metadata:{displayName:profile.display_name||profile.username,scopes:granted}});
  base.searchParams.set('connected','tiktok');
 }catch(e){logFailure('tiktok.oauth.callback_failed',e);base.searchParams.set('error',e instanceof Error?e.message:'tiktok_oauth_failed');}
 const response=NextResponse.redirect(base,303);response.cookies.set('cd_tiktok_oauth','',{maxAge:0,path:'/api/oauth/tiktok',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});return response;
}