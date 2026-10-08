# ChannelDesk — Metricool capability parity and simpler UX

Baseline: 8 October 2026. Source: https://metricool.com/ and https://help.metricool.com/ (public product documentation). This is a capability benchmark, **not** an instruction to copy proprietary code, branding, or exact visual assets.

## Current verified baseline

See `README.md` and `docs/AUDIT-2026-10-06.md`. YouTube and TikTok use a shared production-minded Planner queue, with account security, media handling, approval foundations, YouTube analytics/comments, and MCP. Other network adapters, automation execution, public SmartLinks, competitor metrics and report delivery remain incomplete. A route or database table is **not** equivalent to a working integration.

## Feature parity checklist and acceptance criteria

| Domain | Parity capabilities and user acceptance |
| --- | --- |
| Onboarding | Workspace creation, guided brand setup, provider OAuth with least-privilege scopes, refresh/reconnect, permission health, timezone selection, responsive empty states. Complete a connected-account onboarding from a fresh user. |
| Networks | Facebook Pages, Instagram Professional, Threads, LinkedIn profiles/pages, Pinterest, X, Bluesky, TikTok, YouTube, Google Business Profile and (where feasible) Twitch. Explicit per-network read/write capabilities; implement official provider APIs and approval requirements, never simulate live publishing. |
| Planner | Month/week/day/list, timezone-correct drag-and-drop, drafts, previews and network-specific composer, drafts library, bulk CSV import, duplicate/cross-post with per-network customization, media library, tagged campaigns, best times from measured metrics, recurring lists, scheduled first comments where supported, audit and approvals. Real scheduler execution and idempotent provider delivery. |
| Create / AI | Text idea generation, rewrite/shorten, hashtags, tone, captions, per-network copy, image/video creation with supported provider, progress/error/retry, asset upload, thumbnail/crop/alt text and provider disclosures. AI results must save as drafts rather than bypass validation. |
| Analytics | Network metrics, real dated snapshots, historical graphs, network-specific KPIs, content ranking, demographics where scopes permit, best posting times, cross-channel comparison, date range, CSV. Missing data clearly marked unavailable; never show dummy stats as real. |
| Competitors | Watchlists, owned/authorized/publicly available metrics by network, historical changes, explicit source + freshness and per-network limitations. Never scrape private data or invent values. |
| Reporting | Saved templates, brand/client filters, PDF/CSV export, reliable scheduled delivery, agency white-label output, source time/freshness, permissions and audit. |
| Inbox | OAuth-backed messages, comments, mention streams where allowed, thread state, assignment, saved replies, safe sending, webhooks/poll reconciliation, deduplication, idempotence, permissions, failure review. |
| Flows | Usable builder plus executable event engine, trigger filtering, conditions, delayed steps, consent checks, platform-safe DM/comment actions, rate limits, retries, kill switch, execution history and test mode. |
| SmartLinks | User-created public bio pages, themes, link blocks, slug and custom domain validation, mobile preview, click tracking with bot filtering and privacy controls. |
| Ads | Connect Meta/Google/TikTok ad accounts; campaign spend/performance first, then creation and changes where API grants permit, explicit ad account permissions, budgets, confirmation and audit. |
| Collaboration | Multiple brands, team roles, invitations, client approval links, comments, notifications, agency views, tenant boundaries and client-specific reports. |
| ChatGPT / MCP | Scoped OAuth, list brands/channels/media, drafts, schedule/reschedule/cancel, measured analytics, best times, campaign/report lookups, errors; no broad unrestricted write grants. |
| Billing / operations | Subscription plans, usage metering, billing self-service, quota enforcement, connectivity monitors, worker observability, GDPR retention/deletion, accessible mobile experience, support diagnostics. |

## Delivery order (end-to-end, not visual-only)

1. **Reliability and visibility:** Keep existing YouTube/TikTok publishing stable; fix failing builds and AI-video generation; verify background queue, OAuth boundaries and per-workspace isolation. Replace demonstrative UI with real analytics and correct empty states.
2. **Network connections:** Release one provider at a time with complete connect → refresh → compose → post → status → analytics tests. Prioritize Meta (Facebook/Instagram), LinkedIn, then Threads/Pinterest/GBP/Bluesky/X. Provider app reviews are external gates.
3. **Best-in-class planner:** Unified calendar, per-network previews/settings, drag/drop, bulk queue, templates, best times, approval UX, accessible mobile controls.
4. **Analytics and reporting:** Accurate cross-platform ingests, performance comparisons, real competitor data, export and scheduled branded reports.
5. **Customer engagement:** Inbox adapter/webhook coverage, saved replies, assignments; then live flows with simulation and guardrails.
6. **Growth:** SmartLinks end-to-end, campaign tagging, ads reporting and management with spending confirmation.
7. **AI and automation depth:** Harden Agnes video jobs and graceful failures, content tools, MCP extensions, notifications, agency views and mobile polish.

## Quality gates for every feature

- Works in the deployed application with real permitted provider API, not just local UI or a migration.
- Isolation: authenticated workspace, role and write checks; encrypted tokens never reach client components; RLS checked using two tenants.
- Idempotency and reconciliation: retries cannot duplicate posts, comments, replies, messages, bills or ad spend.
- Unavailable provider scopes/permissions show a clear locked/limited status, not misleading success.
- Explicit loading, empty, error, offline and re-authentication states.
- Responsive, keyboard-accessible UI with observable server failures and sensible help text.
- Tests: lint, typecheck, unit/integration, production build, schema migration assertions, provider sandbox smoke tests; manual production verification only with approval.
- Mark capability **live** only after deployment plus connected-account verification.

## Design rules: simpler than the benchmark

Primary customer navigation: Overview, Plan & Create, Performance, Engage, Automate, Manage. Secondary functionality (SmartLinks, Ads, Reports, Teams) lives in logical contextual sub-navigation, but remains directly discoverable via global search and quick actions.

Default homepage answers: What requires attention? What is due today? How are recent posts doing? What is my next recommended action? Build a first-use checklist for a new workspace and use progressive disclosure rather than overwhelming new customers with empty enterprise controls.

Avoid hardcoded customer names, sample figures masquerading as analytics, nonfunctional CTA buttons, or menus that imply unsupported provider capability.

## Implementation tracking

Use issues or PRs for each feature with explicit owner, schema changes, API scopes, UI, backend, tests, rollout flags and evidence. Do not mark this roadmap as shipped functionality. The benchmark will evolve over time; update the matrix when external platform APIs change.
