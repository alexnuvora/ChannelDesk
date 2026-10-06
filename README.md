# ChannelDesk

Next.js, Supabase and MCP social publishing app. YouTube and TikTok use a shared Planner queue. Media storage, optional draft review, YouTube comments and YouTube Analytics are implemented. Other social adapters and several platform screens remain foundations rather than complete integrations.

## Development

Use Node 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, and configure the ChannelDesk Supabase project. Run `npm run dev`.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Tests use isolated PostgreSQL databases and do not contact social accounts.

## ChatGPT

MCP endpoint: `https://channel-desk-61xl.vercel.app/mcp`. Sign in and approve scopes. Use `list_workspaces`, `list_social_accounts` and `list_media` to choose the destination and asset. Publishing needs an owner/admin/editor role and publishing scope. Dashboard and MCP schedules share the same queue.

## Deployment

Pushes to main run CI and the Supabase migration workflow for `zmwfyrqbgtvtuajbjnzm`. Vercel needs its own server-only Supabase key and the existing token encryption key. The GitHub CLI token is not a Vercel runtime key.

The GitHub `ChannelDesk Scheduler` workflow checks the queue every five minutes using a short-lived authentication ticket. A completed migration triggers only a dry run. GitHub timing is approximate; stale or uncertain deliveries require review, with no blind re-uploads. No extra static scheduler secret is required.

See [the current audit](docs/AUDIT-2026-10-06.md) for repaired defects, verification and remaining feature boundaries. Keep `TOKEN_ENCRYPTION_KEY` stable unless encrypted credentials are migrated deliberately.
