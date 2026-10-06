import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import {grantTikTokReviewAccess} from './actions';

export default async function TikTokReviewDemo(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();
 if(!user)redirect('/login');
 if(user.email?.toLowerCase()!=='alex.nuvora+channeldesk-demo@gmail.com')redirect('/');
 return <main className="auth-page"><section className="auth-card"><p className="eyebrow">TEMPORARY REVIEW ACCESS</p><h1>TikTok review demo</h1><p className="muted">Grant this temporary test account editor access to the ChannelDesk workspace that owns the active TikTok connection.</p><form action={grantTikTokReviewAccess}><button type="submit">Grant demo access</button></form></section></main>;
}
