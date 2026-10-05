import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {admin,assertWorkspaceAccess} from '@/lib/mcp-oauth';
import {appOrigin,logFailure} from '@/lib/config';
import {encrypt} from '@/lib/publishing';
export async function GET(request:NextRequest){
 const base=new URL('/connections',appOrigin());
 try{
  const code=request.nextUrl.searchParams.get('code'),state=request.nextUrl.searchParams.get('state'),saved=request.cookies.get('cd_google_oauth')?.value;if(!code||!state||!saved)throw new Error('oauth_state_missing');
  const parsed=JSON.parse(saved);if(parsed.state!==state||parsed.network!=='youtube'||parsed.redirectUri!==appOrigin()+'/api/oauth/google/callback')throw new Error('oauth_state_invalid');
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user||user.id!==parsed.userId)throw new Error('oauth_state_invalid');await assertWorkspaceAccess(user.id,parsed.workspaceId,true);
  const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET;if(!clientId||!clientSecret)throw new Error('google_not_configured');
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:parsed.redirectUri,grant_type:'authorization_code',code_verifier:parsed.verifier}),signal:AbortSignal.timeout(20000),redirect:'error'});if(!tokenRes.ok)throw new Error('google_token_exchange_failed');const tokens=await tokenRes.json();if(!tokens.access_token)throw new Error('google_token_exchange_failed');
  const channelsRes=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(20000),redirect:'error'});if(!channelsRes.ok){const e=await channelsRes.json().catch(()=>({}));const reason=e.error?.errors?.[0]?.reason;throw new Error(reason==='accessNotConfigured'?'youtube_api_not_enabled':reason==='insufficientPermissions'?'youtube_scope_missing':'youtube_channel_lookup_failed');}
  const grantedScopes=String(tokens.scope||'').split(' ').filter(Boolean);const requiredScopes=['https://www.googleapis.com/auth/youtube.force-ssl'];if(requiredScopes.some(scope=>!grantedScopes.includes(scope)))throw new Error('youtube_management_scope_missing');
  const channels=await channelsRes.json();if(channels.items?.length!==1)throw new Error(channels.items?.length?'Choose one YouTube channel during Google authorisation.':'youtube_channel_missing');const channel=channels.items[0];
  const db=admin();const {data:old,error:oldError}=await db.from('social_connections').select('id,refresh_token_ciphertext').eq('workspace_id',parsed.workspaceId).eq('network','youtube').eq('external_account_id',channel.id).maybeSingle();if(oldError)throw oldError;
  const {error}=await db.from('social_connections').upsert({workspace_id:parsed.workspaceId,network:'youtube',external_account_id:channel.id,display_name:channel.snippet?.title||'YouTube channel',token_ciphertext:encrypt(tokens.access_token),refresh_token_ciphertext:tokens.refresh_token?encrypt(tokens.refresh_token):old?.refresh_token_ciphertext||null,scopes:grantedScopes,token_expires_at:tokens.expires_in?new Date(Date.now()+tokens.expires_in*1000).toISOString():null,active:true},{onConflict:'workspace_id,network,external_account_id'});if(error)throw error;
  const {error:auditError}=await db.from('audit_events').insert({workspace_id:parsed.workspaceId,actor_id:user.id,action:'youtube.connected',entity_type:'social_connection',entity_id:channel.id,metadata:{displayName:channel.snippet?.title}});if(auditError)logFailure('google.oauth.audit_failed',auditError);base.searchParams.set('connected','youtube');
 }catch(e){logFailure('google.oauth.callback_failed',e);base.searchParams.set('error',e instanceof Error?e.message:'oauth_failed');}
 const response=NextResponse.redirect(base,303);response.cookies.set('cd_google_oauth','',{maxAge:0,path:'/api/oauth/google',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});return response;
}
