-- All page creation and visibility changes are authorized and audited atomically.
create or replace function public.create_smart_link_page(p_workspace_id uuid,p_slug text,p_title text,p_description text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();new_id uuid;
begin
 if caller is null or not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=caller and role in ('owner','admin','editor')) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_slug is null or p_slug !~ '^[a-z0-9-]{3,80}$' or p_title is null or length(trim(p_title)) not between 1 and 160 or length(coalesce(p_description,''))>500 then raise exception 'Invalid page details' using errcode='22023';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Choose destinations' using errcode='22023';end if;
 if jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Choose 1-20 destinations' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'label' is null or length(trim(x->>'label')) not between 1 and 120 or x->>'url' is null or x->>'url' !~ '^https?://[^/?#[:space:]@]+([/?#]|$)') then raise exception 'Invalid destination' using errcode='22023';end if;
 insert into public.smart_links(workspace_id,slug,title,description,active) values(p_workspace_id,p_slug,trim(p_title),nullif(trim(p_description),''),true) returning id into new_id;
 insert into public.smart_link_items(smart_link_id,label,url,position,active) select new_id,trim(x->>'label'),x->>'url',(n-1)::int,true from jsonb_array_elements(p_items) with ordinality as entries(x,n);
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,caller,'smart_link.created','smart_link',new_id::text,jsonb_build_object('destinations',jsonb_array_length(p_items)));
 return new_id;
end $$;
revoke all on function public.create_smart_link_page(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.create_smart_link_page(uuid,text,text,text,jsonb) to authenticated;
create or replace function public.set_smart_link_visibility(p_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();workspace uuid;
begin
 select workspace_id into workspace from public.smart_links where id=p_id for update;
 if caller is null or workspace is null or not exists(select 1 from public.workspace_members where workspace_id=workspace and user_id=caller and role in ('owner','admin','editor')) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_active is null then raise exception 'Choose visibility' using errcode='22023';end if;
 update public.smart_links set active=p_active,updated_at=now() where id=p_id;
 insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(workspace,caller,'smart_link.visibility_changed','smart_link',p_id::text,jsonb_build_object('active',p_active));
end $$;
revoke all on function public.set_smart_link_visibility(uuid,boolean) from public,anon;
grant execute on function public.set_smart_link_visibility(uuid,boolean) to authenticated;
