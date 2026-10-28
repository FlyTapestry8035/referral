# Referral

Run a private beta where only people with a valid referral code can create an account. Companies see every tester in a live, spreadsheet-style dashboard (stage, progress, responses, helpfulness, bugs, tips, last activity), and Referral emails testers on a schedule asking for bugs and tips.

- **Company members** (owner, admin, viewer) manage programs, codes, missions, the email schedule and the dashboard at `/dashboard`.
- **Testers** join at `/join` with a referral code, work through missions and send feedback at `/app`.

Stack: Next.js 16 (App Router, TypeScript strict), Tailwind v4, shadcn/ui, Supabase (Auth, Postgres + RLS, Storage, Realtime), Resend + react-email, Vercel Cron, Zod, TanStack Table v9, Recharts, Vitest.

See [PLAN.md](PLAN.md) for what was built and verified, and [DECISIONS.md](DECISIONS.md) for every judgement call.

---

## Local setup

Requirements: Node 20+ (22 tested), Docker (for the local Supabase stack).

```bash
npm install
```

```bash
npx supabase start
```

`supabase start` prints the local API URL, anon key and service role key (also available later with `npx supabase status`). Then create `.env.local`:

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from that output, and generate the two secrets:

```bash
openssl rand -hex 24
```

(use it for `CRON_SECRET`)

```bash
openssl rand -hex 32
```

(use it for `TOKEN_SECRET`). Leave `RESEND_API_KEY` empty for local development: emails are then **printed to the terminal running `npm run dev`** (with all their links) instead of being sent.

Apply the migrations (also re-applies them from scratch later):

```bash
npx supabase db reset
```

Load the demo data and start the app:

```bash
npm run seed
```

```bash
npm run dev
```

Open http://localhost:3000 and log in with the password `demo-password-1234`:

| Email | Role | Lands on |
| --- | --- | --- |
| `owner@example.com` | owner | `/dashboard` |
| `viewer@example.com` | viewer (read-only) | `/dashboard` |
| `morgan.example@example.com` (or any seeded tester) | tester | `/app` |

### Demo data (`npm run seed`)

**Everything the seed creates is fake demo data**: the company "Acme Robotics (demo)", the program "Acme Home beta", 5 missions, 3 codes (`REF-BETA-2345` unlimited, `REF-PART-NERS` 30 uses with an expiry, `REF-STAR-7777` single-use), 3 reward rules and 24 testers with `@example.com` emails spread across all five stages (4 invited, 4 onboarded, 6 testing, 5 feedback sent, 5 completed) with realistic progress, feedback, ratings and last-activity dates. Re-running it deletes the previous demo first. Never run it against a production project you care about.

### Creating a real company

```bash
npm run create-owner -- --email you@company.com --company "Your Company" --program "Your beta"
```

It prints a temporary password. Further owners, admins and viewers are added from **Settings → Team**.

### Trying the flows locally

- **Sign-up:** open `/join?code=REF-BETA-2345`, create an account, then copy the confirmation link from the dev-server terminal.
- **Scheduled emails:** call the cron endpoints yourself:

  ```bash
  curl -H "Authorization: Bearer $(grep ^CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/digest
  ```

  Running it twice on the same day sends nothing the second time.
- **Embeddable widget:** put this on any page (another local server works) and click "Report":

  ```html
  <script src="http://localhost:3000/widget.js" data-program="PROGRAM_ID" defer></script>
  ```

  The exact snippet with your program id is in **Settings → Feedback widget**.

## Tests

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

Unit tests (Vitest): stats rules (progress, helpfulness, stage), referral code generator, HMAC tokens, digest/nudge scheduling, validation, KPIs/funnel, CSV export, webhook signing and the SSRF guard.

```bash
npm run test:integration
```

Integration tests run against the local Supabase from `.env.local` (`supabase start` must be running). They create and clean up their own companies and users, and cover:

- **RLS:** a tester cannot read another tester's rows; a viewer cannot write; company A cannot see or write company B; anon sees nothing; clients cannot change stats or code usage counts; public sign-up is blocked.
- `redeem_referral_code`: the same error for every invalid code, single-use and capped codes under 12–15 concurrent redemptions, release on failure.
- `recompute_tester_stats` in SQL matches the TypeScript rules across 20 random scenarios, plus triggers, rewards, terms versioning, webhook queueing and the audit log.
- Nominations: helpfulness threshold, 3 per tester, no self-approval.

