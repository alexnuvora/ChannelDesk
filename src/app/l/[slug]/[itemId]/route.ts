import {NextResponse} from 'next/server';
import {admin} from '@/lib/mcp-oauth';
import {smartLinkDestination,referrerOrigin} from '@/lib/smart-link-url';
export async function GET(req:Request,{params}:{params:Promise<{slug:string;itemId:string}>}){
 const {slug,itemId}=await params;
 if(!/^[a-z0-9-]{3,80}$/.test(slug)||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId))return new Response('Link not found',{status:404});
 const db=admin();const {data:item,error}=await db.from('smart_link_items').select('url,smart_link_id,smart_links!inner(slug,active)').eq('id',itemId).eq('active',true).eq('smart_links.slug',slug).eq('smart_links.active',true).maybeSingle();
 if(error)return new Response('This link is temporarily unavailable',{status:503});
 const destination=item&&smartLinkDestination(item.url);if(!destination)return new Response('Link not found',{status:404});
 const agent=req.headers.get('user-agent')||'';
 let target=destination;
 if(!/bot|crawler|spider|preview|headless|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot/i.test(agent)){
  const recorded=await db.rpc('record_smart_link_click',{p_slug:slug,p_item_id:itemId,p_referrer:referrerOrigin(req.headers.get('referer')),p_user_agent:agent.slice(0,1000)});
  if(recorded.error)return new Response('This link is temporarily unavailable',{status:503});
  const validated=typeof recorded.data==='string'?smartLinkDestination(recorded.data):null;
  if(!validated)return new Response('Link not found',{status:404});target=validated;
 }
 const response=NextResponse.redirect(target,302);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
