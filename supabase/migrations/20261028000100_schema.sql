-- Referral: core schema.
-- Every table gets RLS in 20261028000300_rls.sql. Nothing here is readable by clients until then.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'viewer');
create type public.tester_stage as enum ('invited', 'onboarded', 'testing', 'feedback_sent', 'completed');
create type public.mission_status as enum ('todo', 'doing', 'done');
create type public.feedback_kind as enum ('bug', 'tip', 'response');
create type public.feedback_severity as enum ('low', 'medium', 'high');
create type public.feedback_status as enum ('new', 'acknowledged', 'fixed', 'wontfix');
create type public.email_kind as enum ('digest', 'nudge', 'fix_notice', 'invite');
create type public.nomination_status as enum ('pending', 'approved', 'rejected');
create type public.reward_metric as enum ('helpfulness', 'bugs_count', 'tips_count', 'responses_count', 'progress');

-- ---------------------------------------------------------------------------
-- Companies, members, programs
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  product_name text not null default '' check (char_length(product_name) <= 200),
  digest_enabled boolean not null default true,
  digest_interval_days integer not null default 1 check (digest_interval_days between 1 and 365),
  digest_send_hour integer not null default 9 check (digest_send_hour between 0 and 23),
  digest_timezone text not null default 'UTC' check (char_length(digest_timezone) between 1 and 64),
  digest_subject text not null default 'How is testing going?' check (char_length(digest_subject) between 1 and 200),
  digest_intro text not null default 'Thanks for testing with us. Found a bug or have an idea? It takes 30 seconds to tell us.'
    check (char_length(digest_intro) <= 2000),
  terms_text text not null default '' check (char_length(terms_text) <= 50000),
  -- Bumped automatically whenever terms_text changes (see trigger), so testers re-accept.
  terms_version integer not null default 1,
  terms_updated_at timestamptz not null default now(),
  nudges_enabled boolean not null default true,
  nudge_inactive_days integer not null default 7 check (nudge_inactive_days between 1 and 365),
  nudge_stuck_days integer not null default 5 check (nudge_stuck_days between 1 and 365),
  nomination_min_helpfulness integer not null default 70 check (nomination_min_helpfulness between 0 and 100),
  nominations_per_tester integer not null default 3 check (nominations_per_tester between 0 and 50),
  created_at timestamptz not null default now()
);
create index programs_company_idx on public.programs (company_id);

-- ---------------------------------------------------------------------------
-- Referral codes and testers
-- ---------------------------------------------------------------------------
create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  code text not null unique check (code ~ '^REF-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  label text check (char_length(label) <= 200),
  max_uses integer check (max_uses is null or max_uses >= 1),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index referral_codes_program_idx on public.referral_codes (program_id);

create table public.testers (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  referral_code_id uuid references public.referral_codes (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  stage public.tester_stage not null default 'invited',
  progress integer not null default 0 check (progress between 0 and 100),
  responses_count integer not null default 0,
  helpfulness integer not null default 0 check (helpfulness between 0 and 100),
  bugs_count integer not null default 0,
  tips_count integer not null default 0,
  last_active_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version_accepted integer,
  unsubscribed_at timestamptz,
  access_revoked_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  unique (program_id, email),
  unique (program_id, user_id)
);
create index testers_program_idx on public.testers (program_id);
create index testers_user_idx on public.testers (user_id);
create index testers_code_idx on public.testers (referral_code_id);

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  tester_id uuid not null references public.testers (id) on delete cascade,
  terms_version integer not null,
  accepted_at timestamptz not null default now()
);
create index terms_acceptances_tester_idx on public.terms_acceptances (tester_id);

-- ---------------------------------------------------------------------------
-- Missions
-- ---------------------------------------------------------------------------
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index missions_program_idx on public.missions (program_id, position);

create table public.tester_missions (
  tester_id uuid not null references public.testers (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  status public.mission_status not null default 'todo',
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tester_id, mission_id)
);
create index tester_missions_mission_idx on public.tester_missions (mission_id);

-- ---------------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  tester_id uuid not null references public.testers (id) on delete cascade,
  kind public.feedback_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 10000),
  severity public.feedback_severity,
  status public.feedback_status not null default 'new',
  team_rating integer check (team_rating between 0 and 5),
  screenshot_path text check (char_length(screenshot_path) <= 500),
  context jsonb not null default '{}'::jsonb,
  duplicate_of uuid references public.feedback (id) on delete set null,
  tags text[] not null default '{}',
  source text not null default 'app' check (source in ('app', 'widget', 'embed', 'email_link')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_severity_only_for_bugs check (kind = 'bug' or severity is null),
  constraint feedback_not_own_duplicate check (duplicate_of is null or duplicate_of <> id),
  constraint feedback_tags_limit check (cardinality(tags) <= 20)
);
create index feedback_program_idx on public.feedback (program_id, created_at desc);
create index feedback_tester_idx on public.feedback (tester_id);

-- ---------------------------------------------------------------------------
-- Email log (idempotency for scheduled email)
-- ---------------------------------------------------------------------------
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  tester_id uuid not null references public.testers (id) on delete cascade,
  kind public.email_kind not null,
  send_date date not null default ((now() at time zone 'utc')::date),
  sent_at timestamptz not null default now(),
  provider_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'stubbed', 'failed')),
  error text,
  -- One email of each kind per tester per day. Digest claiming relies on this.
  constraint email_log_once_per_day unique (program_id, tester_id, kind, send_date)
);
create index email_log_tester_kind_idx on public.email_log (tester_id, kind, sent_at desc);

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  badge text not null default '🏅' check (char_length(badge) between 1 and 16),
  metric public.reward_metric not null,
  threshold integer not null check (threshold >= 0),
  created_at timestamptz not null default now()
);
create index rewards_program_idx on public.rewards (program_id);

create table public.tester_rewards (
  tester_id uuid not null references public.testers (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (tester_id, reward_id)
);
create index tester_rewards_reward_idx on public.tester_rewards (reward_id);

-- ---------------------------------------------------------------------------
-- Nominations
-- ---------------------------------------------------------------------------
create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  nominated_by_tester_id uuid not null references public.testers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  reason text not null default '' check (char_length(reason) <= 1000),
  status public.nomination_status not null default 'pending',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (program_id, email)
);
create index nominations_program_idx on public.nominations (program_id, status);
create index nominations_tester_idx on public.nominations (nominated_by_tester_id);

-- ---------------------------------------------------------------------------
-- Webhooks
-- ---------------------------------------------------------------------------
create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  secret text not null check (char_length(secret) >= 16),
  events text[] not null default '{}'
    check (events <@ array['feedback.created', 'feedback.status_changed', 'tester.stage_changed']::text[]),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index webhooks_program_idx on public.webhooks (program_id);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status integer,
  last_error text,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
create index webhook_deliveries_due_idx on public.webhook_deliveries (next_attempt_at)
  where delivered_at is null and failed_at is null;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_program_idx on public.audit_log (program_id, created_at desc);
