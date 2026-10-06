'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {createYouTubePublication,publishTikTok,uploadTikTokDraft} from '@/lib/publishing';
import {logFailure} from '@/lib/config';
import {ZodError} from 'zod';
export async function saveDraft(formData:FormData){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');const connectionId=String(formData.get('connectionId')||''),mediaAssetId=String(formData.get('mediaAssetId')||''),network=String(formData.get('network')||'');let url='';
 try{if(!['youtube','tiktok'].includes(network))throw new Error('Choose a supported channel.');const {data:connection}=await s.from('social_connections').select('workspace_id,network').eq('id',connectionId).eq('network',network).eq('active',true).maybeSingle();if(!connection)throw new Error('Choose an active channel.');const {data:asset}=await s.from('media_assets').select('id,mime_type').eq('id',mediaAssetId).eq('workspace_id',connection.workspace_id).maybeSingle();if(!asset?.mime_type?.startsWith('video/'))throw new Error('Choose a video from this workspace.');
  const payload=network==='youtube'?{title:String(formData.get('title')||''),description:String(formData.get('description')||''),privacy:String(formData.get('privacy')||'private'),madeForKids:String(formData.get('madeForKids')||'')==='yes',scheduledFor:String(formData.get('scheduledFor')||'')||null}:{caption:String(formData.get('caption')||''),mode:String(formData.get('mode')||'draft'),privacy:String(formData.get('privacy')||'SELF_ONLY')};
  const text=network==='youtube'?String(formData.get('title')||''):String(formData.get('caption')||'');const {data:id,error}=await s.rpc('create_publication_draft',{p_connection_id:connectionId,p_media_id:mediaAssetId,p_text:text,p_payload:payload});if(error)throw error;url='/planner?message='+encodeURIComponent('Draft saved and ready for review. Publication '+id);
 }catch(e){url='/create?error='+encodeURIComponent(e instanceof Error?e.message:'Draft could not be saved.');}redirect(url);
}

export async function submitYouTube(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const connectionId=String(formData.get('connectionId')||'');const {data:connection}=await supabase.from('social_connections').select('workspace_id').eq('id',connectionId).eq('network','youtube').eq('active',true).maybeSingle();if(!connection)redirect('/create?error='+encodeURIComponent('Choose an active YouTube channel.'));
 let message='',errorMessage='';
 try{
  const mediaAssetId=String(formData.get('mediaAssetId')||'');const {data:asset}=await supabase.from('media_assets').select('source_url,mime_type').eq('id',mediaAssetId).eq('workspace_id',connection.workspace_id).maybeSingle();if(!asset?.source_url||!asset.mime_type?.startsWith('video/'))throw new Error('Choose a video from your Media Library.');
  const kids=String(formData.get('madeForKids')||'');if(!['yes','no'].includes(kids))throw new Error('Select whether the video is made for kids.');const scheduled=String(formData.get('scheduledFor')||'');if(scheduled){const payload={title:String(formData.get('title')||''),description:String(formData.get('description')||''),privacy:String(formData.get('privacy')||'public'),madeForKids:kids==='yes'};const {data:id,error}=await supabase.rpc('create_scheduled_publication',{p_connection_id:connectionId,p_media_id:mediaAssetId,p_text:payload.title,p_payload:payload,p_scheduled_for:scheduled,p_request_id:String(formData.get('requestId')||'')});if(error)throw error;message=`Scheduled in ChannelDesk · Publication ${id}`;redirect('/planner?message='+encodeURIComponent(message));}
  const result=await createYouTubePublication({connectionId,title:String(formData.get('title')||''),description:String(formData.get('description')||''),mediaUrl:asset.source_url,privacy:String(formData.get('privacy')||'') as 'private'|'unlisted'|'public',madeForKids:kids==='yes',requestId:String(formData.get('requestId')||'')},connection.workspace_id,user.id);
  if(result.error||['failed','needs_review'].includes(result.state))errorMessage=`${result.error||'Check the existing publication before retrying.'} Publication: ${result.publicationId}`;
  else message=`Publication ${result.publicationId}: ${result.state}${result.videoId?' · Video '+result.videoId:''}`;
 }catch(e){logFailure('youtube.form.failed',e);errorMessage=e instanceof ZodError?e.issues.map(i=>i.message).join(' '):e instanceof Error?e.message:'Publishing could not be completed.';}
 redirect('/create?'+(errorMessage?'error='+encodeURIComponent(errorMessage):'success='+encodeURIComponent(message)));
}

export async function submitTikTok(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const connectionId=String(formData.get('connectionId')||'');const {data:connection}=await supabase.from('social_connections').select('workspace_id').eq('id',connectionId).eq('network','tiktok').eq('active',true).maybeSingle();if(!connection)redirect('/create?error='+encodeURIComponent('Choose an active TikTok account.'));
 let message='',errorMessage='';
 try{
  const mediaAssetId=String(formData.get('mediaAssetId')||'');const {data:asset}=await supabase.from('media_assets').select('source_url,mime_type').eq('id',mediaAssetId).eq('workspace_id',connection.workspace_id).maybeSingle();if(!asset?.source_url||!asset.mime_type?.startsWith('video/'))throw new Error('Choose a video from your Media Library.');
  const mode=String(formData.get('mode')||'draft');const mediaUrl=asset.source_url;const requestId=String(formData.get('requestId')||'');
  if(mode==='scheduled'){const local=String(formData.get('scheduledLocal')||'');const when=new Date(local);if(!Number.isFinite(when.getTime()))throw new Error('Choose a valid schedule time.');const payload={caption:String(formData.get('caption')||''),privacy:String(formData.get('privacy')||'SELF_ONLY'),disableComment:String(formData.get('allowComments')||'')!=='on',disableDuet:String(formData.get('allowDuet')||'')!=='on',disableStitch:String(formData.get('allowStitch')||'')!=='on'};const {data:id,error}=await supabase.rpc('create_scheduled_publication',{p_connection_id:connectionId,p_media_id:mediaAssetId,p_text:payload.caption,p_payload:payload,p_scheduled_for:when.toISOString(),p_request_id:requestId});if(error)throw error;redirect('/planner?message='+encodeURIComponent(`TikTok scheduled in ChannelDesk · Publication ${id}`));}
  if(mode==='draft'){const result=await uploadTikTokDraft({connectionId,mediaUrl,requestId},connection.workspace_id,user.id);message=`TikTok draft accepted · Publish ID ${result.publishId}`;}
  else if(mode==='direct'){const privacy=String(formData.get('privacy')||'SELF_ONLY') as 'PUBLIC_TO_EVERYONE'|'MUTUAL_FOLLOW_FRIENDS'|'FOLLOWER_OF_CREATOR'|'SELF_ONLY';const result=await publishTikTok({connectionId,mediaUrl,caption:String(formData.get('caption')||''),privacy,disableComment:String(formData.get('allowComments')||'')!=='on',disableDuet:String(formData.get('allowDuet')||'')!=='on',disableStitch:String(formData.get('allowStitch')||'')!=='on',requestId},connection.workspace_id,user.id);message=`TikTok Direct Post accepted · Publish ID ${result.publishId}`;}
  else throw new Error('Choose a valid TikTok publishing mode.');
 }catch(e){logFailure('tiktok.form.failed',e);errorMessage=e instanceof ZodError?e.issues.map(i=>i.message).join(' '):e instanceof Error?e.message:'TikTok publishing could not be completed.';}
 redirect('/create?'+(errorMessage?'error='+encodeURIComponent(errorMessage):'success='+encodeURIComponent(message)));
}
