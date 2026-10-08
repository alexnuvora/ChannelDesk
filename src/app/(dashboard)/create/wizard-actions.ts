'use server';
import {createClient} from '@/lib/supabase/server';
import {createYouTubePublication,publishTikTok,publishMetaPost,getTikTokCreatorInfo} from '@/lib/publishing';
import {schedulePublication,youtubeSchedulePayload,tiktokSchedulePayload} from '@/lib/scheduling';
import {appOrigin} from '@/lib/config';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';

const request=z.object({
 accountIds:z.array(z.string().uuid()).min(1).max(30),
 mediaId:z.string().uuid().nullable(),
 caption:z.string().max(2200),
 title:z.string().trim().max(100),
 privacy:z.enum(['public','unlisted','private']),
 madeForKids:z.boolean(),
 tiktokPrivacy:z.enum(['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','SELF_ONLY']),
 scheduledFor:z.string().datetime({offset:true}).nullable(),
});
export type WizardRequest=z.input<typeof request>;
export type WizardOutcome={id:string;name:string;network:string;status:'published'|'scheduled'|'failed'|'processing';message:string};
export async function publishWizard(raw:WizardRequest):Promise<WizardOutcome[]>{
 const input=request.parse(raw),supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error('Sign in before publishing.');
 const {data:accounts,error}=await supabase.from('social_connections').select('id,network,display_name,workspace_id,scopes').in('id',input.accountIds).eq('active',true);
 if(error||!accounts||accounts.length!==input.accountIds.length)throw new Error('One or more selected accounts are unavailable.');
 const workspaceId=accounts[0].workspace_id;
 if(accounts.some(a=>a.workspace_id!==workspaceId))throw new Error('Select accounts from one workspace.');
 let asset:{id:string;mime_type:string}|null=null;
 if(input.mediaId){
  const {data,error:e}=await supabase.from('media_assets').select('id,mime_type').eq('id',input.mediaId).eq('workspace_id',workspaceId).maybeSingle();
  if(e||!data)throw new Error('Selected media is not available in this workspace.');asset=data;
 }
 if(accounts.some(a=>['youtube','tiktok','instagram'].includes(a.network))&&!asset)throw new Error('Select media for Instagram, TikTok and YouTube.');
 if(accounts.some(a=>['youtube','tiktok'].includes(a.network))&&!asset?.mime_type.startsWith('video/'))throw new Error('TikTok and YouTube require a video. Convert your image to MP4 before publishing.');
 if(input.scheduledFor&&Date.parse(input.scheduledFor)<=Date.now()+60000)throw new Error('Choose a time at least one minute in the future.');
 if(input.scheduledFor&&accounts.some(a=>a.network==='instagram'))throw new Error('Instagram scheduling is not yet enabled. Remove Instagram or publish now.');
 const mediaUrl=asset?appOrigin()+'/media/'+asset.id:undefined,results:WizardOutcome[]=[];
 // Each destination has its own unique idempotency key; never automatically retry uncertain outcomes.
 for(const account of accounts){
  const entry:WizardOutcome={id:account.id,name:account.display_name,network:account.network,status:'failed',message:''};
  const requestId=randomUUID();
  try{
   if(account.network==='facebook'||account.network==='instagram'){
    const required=account.network==='facebook'?'pages_manage_posts':'instagram_content_publish';
    if(!account.scopes?.includes(required))throw new Error('Publishing permission missing. Reconnect this account.');
    if(input.scheduledFor){
     if(account.network!=='facebook')throw new Error('Scheduling unavailable for this network.');
     const p=await schedulePublication({connectionId:account.id,scheduledFor:input.scheduledFor,requestId,payload:{message:input.caption,...(mediaUrl?{mediaUrl}:{})}},workspaceId,user.id);
     entry.status='scheduled';entry.message='Planner publication '+p.publicationId;
    }else{
     const p=await publishMetaPost(account.id,workspaceId,user.id,{text:input.caption,mediaUrl,requestId});
     entry.status='published';entry.message='Post '+p.externalPostId;
    }
   }else if(account.network==='youtube'){
    const payload=youtubeSchedulePayload.parse({title:input.title||input.caption.slice(0,100),description:input.caption,privacy:input.privacy,madeForKids:input.madeForKids,tags:[]});
    const p=input.scheduledFor?await schedulePublication({connectionId:account.id,mediaAssetId:asset!.id,scheduledFor:input.scheduledFor,requestId,payload},workspaceId,user.id):await createYouTubePublication({connectionId:account.id,mediaUrl:mediaUrl!,requestId,...payload},workspaceId,user.id);
    entry.status=p.state==='scheduled'?'scheduled':p.state==='published'?'published':p.state==='failed'?'failed':'processing';entry.message='Publication '+p.publicationId+': '+p.state;
   }else if(account.network==='tiktok'){
    const payload=tiktokSchedulePayload.parse({caption:input.caption,privacy:input.tiktokPrivacy,disableComment:false,disableDuet:false,disableStitch:false});
    const creator=await getTikTokCreatorInfo(account.id,workspaceId,user.id);
    if(!creator.privacy_level_options?.includes(payload.privacy))throw new Error('Selected TikTok visibility is not available on this account.');
    const p=input.scheduledFor?await schedulePublication({connectionId:account.id,mediaAssetId:asset!.id,scheduledFor:input.scheduledFor,requestId,payload},workspaceId,user.id):await publishTikTok({connectionId:account.id,mediaUrl:mediaUrl!,requestId,...payload},workspaceId,user.id);
    entry.status=p.state==='scheduled'?'scheduled':p.state==='published'?'published':p.state==='failed'?'failed':'processing';entry.message='Publication '+p.publicationId+': '+p.state;
   }else throw new Error('This channel is not supported by the composer yet.');
  }catch(e){entry.status='failed';entry.message=e instanceof Error?e.message:'Publication failed. Check the Planner before retrying.';}
  results.push(entry);
 }
 return results;
}
