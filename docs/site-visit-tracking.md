# CollabCy lifetime site visits — prepared, not enabled

There is no historical site-wide visit dataset in the existing schema. The old
`collabcy-preview-visits` counter was browser-local. Product `click_count` values
count outbound product website clicks and are not used as site visits.

The new total starts with the first successfully recorded site visit, with no
backfill or fabricated history. A visit follows the former counter's tab-session
definition: one arrival per browser-tab session, not a unique person or a pageview.
Navigation, reloads, React Strict Mode, and 30-second refreshes do not increment
that session again. A later independent session counts again. Session storage
holds only a random idempotency UUID, never the total. When storage is blocked,
the UUID survives rerenders in memory; a full reload starts a new session.

## Database dependency — do not apply without approval

`supabase/migrations/20261011000000_collabcy_site_visits.sql` is unapplied.
It adds a singleton bigint total and a private UUID session ledger. A transactional
insert with `ON CONFLICT DO NOTHING` increments the total only for a new session.
Concurrent duplicate requests cannot double-count. Both tables have RLS enabled
and no public table access. Only the service role can execute the two RPCs. The
server-only API returns the aggregate and its tracking start date, never sessions.

After explicit approval, apply the migration through the project's normal database
workflow, then set the server-only `COLLABCY_SITE_VISITS_ENABLED=true` in production.
No environment setting has been changed by this implementation. Only HTTPS requests
on `collabcy.app` or `www.collabcy.app` can record or read through this endpoint;
localhost and preview hosts are rejected before accessing the database.

Until then, the ticker intentionally shows **Currently unavailable**, not zero.
The shared frontend counter refreshes at most every 30 seconds while visible,
coalesces in-flight requests, and retries failed recording with the same UUID.
Its refresh request is read-only after the session is successfully recorded.

This is a visit counter, not verified human analytics: deliberate clients/bots can
create fresh sessions. Session UUIDs contain no account IDs, IPs, or personal data.
Keep the deduplication ledger while those session IDs can be retried; deleting it
would allow previously counted sessions to count again. Production SQL concurrency
and live aggregate verification remain pending the migration approval.
