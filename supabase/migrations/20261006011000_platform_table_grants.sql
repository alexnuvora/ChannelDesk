-- Explicit API grants for platform tables. RLS remains the authorization boundary.
grant select on public.content_templates,public.approval_requests,public.inbox_threads,public.inbox_messages,public.analytics_snapshots,public.competitors,public.smart_links,public.smart_link_items,public.automation_flows,public.saved_reports to authenticated;
grant insert,update,delete on public.content_templates,public.inbox_threads,public.inbox_messages,public.competitors,public.smart_links,public.smart_link_items,public.automation_flows,public.saved_reports to authenticated;
grant insert,update on public.approval_requests to authenticated;
grant insert,update,delete on public.analytics_snapshots to authenticated;
grant usage,select on sequence public.analytics_snapshots_id_seq to authenticated;

-- Revalidated after restoring the service-role test context.
