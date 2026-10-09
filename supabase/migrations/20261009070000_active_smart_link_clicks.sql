-- Disabled destinations must stay disabled, including when following old links.
-- Keep the click event and aggregate counter in the same transaction.
create or replace function public.record_smart_link_click(p_slug text,p_item_id uuid,p_referrer text default null,p_user_agent text default null)
returns text language plpgsql security definer set search_path='' as $$
declare target text; link_id uuid;
begin
 select i.url,i.smart_link_id into target,link_id
 from public.smart_link_items i join public.smart_links l on l.id=i.smart_link_id
 where i.id=p_item_id and l.slug=p_slug and l.active=true and i.active=true;
 if target is null or target !~ '^https?://' then return null; end if;
 insert into public.smart_link_clicks(smart_link_id,item_id,referrer,user_agent)
 values(link_id,p_item_id,left(p_referrer,2000),left(p_user_agent,1000));
 update public.smart_link_items set clicks=clicks+1 where id=p_item_id;
 return target;
end $$;
revoke all on function public.record_smart_link_click(text,uuid,text,text) from public,authenticated;
grant execute on function public.record_smart_link_click(text,uuid,text,text) to service_role;
