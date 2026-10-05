import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {appOrigin,safeNext,logFailure} from '@/lib/config';
import {ensureWorkspace} from '@/lib/workspace-session';
export async function GET(request:Request){
 const url=new URL(request.url);const next=safeNext(url.searchParams.get('next'));let errorMessage='Sign-in did not return an authorisation code. Please try again.';
 try{
  const code=url.searchParams.get('code');if(code){const supabase=await createClient();const flowId=url.searchParams.get('sb_flow_id');const {data,error}=await supabase.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);if(error||!data.user)throw error||new Error('No authenticated user.');await ensureWorkspace(supabase,data.user);return NextResponse.redirect(new URL(next,appOrigin()),303);}
 }catch(e){logFailure('auth.callback.failed',e);errorMessage='ChannelDesk could not finish sign-in. Please start again.';}
 return NextResponse.redirect(new URL('/login?error='+encodeURIComponent(errorMessage)+'&next='+encodeURIComponent(next),appOrigin()),303);
}
