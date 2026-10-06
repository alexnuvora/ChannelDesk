'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {createYouTubePublication,publishTikTok,uploadTikTokDraft,getTikTokCreatorInfo,assertTikTokCapabilities} from '@/lib/publishing';
import {logFailure,appOrigin} from '@/lib/config';
import {schedulePublication,youtubeSchedulePayload,tiktokSchedulePayload} from '@/lib/scheduling';
import {ZodError} from 'zod';
export async function saveDraft(formData:FormData){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');const connectionId=String(formData.get('connectionId')||''),mediaAssetId=String(formData.get('mediaAssetId')||''),network=String(formData.get('network')||'');let url='';
 try{if(!['youtube','tiktok'].includes(network))throw new Error('Choose a supported channel.');const {data:connection}=await s.from('social_connections').select('workspace_id,network').eq('id',connectionId).eq('network',network).eq('active',true).maybeSingle();if(!connection)throw new Error('Choose an active channel.');const {data:asset}=await s.from('media_assets').select('id,mime_type').eq('id',mediaAssetId).eq('workspace_id',connection.workspace_id).maybeSingle();if(!asset?.mime_type?.startsWith('video/'))throw new Error('Choose a video from this workspace.');
  const payload=network==='youtube'?{title:String(formData.get('title')||''),description:String(formData.get('description')||''),privacy:String(formData.get('privacy')||'private'),madeForKids:String(formData.get('madeForKids')||'')==='yes',scheduledFor:String(formData.get('scheduledFor')||'')||null}:{caption:String(formData.get('caption')||''),mode:String(formData.get('mode')||'draft'),privacy:String(formData.get('privacy')||'SELF_ONLY')};
  const text=network==='youtube'?String(formData.get('title')||''):String(formData.get('caption')||'');const {data:id,error}=await s.rpc('create_publication_draft',{p_connection_id:connectionId,p_media_id:mediaAssetId,p_text:text,p_payload:payload});if(error)throw error;url='/planner?message='+encodeURIComponent('Draft saved and ready for review. Publication '+id);
 }catch(e){url='/create?error='+encodeURIComponent(e instanceof Error?e.message:'Draft could not be saved.');}redirect(url);
}


async function destination(formData:FormData,network:'youtube'|'tiktok',userId:string){
 const s=await createClient();
 const connectionId=String(formData.get('connectionId')||''),mediaAssetId=String(formData.get('mediaAssetId')||'');
 const {data:connection,error}=await s.from('social_connections').select('workspace_id').eq('id',connectionId).eq('network',network).eq('active',true).maybeSingle();if(error||!connection)throw new Error('Choose an active account.');
 const {data:asset}=await s.from('media_assets').select('id,mime_type').eq('id',mediaAssetId).eq('workspace_id',connection.workspace_id).maybeSingle();if(!asset?.mime_type.startsWith('video/'))throw new Error('Choose a video from this workspace.');
 return {userId,workspaceId:connection.workspace_id,connectionId,mediaAssetId,mediaUrl:appOrigin()+'/media/'+asset.id,requestId:String(formData.get('requestId')||'')};
}
function describeError(error:unknown){return error instanceof ZodError?error.issues.map(i=>i.message).join(' '):error instanceof Error?error.message:'Publishing could not be completed.';}
export async function submitYouTube(formData:FormData){
 // Keep framework redirects outside the publishing error handler.
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');let target='/create';
 try{const c=await destination(formData,'youtube',user.id);
  const kids=String(formData.get('madeForKids')||'');if(!['yes','no'].includes(kids))throw new Error('Choose an audience.');
  const payload=youtubeSchedulePayload.parse({title:String(formData.get('title')||''),description:String(formData.get('description')||''),privacy:String(formData.get('privacy')||''),madeForKids:kids==='yes'});
  const scheduledFor=String(formData.get('scheduledFor')||'');
  const result=scheduledFor?await schedulePublication({connectionId:c.connectionId,mediaAssetId:c.mediaAssetId,requestId:c.requestId,scheduledFor,payload},c.workspaceId,c.userId):await createYouTubePublication({connectionId:c.connectionId,mediaUrl:c.mediaUrl,requestId:c.requestId,...payload},c.workspaceId,c.userId);
  if(['failed','needs_review'].includes(result.state))throw new Error('Publication '+result.publicationId+': '+result.state+'. Check its status before retrying.');
  target=(scheduledFor?'/planner?message=':'/create?success=')+encodeURIComponent('Publication '+result.publicationId+': '+result.state);
 }catch(e){logFailure('youtube.form.failed',e);target='/create?error='+encodeURIComponent(describeError(e));}
 redirect(target);
}
export async function submitTikTok(formData:FormData){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');let target='/create';
 try{const c=await destination(formData,'tiktok',user.id);
  const mode=String(formData.get('mode')||'');let result:any;
  if(mode==='draft')result=await uploadTikTokDraft({connectionId:c.connectionId,mediaUrl:c.mediaUrl,requestId:c.requestId},c.workspaceId,c.userId);
  else if(mode==='direct'||mode==='scheduled'){
   const payload=tiktokSchedulePayload.parse({caption:String(formData.get('caption')||''),privacy:String(formData.get('privacy')||''),disableComment:formData.get('allowComments')!=='on',disableDuet:formData.get('allowDuet')!=='on',disableStitch:formData.get('allowStitch')!=='on'});
   if(mode==='scheduled'){
    assertTikTokCapabilities(payload,await getTikTokCreatorInfo(c.connectionId,c.workspaceId,c.userId));
    result=await schedulePublication({connectionId:c.connectionId,mediaAssetId:c.mediaAssetId,requestId:c.requestId,scheduledFor:String(formData.get('scheduledFor')||''),payload},c.workspaceId,c.userId);
   }else result=await publishTikTok({connectionId:c.connectionId,mediaUrl:c.mediaUrl,requestId:c.requestId,...payload},c.workspaceId,c.userId);
  }else throw new Error('Choose a valid publishing mode.');
  if(['failed','needs_review'].includes(result.state))throw new Error('Publication '+result.publicationId+': '+result.state+'. Check its status before retrying.');
  target=(mode==='scheduled'?'/planner?message=':'/create?success=')+encodeURIComponent('Publication '+result.publicationId+': '+result.state);
 }catch(e){logFailure('tiktok.form.failed',e);target='/create?error='+encodeURIComponent(describeError(e));}
 redirect(target);
}
