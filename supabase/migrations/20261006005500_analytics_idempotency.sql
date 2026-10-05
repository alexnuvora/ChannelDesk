-- Prevent concurrent account-level analytics syncs from duplicating daily snapshots.
delete from public.analytics_snapshots a using public.analytics_snapshots b
where a.id>b.id and a.workspace_id=b.workspace_id and a.connection_id=b.connection_id and a.metric_date=b.metric_date
and a.external_post_id is null and b.external_post_id is null;
create unique index if not exists analytics_account_daily_unique on public.analytics_snapshots(workspace_id,connection_id,metric_date) where external_post_id is null;
