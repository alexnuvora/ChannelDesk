import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {appOrigin,logFailure} from '@/lib/config';
import {assertWorkspaceAccess,randomSecret} from '@/lib/mcp-oauth';

// TikTok review scope set: identity/profile/stats, public video display, draft upload and Direct Post.
const SCOPES=['user.info.basic','user.info.profile','user.info.stats','video.list','video.upload','video.publish'];

export async function GET(request:NextRequest){
 try{
  const workspaceId=request.nextUrl.searchParams.get('workspaceId')||'';
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.redirect(new URL('/login',appOrigin()));
  await assertWorkspaceAccess(user.id,workspaceId,true);
  const clientKey=process.env.TIKTOK_CLIENT_KEY,clientSecret=process.env.TIKTOK_CLIENT_SECRET;
  if(!clientKey||!clientSecret)throw new Error('tiktok_not_configured');
  const state=randomSecret();const redirectUri=appOrigin()+'/api/oauth/tiktok/callback';
  const u=new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.searchParams.set('client_key',clientKey);u.searchParams.set('response_type','code');u.searchParams.set('scope',SCOPES.join(','));u.searchParams.set('redirect_uri',redirectUri);u.searchParams.set('state',state);u.searchParams.set('disable_auto_auth','1');
  const response=NextResponse.redirect(u);
  response.cookies.set('cd_tiktok_oauth',JSON.stringify({state,userId:user.id,workspaceId,redirectUri}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/oauth/tiktok'});
  return response;
 }catch(e){logFailure('tiktok.oauth.start_failed',e);return NextResponse.redirect(new URL('/connections?error='+encodeURIComponent(e instanceof Error?e.message:'oauth_failed'),appOrigin()));}
}