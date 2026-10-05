import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {SocialIcon} from '@/components/social-icon';
import {createClient} from '@/lib/supabase/server';
import {YouTubeForm} from './youtube-form';
import {TikTokForm} from './tiktok-form';
export default async function Create({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}){
 const params=await searchParams,supabase=await createClient();
 const [{data:youtube,error:youtubeError},{data:tiktok,error:tiktokError},{data:assets,error:mediaError}]=await Promise.all([
  supabase.from('social_connections').select('id,display_name,workspace_id').eq('network','youtube').eq('active',true),
  supabase.from('social_connections').select('id,display_name,workspace_id').eq('network','tiktok').eq('active',true),
  supabase.from('media_assets').select('id,source_url,storage_key,mime_type,created_at').like('mime_type','video/%').order('created_at',{ascending:false}).limit(50)
 ]);
 const media=mediaError?[]:(assets||[]);
 return <><div className="page-title"><div><p className="eyebrow">CREATE</p><h1>Create a post</h1><p className="muted">Choose a channel, pick media from your library, then publish now or schedule where supported.</p></div><Link className="button secondary-button" href="/media">Media library</Link></div>{params.error&&<p className="notice error" role="alert">{params.error}</p>}{params.success&&<p className="notice" role="status">{params.success}</p>}{mediaError&&<p className="notice error">Your Media Library could not be loaded. Refresh before publishing.</p>}<div className="create-grid"><div className="panel create-panel"><div className="channel-heading"><span className="network-mark youtube"><SocialIcon network="youtube"/></span><div><h2>YouTube</h2><p className="muted">Video publishing and scheduling</p></div></div>{youtubeError?<p className="notice error">YouTube accounts could not be loaded.</p>:youtube?.length?<YouTubeForm accounts={youtube} assets={media} requestId={randomUUID()}/>:<div className="setup-prompt"><p>Connect YouTube to start publishing.</p><Link className="button" href="/connections">Connect YouTube</Link></div>}</div><div className="panel create-panel"><div className="channel-heading"><span className="network-mark tiktok"><SocialIcon network="tiktok"/></span><div><h2>TikTok</h2><p className="muted">Draft upload or Direct Post</p></div></div>{tiktokError?<p className="notice error">TikTok accounts could not be loaded.</p>:tiktok?.length?<TikTokForm accounts={tiktok} assets={media} requestId={randomUUID()}/>:<div className="setup-prompt"><p>Connect TikTok to start publishing.</p><Link className="button" href="/connections">Connect TikTok</Link></div>}</div></div></>;
}