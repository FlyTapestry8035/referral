# Referral – build plan

Status legend: `[x]` done and verified by running it, `[~]` built but only partly verified (see notes), `[ ]` not done.

## Phase 1 – Foundation
- [x] Next.js (App Router, TS strict), Tailwind v4, shadcn/ui components, Vitest
- [x] Supabase local config (public sign-ups off, email confirmations on, 12-char passwords)
- [x] Migrations: all tables from the spec, enums, indexes
- [x] RLS on every table (member / role / tester scoping) + helper functions
- [x] `recompute_tester_stats` + triggers on feedback and tester_missions
- [x] `redeem_referral_code` (row lock, generic failure)
- [x] Supabase clients (browser, server, admin/service-role server-only), proxy (session refresh)
- [x] Code generator (REF-XXXX-XXXX, crypto, no look-alikes)
- [x] /join sign-up (Zod, password strength, terms checkbox), verification email via generateLink
- [~] /login, /forgot-password, /reset-password, /auth/confirm (login + confirm verified in browser; reset flow verified in Phase 4 e2e)
- [~] Rate limiting (Upstash when configured, in-memory fallback) — verified in the Phase 4 browser run
- [x] Tests: stats logic (TS + SQL), code generator, tokens, validation, RLS (tester isolation, viewer read-only, cross-company)
- [x] Lint, typecheck, tests green → commit

## Phase 2 – Dashboard, codes, missions
- [x] /dashboard layout with tabs (Testers, Feedback, Codes, Missions, Settings, more), program switcher
- [x] Title + takeaway sentence, five KPI tiles, testing funnel (Recharts)
- [x] Tester sheet: row numbers, grid lines, sticky header, sort (aria-sort), search, stage filter, count
- [x] Range selection (drag, Shift+click, Escape) + status bar (count, sum, average)
- [x] In-cell bars, stage dots, column visibility, CSV export, inline edit name/notes (optimistic)
- [x] Row side panel: profile, feedback timeline, 0–5 rating, notes, resend invite, revoke access
- [x] Realtime updates
- [x] Codes tab: create, limits, expiry, revoke, usage count, invite by email
- [x] Missions tab: CRUD + ordering; tester /app checklist
- [x] Light/dark mode, phone width
- [x] `npm run seed`
- [x] Lint, typecheck, tests green → commit

## Phase 3 – Feedback & email
- [x] Tester feedback form + floating Report widget (screenshot → Storage, URL, UA, viewport)
- [x] Embeddable `<script>` widget + public ingest endpoint
- [x] Feedback inbox: filter, search, severity, status, tags, duplicate merge
- [x] Signed tokens (HMAC, 7 days) → /f/TOKEN feedback without login; unsubscribe link
- [x] /api/cron/digest (CRON_SECRET, due logic, send hour when hourly, idempotent via email_log)
- [x] Digest email (react-email), settings page + test email
- [x] /api/cron/nudges (inactive N days / stuck 5 days, max 1 per week)
- [x] Close-the-loop email on status → fixed
- [x] Lint, typecheck, tests green → commit

## Phase 4 – Features 7–10 & polish
- [ ] Rewards rules + automatic awarding + badges
- [ ] Nominations (helpfulness threshold, 3 each, approval queue → invite)
- [ ] Terms versioning + re-accept gate
- [ ] Webhooks (HMAC signature, retries with backoff via deliveries table + cron)
- [ ] Multiple programs per company, roles enforced by RLS
- [ ] Audit log (triggers) + audit page
- [ ] README (setup, deploy, Needs you), final report
- [ ] Lint, typecheck, tests green → commit
