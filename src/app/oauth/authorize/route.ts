import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {admin,hashSecret,issuer,randomSecret,validateAuthorization,verifyClientMetadata,OAuthRequestError} from '@/lib/mcp-oauth';
import {appOrigin,ConfigurationError,logFailure,requireServerDatabaseConfig} from '@/lib/config';
import {CONSENT_COOKIE,consentProof,consentMatches,escapeHtml} from '@/lib/oauth-consent';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store','Pragma':'no-cache','Content-Type':'text/html; charset=utf-8','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'self'; form-action *; frame-ancestors 'none'; base-uri 'none'"};
function html(title:string,body:string,status=200){return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · ChannelDesk</title><link rel="stylesheet" href="/oauth.css"></head><body><main><div class="brand">CD · ChannelDesk</div><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`,{status,headers});}
function failure(e:unknown){logFailure('oauth.authorize.failed',e);if(e instanceof OAuthRequestError)return html('Connection request rejected',`<p>${escapeHtml(e.message)}</p><p>Return to ChatGPT and start the connection again.</p>`,400);return html('ChannelDesk connection needs attention',`<p>${e instanceof ConfigurationError?'The app owner needs to finish the server configuration before ChatGPT can connect.':'ChannelDesk could not complete this connection. Please try again shortly.'}</p><p>Your social accounts have not been changed.</p><a href="/settings">Open ChannelDesk settings</a>`,503);}
function callback(q:ReturnType<typeof validateAuthorization>,values:Record<string,string>){const u=new URL(q.redirect);for(const [key,value]of Object.entries(values))u.searchParams.set(key,value);if(q.state)u.searchParams.set('state',q.state);u.searchParams.set('iss',issuer());const r=NextResponse.redirect(u,303);r.headers.set('Cache-Control','no-store');r.headers.set('Referrer-Policy','no-referrer');r.cookies.set(CONSENT_COOKIE,'',{maxAge:0,path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});return r;}
export async function GET(request:NextRequest){
 try{
  const raw=new URL(request.url);const q=validateAuthorization(raw.searchParams);
  if(raw.origin!==appOrigin())return NextResponse.redirect(new URL(raw.pathname+raw.search,appOrigin()),303);
  const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)return NextResponse.redirect(new URL('/login?next='+encodeURIComponent(raw.pathname+raw.search),appOrigin()),303);
  requireServerDatabaseConfig();await verifyClientMetadata(q.clientId,q.redirect);
  const nonce=randomSecret();const query=raw.searchParams.toString();const publish=q.scope.split(' ').includes('channeldesk.publish');
  const response=html('Connect ChatGPT',`<p>Signed in as <strong>${escapeHtml(user.email||'your ChannelDesk account')}</strong>.</p><p>Allow ChatGPT to access your ChannelDesk workspaces?</p><ul>${q.scope.includes('channeldesk.read')?'<li>Read connected accounts, calendars and publication status.</li>':''}${publish?'<li>Publish and manage YouTube videos when you ask it to, within your workspace permissions.</li>':''}</ul><p>Your social account passwords and tokens are never sent to ChatGPT.</p><form method="post" action="/oauth/authorize"><input type="hidden" name="request" value="${escapeHtml(query)}"><input type="hidden" name="nonce" value="${nonce}"><button name="decision" value="allow">Allow access</button><button class="secondary" name="decision" value="deny">Cancel</button></form>`);
  response.cookies.set(CONSENT_COOKIE,consentProof(query,nonce,user.id),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});return response;
 }catch(e){return failure(e);}
}
export async function POST(request:NextRequest){
 try{
  const text=await request.text();if(text.length>12000)return html('Request too large','<p>Start again from ChatGPT.</p>',413);
  const body=new URLSearchParams(text);const query=body.get('request')||'',nonce=body.get('nonce')||'';const q=validateAuthorization(new URLSearchParams(query));
  const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return html('Sign in again','<p>Your sign-in expired. Return to ChatGPT and reconnect.</p>',401);
  if(!/^[A-Za-z0-9_-]{43}$/.test(nonce)||!consentMatches(consentProof(query,nonce,user.id),request.cookies.get(CONSENT_COOKIE)?.value||''))return html('Connection request expired','<p>Return to ChatGPT and start the connection again.</p>',403);
  if(body.get('decision')==='deny')return callback(q,{error:'access_denied',error_description:'The user declined access.'});
  if(body.get('decision')!=='allow')throw new OAuthRequestError('invalid_request','Choose whether to allow access.');
  await verifyClientMetadata(q.clientId,q.redirect);
  const code=randomSecret();const {error:insertError}=await admin().from('mcp_oauth_codes').insert({code_hash:hashSecret(code),user_id:user.id,client_id:q.clientId,redirect_uri:q.redirect,resource:q.resource,scope:q.scope,code_challenge:q.challenge,expires_at:new Date(Date.now()+300000).toISOString()});
  if(insertError)throw insertError;
  return callback(q,{code});
 }catch(e){return failure(e);}
}
