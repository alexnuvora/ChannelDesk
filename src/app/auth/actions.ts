'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {appOrigin,safeNext,logFailure} from '@/lib/config';
import {ensureWorkspace} from '@/lib/workspace-session';
export async function signIn(formData:FormData){
 const next=safeNext(formData.get('next'));let failure='';
 try{const supabase=await createClient();const {data,error}=await supabase.auth.signInWithPassword({email:String(formData.get('email')||'').trim(),password:String(formData.get('password')||'')});if(error||!data.user)failure=error?.message||'Sign-in failed.';else await ensureWorkspace(supabase,data.user);}catch(e){logFailure('auth.password.failed',e);failure='ChannelDesk could not complete sign-in. Please try again.';}
 if(failure)redirect('/login?error='+encodeURIComponent(failure)+'&next='+encodeURIComponent(next));redirect(next);
}
export async function signUp(formData:FormData){
 const next=safeNext(formData.get('next'));let failure='';let signedIn=false;
 try{const supabase=await createClient();const {data,error}=await supabase.auth.signUp({email:String(formData.get('email')||'').trim(),password:String(formData.get('password')||''),options:{emailRedirectTo:appOrigin()+'/auth/callback?next='+encodeURIComponent(next)}});if(error)failure=error.message;else if(data.session&&data.user){await ensureWorkspace(supabase,data.user);signedIn=true;}}catch(e){logFailure('auth.signup.failed',e);failure='ChannelDesk could not create this account. Please try again.';}
 if(failure)redirect('/login?error='+encodeURIComponent(failure)+'&next='+encodeURIComponent(next));if(signedIn)redirect(next);redirect('/login?message='+encodeURIComponent('Check your email to confirm your account, then continue signing in.')+'&next='+encodeURIComponent(next));
}
export async function signInWithGoogle(formData:FormData){
 const next=safeNext(formData.get('next'));let target='';
 try{const supabase=await createClient();const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:appOrigin()+'/auth/callback?next='+encodeURIComponent(next)}});if(error||!data.url)throw error||new Error('Missing sign-in URL.');target=data.url;}catch(e){logFailure('auth.google.start_failed',e);}
 if(!target)redirect('/login?error='+encodeURIComponent('Google sign-in could not be started. Try again shortly.')+'&next='+encodeURIComponent(next));redirect(target);
}
export async function signOut(){const supabase=await createClient();await supabase.auth.signOut();redirect('/login');}
