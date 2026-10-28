# Decisions

Choices made where the spec left room, in the order they came up. Each one is the simplest option that keeps the spec's intent.

## Platform

1. **Next.js 16.4 with Cache Components turned off.** `create-next-app` now enables `cacheComponents`, which requires every request-time read (cookies, session) to sit inside `<Suspense>` or `"use cache: private"`. Nearly every page in Referral is per-user, so the classic dynamic model (reading cookies makes a route dynamic) is simpler and less error-prone. Turning it on later is possible.
2. **Next 16 renamed middleware to `proxy`.** `src/proxy.ts` refreshes the Supabase session and redirects signed-out users away from `/app`, `/dashboard` and `/widget`. Real authorization is in pages, server actions and RLS.
3. **shadcn/ui components were written by hand.** The shadcn registry (ui.shadcn.com) is blocked from the build sandbox, so the CLI could not download components. The files in `src/components/ui` follow shadcn's new-york source on top of the same npm packages (`radix-ui`, `class-variance-authority`, `tailwind-merge`, `lucide-react`). `components.json` is included, so `npx shadcn add <component>` works on your machine.
4. **Native `<select>` instead of Radix Select** for dropdowns (stage filter, severity, roles). It is accessible, works with plain form posts and is better on phones.

## Auth and sign-up

5. **Supabase Auth settings.** Public sign-up is off (`[auth] enable_signup = false`), but the email provider must stay on (`[auth.email] enable_signup = true`), otherwise Supabase disables email *login* too. Found by the integration tests. In the hosted dashboard this is: Authentication → Sign In / Providers → "Allow new users to sign up" off, Email provider on, "Confirm email" on.
6. **Accounts are created with `auth.admin.generateLink({ type: "signup" })`.** That is the admin API call that creates an *unconfirmed* user and returns a verification token without sending anything. Referral then sends the verification email itself through Resend (link: `/auth/confirm?token_hash=…&type=signup`). The same pattern is used for password reset (`type: "recovery"`) and team invites (`type: "invite"`), so all email goes through one provider with one look.
7. **Code redemption happens before account creation** (as specified). If creating the account fails afterwards, `release_referral_code` gives the use back so a single-use code is not burned by, say, a typo'd email.
8. **Existing users can join another program** with a new code by entering their existing password. The password is verified before anything is attached, so nobody can add tester rows to a stranger's account.
9. **Terms are shown on /join after a well-formed code is typed.** Showing a program's terms reveals that a code is valid, so the lookup is rate limited (20 per 10 minutes per IP) and returns nothing for every kind of invalid code. With 31^8 ≈ 8.5×10^11 possible codes, probing is not practical. The form submits the terms version the tester saw; if the terms changed in between, sign-up stops and asks them to re-read.
10. **`redeem_referral_code` and `release_referral_code` can only be executed by the service role.** Clients (even signed-in ones) cannot call them, so codes cannot be probed through the API.
11. **Rate limits:** join 5 per 10 min, login 10 per 5 min, forgot-password 5 per 15 min, code lookup 20 per 10 min, tokenized feedback 20 per 10 min, all per IP. Upstash sliding window when `UPSTASH_REDIS_REST_*` is set, otherwise an in-memory fixed window (per server instance, fine for local dev only).
12. **Login errors are generic** ("Email or password is incorrect"), except an unconfirmed email, which gets a specific hint because the user can do something about it.

## Data model additions (beyond the spec's columns)

13. `programs`: `terms_version`, `terms_updated_at` (bumped by a trigger when `terms_text` changes), nudge settings (`nudges_enabled`, `nudge_inactive_days`, `nudge_stuck_days`) and nomination settings (`nomination_min_helpfulness` default 70, `nominations_per_tester` default 3).
14. `testers`: `terms_version_accepted`, `unsubscribed_at`, `access_revoked_at`. Unique on `(program_id, email)` and `(program_id, user_id)`. Plus a `terms_acceptances` history table (version + timestamp per acceptance).
15. `tester_missions`: `started_at`, `updated_at` (for "stuck on a mission" nudges and last activity).
16. `feedback`: `tags text[]`, `source` (app / widget / embed / email_link), `updated_at`.
17. `email_log`: `send_date` and `error`. The unique key `(program_id, tester_id, kind, send_date)` applies to every kind, as specified. Side effect: at most one fix-notice email per tester per day; a second item fixed the same day does not get its own email.
18. `rewards` rules are `metric >= threshold` where metric is one of helpfulness, bugs_count, tips_count, responses_count, progress. Earned rewards are kept even if the number later drops.
19. `webhook_deliveries` is an outbox table filled by triggers in the same transaction as the change.
20. `audit_log` is written by one generic trigger on programs, codes, testers, missions, feedback, rewards, nominations and webhooks. Derived stat columns are ignored (otherwise every feedback would log a tester update) and webhook secrets are never copied in.

## Stats rules

21. **Progress is rounded to a whole number** (`round(done * 100 / total)`), because `progress` is an integer column.
22. **Stage order:** no account → invited; progress 100 → completed; feedback ≥ 1 and progress ≥ 75 → feedback_sent; a mission started or any feedback → testing; terms accepted → onboarded. An account that somehow has not accepted terms stays "invited". With zero missions a tester can never be "completed".
23. **Every feedback item counts** toward bugs/tips/responses, including ones later marked duplicate or wontfix. Triage changes how helpful a tester is (via ratings), not how much they sent.
24. **last_active_at** only moves forward: it is the latest of its current value, the newest feedback and the newest mission update.
