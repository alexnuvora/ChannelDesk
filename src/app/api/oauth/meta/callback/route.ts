import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {admin} from '@/lib/mcp-oauth';
import {encrypt} from '@/lib/publishing';

const graph='https://graph.facebook.com/v24.0';
export async function GET(req:Request){
 const u=new URL(req.url),code=u.searchParams.get('code'),state=u.searchParams.get('state');
 const jar=await cookies(),saved=jar.get('cd_meta_state')?.value;
 const fail=(message:string)=>{const response=NextResponse.redirect(new URL('/connections?error='+encodeURIComponent(message),req.url));response.cookies.delete('cd_meta_state');return response;};
 if(!code||!state||!saved||state!==saved)return fail('meta_oauth_state_invalid');
 const s=await createClient();const {data:{user}}=await s.auth.getUser();
 if(!user)return fail('meta_oauth_state_invalid');
 let workspaceId='';
 try{const decoded=JSON.parse(Buffer.from(state,'base64url').toString('utf8'));if(typeof decoded.workspaceId!=='string'||typeof decoded.nonce!=='string'||decoded.nonce.length<16)throw new Error('Invalid OAuth state');workspaceId=decoded.workspaceId;}catch{return fail('meta_oauth_state_invalid');}
 const {data:membership,error:membershipError}=await s.from('workspace_members').select('role').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle();
 if(membershipError||!membership||!['owner','admin','editor'].includes(membership.role))return fail('workspace_required');
 const appId=process.env.META_APP_ID,secret=process.env.META_APP_SECRET,redirect=process.env.META_REDIRECT_URI||new URL('/api/oauth/meta/callback',req.url).toString();
 if(!appId||!secret)return fail('meta_not_configured');
 try{
  const tokenUrl=new URL(graph+'/oauth/access_token');
  tokenUrl.search=new URLSearchParams({client_id:appId,client_secret:secret,redirect_uri:redirect,code}).toString();
  const tr=await fetch(tokenUrl,{cache:'no-store',signal:AbortSignal.timeout(15000)}),tok=await tr.json();
  if(!tr.ok||typeof tok.access_token!=='string')return fail('meta_token_exchange_failed');
  const longUrl=new URL(graph+'/oauth/access_token');longUrl.search=new URLSearchParams({grant_type:'fb_exchange_token',client_id:appId,client_secret:secret,fb_exchange_token:tok.access_token}).toString();
  const lr=await fetch(longUrl,{cache:'no-store',signal:AbortSignal.timeout(15000)}),long=await lr.json().catch(()=>({}));
  const userToken=lr.ok&&typeof long.access_token==='string'?long.access_token:tok.access_token;
  const permissionUrl=new URL(graph+'/me/permissions');permissionUrl.searchParams.set('access_token',userToken);
  const perms=await fetch(permissionUrl,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!perms.ok)return fail('meta_permissions_failed');
  const scopes=new Set<string>((((await perms.json()).data||[]) as Array<{permission?:string;status?:string}>).filter(x=>x.status==='granted'&&typeof x.permission==='string').map(x=>x.permission!));
  const pagesUrl=new URL(graph+'/me/accounts');
  pagesUrl.searchParams.set('fields','id,name,access_token,instagram_business_account{id,username}');
  pagesUrl.searchParams.set('access_token',userToken);
  const pr=await fetch(pagesUrl,{cache:'no-store',signal:AbortSignal.timeout(15000)}),pages=await pr.json();
  if(!pr.ok||!Array.isArray(pages.data))return fail('meta_accounts_failed');
  const db=admin();let connected=0;
  for(const page of pages.data){
   if(typeof page.id!=='string'||typeof page.access_token!=='string')continue;
   const fbScopes=['pages_show_list','pages_manage_posts','pages_read_engagement','pages_read_user_content','read_insights'].filter(x=>scopes.has(x));
   const {error:pageError}=await db.from('social_connections').upsert({workspace_id:workspaceId,network:'facebook',external_account_id:page.id,display_name:page.name||'Facebook Page',token_ciphertext:encrypt(page.access_token),scopes:fbScopes,active:true},{onConflict:'workspace_id,network,external_account_id'});
   if(pageError)throw pageError;connected++;
   if(page.instagram_business_account?.id&&scopes.has('instagram_basic')){
    const igScopes=['instagram_basic','instagram_content_publish','instagram_manage_comments','instagram_manage_insights'].filter(x=>scopes.has(x));
    const {error:igError}=await db.from('social_connections').upsert({workspace_id:workspaceId,network:'instagram',external_account_id:page.instagram_business_account.id,display_name:page.instagram_business_account.username||page.name||'Instagram',token_ciphertext:encrypt(page.access_token),scopes:igScopes,active:true},{onConflict:'workspace_id,network,external_account_id'});
    if(igError)throw igError;
   }
  }
  if(!connected)return fail('meta_accounts_failed');
  const response=NextResponse.redirect(new URL('/connections?connected=facebook',req.url));response.cookies.delete('cd_meta_state');return response;
 }catch{return fail('meta_accounts_failed');}
}
