import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {appOrigin,logFailure} from '@/lib/config';
import {assertWorkspaceAccess,base64urlSha256,randomSecret} from '@/lib/mcp-oauth';
export async function GET(request:NextRequest){
 try{
  const network=request.nextUrl.searchParams.get('network');if(network!=='youtube')throw new Error('unsupported_provider');const workspaceId=request.nextUrl.searchParams.get('workspaceId')||'';
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL('/login',appOrigin()));await assertWorkspaceAccess(user.id,workspaceId,true);
  if(!process.env.GOOGLE_OAUTH_CLIENT_ID||!process.env.GOOGLE_OAUTH_CLIENT_SECRET)throw new Error('google_not_configured');
  const state=randomSecret(),verifier=randomSecret();const redirectUri=appOrigin()+'/api/oauth/google/callback';const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,value]of Object.entries({client_id:process.env.GOOGLE_OAUTH_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly',access_type:'offline',prompt:'consent',state,code_challenge:base64urlSha256(verifier),code_challenge_method:'S256'}))u.searchParams.set(key,value);
  const response=NextResponse.redirect(u);response.cookies.set('cd_google_oauth',JSON.stringify({state,verifier,network,userId:user.id,workspaceId,redirectUri}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/oauth/google'});return response;
 }catch(e){logFailure('google.oauth.start_failed',e);return NextResponse.redirect(new URL('/connections?error='+encodeURIComponent(e instanceof Error?e.message:'oauth_failed'),appOrigin()));}
}
