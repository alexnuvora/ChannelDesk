"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
import {Eye,EyeOff,ArrowRight} from 'lucide-react';
import {signIn,signUp} from '@/app/auth/actions';
function SubmitButtons(){const {pending}=useFormStatus();return <><button formAction={signIn} disabled={pending}>{pending?'Please wait…':<>Sign in <ArrowRight size={16}/></>}</button><button className="secondary" formAction={signUp} disabled={pending}>Create account</button></>}
export function LoginForm({next}:{next:string}){const [visible,setVisible]=useState(false);return <form className="auth-form"><input type="hidden" name="next" value={next}/><label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com"/></label><label>Password<div className="cd-password-field"><input name="password" type={visible?'text':'password'} required autoComplete="current-password"/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label><Link href="/forgot-password" className="cd-auth-forgot">Forgot password?</Link><SubmitButtons/><p className="cd-auth-helper">New here? Use a password with at least 8 characters when creating your account.</p></form>}
