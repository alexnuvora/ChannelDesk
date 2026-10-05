'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {createYouTubePublication} from '@/lib/publishing';
import {logFailure} from '@/lib/config';
import {ZodError} from 'zod';
export async function submitYouTube(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const connectionId=String(formData.get('connectionId')||'');const {data:connection}=await supabase.from('social_connections').select('workspace_id').eq('id',connectionId).eq('network','youtube').eq('active',true).maybeSingle();if(!connection)redirect('/create?error='+encodeURIComponent('Choose an active YouTube channel.'));
 let message='',errorMessage='';
 try{
  const kids=String(formData.get('madeForKids')||'');if(!['yes','no'].includes(kids))throw new Error('Select whether the video is made for kids.');const scheduled=String(formData.get('scheduledFor')||'');
  const result=await createYouTubePublication({connectionId,title:String(formData.get('title')||''),description:String(formData.get('description')||''),mediaUrl:String(formData.get('mediaUrl')||''),privacy:String(formData.get('privacy')||'') as 'private'|'unlisted'|'public',madeForKids:kids==='yes',scheduledFor:scheduled||undefined,requestId:String(formData.get('requestId')||'')},connection.workspace_id,user.id);
  if(result.error||['failed','needs_review'].includes(result.state))errorMessage=`${result.error||'Check the existing publication before retrying.'} Publication: ${result.publicationId}`;
  else message=`Publication ${result.publicationId}: ${result.state}${result.videoId?' · Video '+result.videoId:''}`;
 }catch(e){logFailure('youtube.form.failed',e);errorMessage=e instanceof ZodError?e.issues.map(i=>i.message).join(' '):e instanceof Error?e.message:'Publishing could not be completed.';}
 redirect('/create?'+(errorMessage?'error='+encodeURIComponent(errorMessage):'success='+encodeURIComponent(message)));
}
