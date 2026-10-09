# ChannelDesk product improvement release

This release improves daily usability and ships working Planner, reporting, and SmartLinks workflows. The wider Metricool capability matrix is in `METRICOOL-PARITY-ROADMAP.md`. Metricool's public site was reviewed on 9 October 2026; its public positioning includes planner, approvals, reports, inbox, flows, SmartLinks, ads, and broad social integrations. A public marketing page cannot prove the behavior of each authenticated feature. ChannelDesk does not yet have parity in every area.

## Implemented

- Persistent workspace navigation, mobile menu, keyboard search, and direct overview. Overview uses workspace-scoped posts, connection count, inbox count, review queue, upcoming posts, and a first-use checklist. Unavailable data remains unavailable rather than appearing as zero.
- Planner day/week/month/list modes, draft and network filters, accessible post dialog, deep links, rescheduling form, and explicit timezone. Invalid dates and nonexistent local times at a daylight-saving change are rejected.
- Workspace-scoped CSV and `.ics` exports. CSV includes unscheduled drafts, delivery targets and statuses. Spreadsheet formulas are neutralized. Calendar files preserve the scheduled instant and cancellation/uncertainty states. These downloads are snapshots, not subscriptions.
- CSV import of 1–100 unscheduled caption drafts, with preview and stable IDs. A database function checks workspace role and makes insertion and audit atomic. Retries with the same preview do not duplicate drafts. Imported drafts can seed the composer; accounts, media and publishing remain explicit steps.
- Reporting with selectable UTC dates, source-based metric previews, unavailable-value handling, and full CSV export. Saved report templates are displayed truthfully; automated email delivery is not claimed as working.
- SmartLinks builder with atomic page creation and visibility changes, secure destinations, disabled-link enforcement, and atomic click counters. Recognized crawlers and previews do not increment counters. Referrer data is reduced to its origin.
- Password recovery and clearer sign-in controls. AI video polling no longer starts overlapping refresh requests.

Three database migrations must apply with the GitHub Supabase workflow before draft import and the new SmartLinks controls can work in production. The UI and backend were not tested with a real connected user account in this task. Do not describe the new provider features as deployed until workflow and live checks confirm them.

## Evidence

- The suite executes PGlite migrations and tests cross-workspace roles, atomic SmartLink operations, draft import replay, export handling, and date validation.
- Browser fixture captures are in `artifacts/design/`. Fixtures are labelled and contain no live customer data. Browser checks covered desktop/mobile Planner and Overview layout, keyboard search, dialog Escape, draft CSV preview, and SmartLinks form controls. Login was captured from the running app.
- Production and migrations must be checked after the GitHub push. Live publishing, ad spend, and connection creation were not used as test operations.

## Next work

Complete each social network through connect, refresh, compose, deliver, reconcile and measured analytics. Then build inbox coverage, collaborative approvals, scheduled report delivery, ads reporting, campaign tagging, executable automation, and billing. Each feature needs real permission checks, failure states, provider sandbox tests and a connected-account production check. Route existence or a database table alone does not count as a released integration.

The GitHub Video Render Worker was failing on the base `main` commit at its credential-check step. The integration token can read run metadata, but lacks permission to list or set Actions secrets, and the log artifact host is blocked. This is a separate operational blocker; adding a dummy key or skipping the credential check would hide a broken worker.
