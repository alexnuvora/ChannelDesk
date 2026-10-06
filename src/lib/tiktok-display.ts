import {admin,assertWorkspaceAccess} from './mcp-oauth';
import {tiktokAccessToken,type Connection} from './publishing';

const PROFILE_FIELDS=['open_id','union_id','avatar_url','display_name','username','profile_deep_link','bio_description','is_verified','follower_count','following_count','likes_count','video_count'];
const VIDEO_FIELDS=['id','create_time','cover_image_url','share_url','video_description','duration','height','width','title','embed_link','like_count','comment_count','share_count','view_count','is_aigc'];

async function connectionWithScopes(connectionId:string,workspaceId:string,actorId:string,required:string[]){
 await assertWorkspaceAccess(actorId,workspaceId,true);
 const {data,error}=await admin().from('social_connections').select('*').eq('id',connectionId).eq('workspace_id',workspaceId).eq('network','tiktok').eq('active',true).maybeSingle();
 if(error||!data)throw new Error('Choose an active TikTok account in this workspace.');
 const scopes=Array.isArray(data.scopes)?data.scopes:[];
 const missing=required.filter(s=>!scopes.includes(s));
 if(missing.length)throw new Error('Reconnect TikTok and approve '+missing.join(', ')+' permission'+(missing.length>1?'s':'')+'.');
 return data as Connection;
}

export async function syncTikTokProfile(connectionId:string,workspaceId:string,actorId:string){
 const c=await connectionWithScopes(connectionId,workspaceId,actorId,['user.info.basic','user.info.profile','user.info.stats']);
 const access=await tiktokAccessToken(c);
 const url=new URL('https://open.tiktokapis.com/v2/user/info/');
 url.searchParams.set('fields',PROFILE_FIELDS.join(','));
 const r=await fetch(url,{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(20000),redirect:'error'});
 const body=await r.json().catch(()=>null);
 if(!r.ok||body?.error?.code!=='ok')throw new Error('TikTok profile sync failed'+(body?.error?.code?': '+body.error.code:'')+'.');
 const u=body?.data?.user||{};
 const {error}=await admin().from('tiktok_profiles').upsert({
  connection_id:c.id,workspace_id:workspaceId,username:u.username||null,avatar_url:u.avatar_url||null,profile_deep_link:u.profile_deep_link||null,
  bio_description:u.bio_description||null,is_verified:typeof u.is_verified==='boolean'?u.is_verified:null,
  follower_count:Number(u.follower_count||0),following_count:Number(u.following_count||0),likes_count:Number(u.likes_count||0),video_count:Number(u.video_count||0),
  synced_at:new Date().toISOString()
 },{onConflict:'connection_id'});
 if(error)throw error;
 return {connectionId:c.id,displayName:u.display_name||c.display_name,username:u.username||null,avatarUrl:u.avatar_url||null,profileDeepLink:u.profile_deep_link||null,bioDescription:u.bio_description||null,isVerified:!!u.is_verified,followerCount:Number(u.follower_count||0),followingCount:Number(u.following_count||0),likesCount:Number(u.likes_count||0),videoCount:Number(u.video_count||0)};
}

export async function syncTikTokVideos(connectionId:string,workspaceId:string,actorId:string,maxCount=20){
 const c=await connectionWithScopes(connectionId,workspaceId,actorId,['video.list']);
 const access=await tiktokAccessToken(c);
 const url=new URL('https://open.tiktokapis.com/v2/video/list/');
 url.searchParams.set('fields',VIDEO_FIELDS.join(','));
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({max_count:Math.max(1,Math.min(20,maxCount))}),signal:AbortSignal.timeout(30000),redirect:'error'});
 const body=await r.json().catch(()=>null);
 if(!r.ok||body?.error?.code!=='ok')throw new Error('TikTok video list sync failed'+(body?.error?.code?': '+body.error.code:'')+'.');
 const videos=Array.isArray(body?.data?.videos)?body.data.videos:[];
 if(videos.length){
  const rows=videos.map((v:any)=>({
   connection_id:c.id,workspace_id:workspaceId,video_id:String(v.id),title:v.title||null,description:v.video_description||null,
   cover_image_url:v.cover_image_url||null,share_url:v.share_url||null,embed_link:v.embed_link||null,
   create_time:v.create_time?new Date(Number(v.create_time)*1000).toISOString():null,duration_seconds:Number(v.duration||0)||null,width:Number(v.width||0)||null,height:Number(v.height||0)||null,
   like_count:Number(v.like_count||0),comment_count:Number(v.comment_count||0),share_count:Number(v.share_count||0),view_count:Number(v.view_count||0),
   is_aigc:typeof v.is_aigc==='boolean'?v.is_aigc:null,synced_at:new Date().toISOString()
  }));
  const {error}=await admin().from('tiktok_videos').upsert(rows,{onConflict:'connection_id,video_id'});if(error)throw error;
 }
 return {connectionId:c.id,count:videos.length,cursor:body?.data?.cursor??null,hasMore:!!body?.data?.has_more,videos};
}

export async function syncTikTokDisplayData(connectionId:string,workspaceId:string,actorId:string){
 const [profile,videos]=await Promise.all([syncTikTokProfile(connectionId,workspaceId,actorId),syncTikTokVideos(connectionId,workspaceId,actorId,20)]);
 await admin().from('audit_events').insert({workspace_id:workspaceId,actor_id:actorId,action:'tiktok.display_synced',entity_type:'social_connection',entity_id:connectionId,metadata:{videos:videos.count}});
 return {profile,videos};
}
