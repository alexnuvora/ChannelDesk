import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {randomBytes} from 'node:crypto';

export async function GET(req:Request){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login',req.url));
 const workspaceId=new URL(req.url).searchParams.get('workspaceId');
 const error=(reason:string)=>NextResponse.redirect(new URL('/connections?error='+encodeURIComponent(reason),req.url));
 if(!workspaceId)return error('workspace_required');
 const {data:membership}=await s.from('workspace_members').select('role').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle();
 if(!membership||!['owner','admin','editor'].includes(membership.role))return error('workspace_required');
 const appId=process.env.META_APP_ID;
 const configurationId=process.env.META_LOGIN_CONFIG_ID;
 const redirect=process.env.META_REDIRECT_URI||new URL('/api/oauth/meta/callback',req.url).toString();
 if(!appId)return error('meta_not_configured');
 if(!configurationId)return error('meta_login_config_missing');
 const state=Buffer.from(JSON.stringify({workspaceId,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 // Facebook Login for Business uses a dashboard-created Login Configuration.
 // Scopes are selected in Meta's configuration, not supplied as a legacy scope list.
 const params=new URLSearchParams({client_id:appId,redirect_uri:redirect,state,config_id:configurationId,response_type:'code',override_default_response_type:'true'});
 const res=NextResponse.redirect('https://www.facebook.com/v24.0/dialog/oauth?'+params.toString());
 res.cookies.set('cd_meta_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/'});
 return res;
}
