'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

const ACCEPT='video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp';
const MAX=256*1024*1024;
function safeName(name:string){return name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120)||'media';}

export default function MediaUploader({workspaceId}:{workspaceId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const router=useRouter();
 async function upload(formData:FormData){
  const file=formData.get('file');if(!(file instanceof File)||!file.size){setMessage('Choose a media file.');return;}
  if(file.size>MAX){setMessage('Files must be 256 MB or smaller.');return;}
  const allowed=['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type)){setMessage('Use MP4, MOV, WebM, JPG, PNG or WebP.');return;}
  setBusy(true);setMessage('');
  try{
   const supabase=createClient(),id=crypto.randomUUID(),key=workspaceId+'/'+id+'/'+safeName(file.name);
   const {error:uploadError}=await supabase.storage.from('channeldesk-media').upload(key,file,{contentType:file.type,upsert:false,cacheControl:'3600'});if(uploadError)throw uploadError;
   const sourceUrl=window.location.origin+'/media/'+id;
   const {error:rowError}=await supabase.from('media_assets').insert({id,workspace_id:workspaceId,storage_key:key,mime_type:file.type,source_url:sourceUrl,rights_basis:String(formData.get('rightsBasis')||'user_uploaded')});
   if(rowError){await supabase.storage.from('channeldesk-media').remove([key]);throw rowError;}
   setMessage('Uploaded to ChannelDesk media.');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
 }
 return <form action={upload} className="panel media-uploader"><div><b>Upload media</b><p className="muted">Stored privately in your ChannelDesk workspace. Publishable media is served through the verified ChannelDesk domain.</p></div><label>File<input name="file" type="file" accept={ACCEPT} required disabled={busy}/></label><label>Rights<select name="rightsBasis" defaultValue="user_uploaded" disabled={busy}><option value="user_uploaded">I own / am authorised to use this media</option><option value="licensed">Licensed media</option><option value="public_domain">Public domain</option></select></label><button disabled={busy}>{busy?'Uploading…':'Upload media'}</button>{message?<span className="notice">{message}</span>:null}</form>;
}