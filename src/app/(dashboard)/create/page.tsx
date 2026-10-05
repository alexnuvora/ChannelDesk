import {randomUUID} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {YouTubeForm} from './youtube-form';
import {TikTokForm} from './tiktok-form';
export default async function Create({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}){
 const params=await searchParams,supabase=await createClient();
 const [{data:youtube,error:youtubeError},{data:tiktok,error:tiktokError}]=await Promise.all([
  supabase.from('social_connections').select('id,display_name,workspace_id').eq('network','youtube').eq('active',true),
  supabase.from('social_connections').select('id,display_name,workspace_id').eq('network','tiktok').eq('active',true)
 ]);
 return <><p className="eyebrow">CREATE</p><h1>Create content</h1><p className="muted">Publish to the exact connected account you choose. ChannelDesk validates workspace access again on submit.</p>{params.error&&<p className="notice error" role="alert">{params.error}</p>}{params.success&&<p className="notice" role="status">{params.success}</p>}<div className="create-grid"><div className="panel"><h2>YouTube</h2>{youtubeError?<p className="notice error">YouTube accounts could not be loaded.</p>:youtube?.length?<YouTubeForm accounts={youtube} requestId={randomUUID()}/>:<p className="muted">Connect YouTube before publishing.</p>}</div><div className="panel"><h2>TikTok</h2>{tiktokError?<p className="notice error">TikTok accounts could not be loaded.</p>:tiktok?.length?<TikTokForm accounts={tiktok} requestId={randomUUID()}/>:<p className="muted">Connect TikTok before publishing.</p>}</div></div></>;
}