## Deploying to Vercel

1. **Supabase project.** Create one at supabase.com, then link and push the migrations:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

   ```bash
   npx supabase db push
   ```

2. **Supabase Auth settings** (Dashboard → Authentication):
   - Sign In / Providers: **"Allow new users to sign up" off**, Email provider **on**, **"Confirm email" on**. (Turning the Email provider off would also block logins.)
   - Password minimum length: 12.
   - URL Configuration: Site URL = your app URL; add `https://YOUR-DOMAIN/**` to Redirect URLs.
   - Referral sends its own verification, reset and invite emails through Resend, so Supabase's email templates are not used.
3. **Resend.** Verify your sending domain and create an API key. `EMAIL_FROM` must use that domain.
4. **Vercel project.** Import the repo and set every variable from `.env.example` (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `TOKEN_SECRET`, `APP_URL` (your public URL, no trailing slash), and optionally `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DIGEST_CRON_MODE`.
5. **Crons.** `vercel.json` already declares them:

   ```json
   {
     "crons": [
       { "path": "/api/cron/digest", "schedule": "0 9 * * *" },
       { "path": "/api/cron/nudges", "schedule": "30 9 * * *" }
     ]
   }
   ```

   Vercel calls them with `Authorization: Bearer $CRON_SECRET`; anything else gets 401.

   **Hobby (free) plan:** cron jobs may run at most **once a day**, and Vercel runs them at some point **within the hour** you schedule (09:xx UTC above). That is why the digest defaults to daily, and why the program's "send hour" setting is ignored in this mode (the settings page says so next to the field). Digest intervals still work: "every 3 days" means at least 3 calendar days in the program's time zone since that tester's last digest.

   **Pro plan:** you can run the digest hourly. Change its schedule to `"0 * * * *"` and set `DIGEST_CRON_MODE=hourly`; each program's emails then go out during its own send hour in its own time zone. You can also add `{ "path": "/api/cron/webhooks", "schedule": "*/5 * * * *" }` for faster webhook retries (on Hobby, retries happen right after each change and again when the daily crons run).
6. **Rate limiting.** Set the Upstash variables in production. Without them the limiter is in-memory per serverless instance, which is fine locally but weak in production.

## How it works (short version)

- **Sign-up:** `/join` validates with Zod, then calls `redeem_referral_code` (one transaction, row lock, same error for every failure). Only after that does the server create the user with the admin API (`generateLink`, unconfirmed), create the tester row with terms version and timestamp, and email a verification link. A failure after redemption gives the use back.
- **Stats:** Postgres triggers on `feedback`, `tester_missions` and `missions` call `recompute_tester_stats`, which sets progress, counts, helpfulness and stage, then awards any reward whose threshold was crossed.
- **Security:** RLS on every table; owners/admins write, viewers read, testers only touch their own rows. Column-level grants stop clients from writing derived stats, code usage counts or timestamps. The service role key is only imported by `server-only` modules. Emailed links are HMAC-SHA256 signed with `TOKEN_SECRET`, expire (7 days for feedback, 90 for unsubscribe) and are compared in constant time.
- **Emails:** each scheduled send first claims a row in `email_log` (unique per program, tester, kind and day), so overlapping or repeated cron runs never double-send.
- **Webhooks:** triggers queue `feedback.created`, `feedback.status_changed` and `tester.stage_changed` in an outbox table; delivery signs each request (`Referral-Signature: t=<unix>,v1=<hex HMAC of "t.body">`) and retries after 1 min, 5 min, 30 min, 2 h and 12 h.

## Needs you

Things I could not do without your accounts or keys:

1. **A Supabase project** (URL, anon key, service role key), the migrations pushed to it, and the Auth settings in step 2 above.
2. **A Resend account**: API key and a verified sending domain for `EMAIL_FROM`. Until then every email is printed to the server log, which is fine locally but means nobody receives anything in production.
3. **A Vercel project** with the environment variables above. Choose your own `CRON_SECRET` and `TOKEN_SECRET` (never reuse the local ones).
4. **Upstash Redis** (optional but recommended for production rate limiting).
5. **Vercel Pro**, only if you want hourly digests at each program's chosen send hour.
6. **A base branch on GitHub.** This repository had no commits, so the work lives on `claude/loving-einstein-1i81g2` (currently the default branch). Create `main` from it, or tell me to, if you want pull requests.
