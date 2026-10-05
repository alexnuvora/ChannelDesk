# ChannelDesk architecture

## Principles

1. Workspace isolation is enforced in PostgreSQL, not only in UI code.
2. OAuth access and refresh tokens are encrypted before persistence.
3. A publication is platform-neutral; publication targets carry platform-specific payloads.
4. Publishing is asynchronous and idempotent. Retries must never duplicate a successful post.
5. Media keeps provenance and rights evidence so research-to-clip workflows are auditable.
6. Every privileged mutation writes an audit event.
7. MCP actions use the same application service layer as the dashboard.

## Layers

- Web: Next.js dashboard, planner, composer, analytics and settings.
- API/application: validation, permissions, approvals and orchestration.
- Platform adapters: OAuth, validation, publish, delete, insights and webhooks per network.
- Worker: due-post claiming, publishing, retry/backoff, refresh and analytics sync.
- Media: upload, normalization, crop/trim, captions, thumbnails and provenance.
- MCP: discover accounts, draft, schedule, publish, inspect status and analytics.

## Initial MCP surface

- list_workspaces
- list_social_accounts
- create_draft
- attach_media
- validate_publication
- schedule_publication
- publish_now
- get_publication_status
- cancel_scheduled_publication
- get_calendar
- get_analytics_summary
- get_best_times
- create_clip_from_source

Destructive or public-facing actions remain explicit and auditable.
