'use server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const input=z.object({workspaceId:z.string().uuid(),imageId:z.string().uuid(),effect:z.enum(['none','zoom','pan','pulse']),caption:z.string().max(150),sound:z.enum(['none','ambient','upload']),audioKey:z.string().max(400).optional()});
export async function queueVideoRender(raw:z.input<typeof input>){
 const p=input.parse(raw),s=await createClient(),{data:{user}}=await s.auth.getUser();
 if(!user)throw new Error('Sign in to render video.');
 const {data:member}=await s.from('workspace_members').select('role').eq('workspace_id',p.workspaceId).eq('user_id',user.id).maybeSingle();
 if(!member||!['owner','admin','editor'].includes(member.role))throw new Error('Editor permission required.');
 const {data:image,error}=await s.from('media_assets').select('id,mime_type').eq('id',p.imageId).eq('workspace_id',p.workspaceId).maybeSingle();
 if(error||!image?.mime_type?.startsWith('image/'))throw new Error('Choose a workspace image.');
 if(p.sound==='upload'){
  if(!p.audioKey||!p.audioKey.startsWith(p.workspaceId+'/'+user.id+'/')||p.audioKey.includes('..'))throw new Error('Invalid audio upload location.');
  const {data:entry,error:audioError}=await s.storage.from('channeldesk-audio').info(p.audioKey);
  if(audioError||!entry||!['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm'].includes(entry.metadata?.mimetype||'')||entry.metadata?.size>31457280)throw new Error('Audio must be a supported file under 30 MB.');
 }
 const key='render:'+randomUUID();
 const {data:jobId,error:jobError}=await s.rpc('enqueue_platform_job',{p_workspace_id:p.workspaceId,p_created_by:user.id,p_kind:'media.video_render',p_provider:'ffmpeg',p_idempotency_key:key,p_payload:{imageId:p.imageId,effect:p.effect,caption:p.caption,sound:p.sound,...(p.sound==='upload'?{audioKey:p.audioKey}:{})}});
 if(jobError||!jobId)throw new Error('Unable to queue video render: '+(jobError?.message||'unknown error'));
 return {jobId:String(jobId)};
}
