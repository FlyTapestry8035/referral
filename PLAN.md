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
- [ ] /dashboard layout with tabs (Testers, Feedback, Codes, Missions, Settings, more), program switcher
- [ ] Title + takeaway sentence, five KPI tiles, testing funnel (Recharts)
- [ ] Tester sheet: row numbers, grid lines, sticky header, sort (aria-sort), search, stage filter, count
- [ ] Range selection (drag, Shift+click, Escape) + status bar (count, sum, average)
- [ ] In-cell bars, stage dots, column visibility, CSV export, inline edit name/notes (optimistic)
- [ ] Row side panel: profile, feedback timeline, 0–5 rating, notes, resend invite, revoke access
- [ ] Realtime updates
- [ ] Codes tab: create, limits, expiry, revoke, usage count, invite by email
- [ ] Missions tab: CRUD + ordering; tester /app checklist
- [ ] Light/dark mode, phone width
- [ ] `npm run seed`
- [ ] Lint, typecheck, tests green → commit

## Phase 3 – Feedback & email
- [ ] Tester feedback form + floating Report widget (screenshot → Storage, URL, UA, viewport)
- [ ] Embeddable `<script>` widget + public ingest endpoint
- [ ] Feedback inbox: filter, search, severity, status, tags, duplicate merge
- [ ] Signed tokens (HMAC, 7 days) → /f/TOKEN feedback without login; unsubscribe link
- [ ] /api/cron/digest (CRON_SECRET, due logic, send hour when hourly, idempotent via email_log)
- [ ] Digest email (react-email), settings page + test email
- [ ] /api/cron/nudges (inactive N days / stuck 5 days, max 1 per week)
- [ ] Close-the-loop email on status → fixed
- [ ] Lint, typecheck, tests green → commit

## Phase 4 – Features 7–10 & polish
- [ ] Rewards rules + automatic awarding + badges
- [ ] Nominations (helpfulness threshold, 3 each, approval queue → invite)
- [ ] Terms versioning + re-accept gate
- [ ] Webhooks (HMAC signature, retries with backoff via deliveries table + cron)
- [ ] Multiple programs per company, roles enforced by RLS
- [ ] Audit log (triggers) + audit page
- [ ] README (setup, deploy, Needs you), final report
- [ ] Lint, typecheck, tests green → commit
