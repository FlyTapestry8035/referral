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

## Dashboard

25. **Opening a row:** a single click on a cell selects it (spreadsheet behavior, needed for drag selection), so the side panel opens by clicking the **row number**, double-clicking a non-editable cell, or pressing Enter on a selected cell. Double-click (or F2/Enter) on a Tester name or Notes cell edits it inline.
26. **Notes is an extra, hidden-by-default column** at the end (turn it on from Columns) so it can be edited inline without changing the spec's column order. Notes can also be edited in the side panel.
27. **Averages on the tiles exclude testers still "invited"** (no account yet), otherwise fresh invites drag helpfulness and progress down. The tile says "of joined testers". The Testers tile counts everyone.
28. **The funnel is cumulative:** a completed tester has also reached every earlier stage. Percentages are of all testers.
29. **Range selection uses TanStack Table v9's built-in cell selection** (drag, Shift+click, Ctrl/Cmd+click to add or subtract, arrow keys, Shift+arrows, Ctrl/Cmd+A, Escape). The status bar sums only numeric cells; Last activity is a date and is never summed.
30. **CSV export** includes the visible columns of the current view (search, filter, sort), and neutralizes cells starting with `= + - @` so spreadsheets don't run them as formulas.
31. **Realtime:** the dashboard subscribes to `testers` and `feedback` changes (RLS applies). Two things were needed in practice: give Realtime the user's access token before joining (the browser client loads the session lazily, so it would otherwise join as anon and receive nothing), and use a unique channel name per mount. Codes and badges come from server joins, so a debounced refresh follows each live update.
32. **Revoking access** sets `access_revoked_at` on that tester row (per program). RLS then hides the program, missions and feedback from them; their login still works for other programs. It can be restored.
33. **Re-inviting** someone who has not joined issues a new single-use code and revokes their previous unused one.

## Feedback and email

34. **Screenshots** are uploaded through server code (5 MB max, PNG/JPEG/WebP, checked by file signature, not just the claimed type) into a private bucket, and shown to members through 10-minute signed URLs.
35. **The embeddable widget** (`public/widget.js`) opens a small Referral popup; the tester signs in there once, so reports are tied to their real account. A cross-origin script cannot screenshot the host page without extra permissions, so the embed captures URL, browser and viewport automatically and offers an optional file upload. The in-app widget captures the screenshot automatically.
36. **Unsubscribe** asks for a button click (link scanners in mail clients open links), and an RFC 8058 one-click endpoint (`/api/unsubscribe/TOKEN`) is in the `List-Unsubscribe` header. Unsubscribed testers get no digests, nudges or thank-you emails; they can still log in.
37. **Token links tolerate trailing punctuation** (`.`, `,`, `)`) because plain-text mail clients sometimes glue it onto URLs; found in testing.
38. **Digest recipients:** every tester with an account who has not unsubscribed or been revoked, including completed testers (their email says they've finished and asks for anything else). **Nudges** skip completed testers.
39. **"A digest per day" uses the program's local date**, nudges and fix notices use the UTC date. A failed send can be retried by the next run the same day; a sent or stubbed one cannot.
40. **The test email** goes to the signed-in member. Its buttons lead to a harmless `/f/test` page because the preview is not tied to a real tester.
41. **Fix notices** are sent when an item moves to `fixed` (not when it is created as fixed), after the response, via `after()`.
42. **Duplicate merging** is one level deep: merging an item into one that is itself a duplicate is refused, and duplicates of an item that gets merged are re-pointed to the new original. Merged items are hidden from the inbox by default and still count in the tester's stats.
43. **Emails are sent one after another with a 250 ms gap** to stay under Resend's default rate limit, and cron routes have `maxDuration = 300`. A very large program (thousands of testers) would need batching or a queue.

## Integrations, programs and roles

44. **Webhook retries** happen right after each change (via `after()`) and whenever a cron runs. Only two crons are declared because the Hobby plan runs them daily anyway; `/api/cron/webhooks` exists for a Pro plan.
45. **Webhook SSRF guard** refuses literal private, loopback, link-local and `localhost` targets (allowed in development so you can test locally). It does not resolve DNS, so a public hostname that points at a private address is not caught.
46. **Webhook secrets** are visible only to owners and admins (RLS) and are redacted from the audit log. The "Send test ping" request is signed the same way but is not queued or retried.
47. **Team management:** owners change roles and remove people; admins can add admins and viewers; nobody can change their own role. New members get a Supabase invite link (via `generateLink({ type: "invite" })`, sent through Resend) that lets them set a password.
48. **New companies** are created with `npm run create-owner` (there is no public company sign-up, matching "accounts are created only by server code"). A member whose company has no program yet is sent to `/setup`.
49. **Audit log** rows from the seed, cron jobs and other service-role writes show "system" as the actor.
