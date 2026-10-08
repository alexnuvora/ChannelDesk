import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {CreateWizard} from './create-wizard';
export default async function Create({searchParams}:{searchParams:Promise<{error?:string;success?:string;date?:string;media?:string}>}){
 const p=await searchParams;
 const supabase=await createClient();
 const [{data:accounts,error:accountsError},{data:assets,error:mediaError}]=await Promise.all([
  supabase.from('social_connections').select('id,network,display_name,workspace_id,scopes').in('network',['facebook','instagram','tiktok','youtube']).eq('active',true).order('network'),
  supabase.from('media_assets').select('id,mime_type,source_url,storage_key,duration_ms,workspace_id').order('created_at',{ascending:false}).limit(100)
 ]);
 return <><div className="page-title"><div><p className="eyebrow">CREATE</p><h1>Create a post</h1><p className="muted">Choose accounts, add your creative, write a caption, and review everything before publishing.</p></div><Link className="button secondary-button" href="/media">Media library</Link></div>
 {p.error&&<p className="notice error" role="alert">{p.error}</p>}
 {p.success&&<p className="notice" role="status">{p.success}</p>}
 {accountsError&&<p className="notice error">Unable to load connected accounts.</p>}
 {mediaError&&<p className="notice error">Unable to load your media library.</p>}
 {!accountsError&&!mediaError&&<CreateWizard accounts={accounts||[]} assets={assets||[]} initialMediaId={p.media} initialDate={p.date}/>}
 </>;
}