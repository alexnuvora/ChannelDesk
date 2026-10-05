# ChannelDesk

Next.js, Supabase and MCP social publishing app. The current release connects and publishes to YouTube, including YouTube-native future scheduling. Other social adapters, media uploads and analytics are planned; this is not full Metricool parity.

## Development

Use Node 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, and fill the environment variables from the ChannelDesk Supabase project. Run `npm run dev`.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Tests use an isolated PostgreSQL engine and mocks; they do not contact social accounts or publish anything.

## ChatGPT connection

Connect the remote MCP endpoint `https://channel-desk-61xl.vercel.app/mcp` from ChatGPT. Sign in to ChannelDesk and approve the requested permissions. The server exposes standards-based OAuth discovery, PKCE and rotating refresh tokens. Use `list_workspaces` followed by `list_social_accounts` to choose the exact destination. Publication tools require publishing scope and an owner/admin/editor workspace role.

## Deployment

Pushes to main run CI and the existing Supabase CLI migration workflow for `zmwfyrqbgtvtuajbjnzm`. Vercel requires its own server-only `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`; the GitHub CLI token does not supply that variable. Keep production and preview secrets separate. See [the audit and setup checklist](docs/AUDIT-2026-10-05.md).

No secrets should be committed. Keep `TOKEN_ENCRYPTION_KEY` stable unless you also migrate encrypted connection tokens.
