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
 const next=safeNext(formData.get('next'));if(String(formData.get('password')||'').length<8)redirect('/login?error='+encodeURIComponent('Use at least 8 characters for your new password.')+'&next='+encodeURIComponent(next));let failure='';let signedIn=false;
 try{const supabase=await createClient();const {data,error}=await supabase.auth.signUp({email:String(formData.get('email')||'').trim(),password:String(formData.get('password')||''),options:{emailRedirectTo:appOrigin()+'/auth/callback?next='+encodeURIComponent(next)}});if(error)failure=error.message;else if(data.session&&data.user){await ensureWorkspace(supabase,data.user);signedIn=true;}}catch(e){logFailure('auth.signup.failed',e);failure='ChannelDesk could not create this account. Please try again.';}
 if(failure)redirect('/login?error='+encodeURIComponent(failure)+'&next='+encodeURIComponent(next));if(signedIn)redirect(next);redirect('/login?message='+encodeURIComponent('Check your email to confirm your account, then continue signing in.')+'&next='+encodeURIComponent(next));
}
export async function signInWithGoogle(formData:FormData){
 const next=safeNext(formData.get('next'));let target='';
 try{const supabase=await createClient();const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:appOrigin()+'/auth/callback?next='+encodeURIComponent(next)}});if(error||!data.url)throw error||new Error('Missing sign-in URL.');target=data.url;}catch(e){logFailure('auth.google.start_failed',e);}
 if(!target)redirect('/login?error='+encodeURIComponent('Google sign-in could not be started. Try again shortly.')+'&next='+encodeURIComponent(next));redirect(target);
}
export async function signOut(){const supabase=await createClient();await supabase.auth.signOut();redirect('/login');}

export async function requestPasswordReset(formData:FormData){
 const email=String(formData.get('email')||'').trim();if(!/^\S+@\S+\.\S+$/.test(email)||email.length>320)redirect('/forgot-password?error='+encodeURIComponent('Enter a valid email address.'));
 try{const supabase=await createClient();await supabase.auth.resetPasswordForEmail(email,{redirectTo:appOrigin()+'/auth/callback?next='+encodeURIComponent('/reset-password')});}
 catch(e){logFailure('auth.reset.request_failed',e);redirect('/forgot-password?error='+encodeURIComponent('Could not send the reset link. Try again shortly.'));}
 redirect('/forgot-password?message='+encodeURIComponent('If this account can use a password, a reset link is on its way.'));
}
export async function setNewPassword(formData:FormData){
 const password=String(formData.get('password')||''),confirm=String(formData.get('confirm')||'');
 if(password.length<8||password.length>128||password!==confirm)redirect('/reset-password?error='+encodeURIComponent('Passwords must match and contain 8–128 characters.'));
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/forgot-password?error='+encodeURIComponent('Your reset link expired. Request a new one.'));
 const {error}=await s.auth.updateUser({password});if(error)redirect('/reset-password?error='+encodeURIComponent('Password could not be updated. Request a new link and try again.'));
 await s.auth.signOut();redirect('/login?message='+encodeURIComponent('Password updated. Sign in with your new password.'));
}
