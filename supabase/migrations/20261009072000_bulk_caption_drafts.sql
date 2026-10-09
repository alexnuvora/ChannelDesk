-- Retry-safe caption imports. Permissions, content and audit commit together.
create or replace function public.import_caption_drafts(p_workspace_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();total integer;saved integer;
begin
 if caller is null or not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=caller and role in ('owner','admin','editor')) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid captions' using errcode='22023';end if;
 total:=jsonb_array_length(p_rows);
 if total not between 1 and 100 then raise exception 'Choose 1-100 captions' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where x->>'id' is null or x->>'caption' is null or length(trim(x->>'caption')) not between 1 and 2200) then raise exception 'Invalid caption' using errcode='22023';end if;
 if (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p_rows) x)<>total then raise exception 'Duplicate draft IDs' using errcode='22023';end if;
 insert into public.publications(id,workspace_id,author_id,text,state)
 select (x->>'id')::uuid,p_workspace_id,caller,trim(x->>'caption'),'draft' from jsonb_array_elements(p_rows) x
 on conflict(id) do nothing;
 get diagnostics saved = row_count;
 if (select count(*) from public.publications p join jsonb_array_elements(p_rows) x on p.id=(x->>'id')::uuid where p.workspace_id=p_workspace_id and p.author_id=caller and p.state='draft' and p.text=trim(x->>'caption'))<>total then raise exception 'Draft IDs conflict with existing content' using errcode='22023';end if;
 if saved>0 then insert into public.audit_events(workspace_id,actor_id,action,entity_type,entity_id,metadata) values(p_workspace_id,caller,'publication.drafts_imported','workspace',p_workspace_id::text,jsonb_build_object('count',saved));end if;
 return total;
end $$;
revoke all on function public.import_caption_drafts(uuid,jsonb) from public,anon;
grant execute on function public.import_caption_drafts(uuid,jsonb) to authenticated;
