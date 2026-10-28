-- Referral: functions and triggers.
-- All security definer functions pin search_path = '' and fully qualify names.

-- ---------------------------------------------------------------------------
-- Access helpers (used by RLS policies). security definer so policies on one
-- table can look at company_members/testers without recursive RLS checks.
-- ---------------------------------------------------------------------------
create or replace function public.has_company_role(p_company_id uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = (select auth.uid())
      and cm.role = any (p_roles)
  );
$$;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_company_role(p_company_id, array['owner', 'admin', 'viewer']::public.member_role[]);
$$;

create or replace function public.has_program_role(p_program_id uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.programs p
    join public.company_members cm on cm.company_id = p.company_id
    where p.id = p_program_id
      and cm.user_id = (select auth.uid())
      and cm.role = any (p_roles)
  );
$$;

create or replace function public.is_program_member(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_program_role(p_program_id, array['owner', 'admin', 'viewer']::public.member_role[]);
$$;

create or replace function public.can_edit_program(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_program_role(p_program_id, array['owner', 'admin']::public.member_role[]);
$$;

-- Tester rows that belong to the signed-in user and still have access.
create or replace function public.is_my_tester(p_tester_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.testers t
    where t.id = p_tester_id
      and t.user_id = (select auth.uid())
      and t.access_revoked_at is null
  );
$$;

create or replace function public.is_program_tester(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.testers t
    where t.program_id = p_program_id
      and t.user_id = (select auth.uid())
      and t.access_revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Tester statistics
-- ---------------------------------------------------------------------------
create or replace function public.recompute_tester_stats(p_tester_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_tester public.testers%rowtype;
  v_total integer;
  v_done integer;
  v_started boolean;
  v_progress integer;
  v_bugs integer;
  v_tips integer;
  v_responses integer;
  v_baseline integer;
  v_avg_rating numeric;
  v_helpfulness integer;
  v_stage public.tester_stage;
  v_last_activity timestamptz;
begin
  select * into v_tester from public.testers where id = p_tester_id;
  if not found then
    return;
  end if;

  select count(*) into v_total from public.missions m where m.program_id = v_tester.program_id;

  select
    count(*) filter (where tm.status = 'done'),
    coalesce(bool_or(tm.status in ('doing', 'done')), false),
    max(tm.updated_at)
  into v_done, v_started, v_last_activity
  from public.tester_missions tm
  join public.missions m on m.id = tm.mission_id and m.program_id = v_tester.program_id
  where tm.tester_id = p_tester_id;

  v_progress := case when v_total = 0 then 0 else round(v_done * 100.0 / v_total)::integer end;

  select
    count(*) filter (where f.kind = 'bug'),
    count(*) filter (where f.kind = 'tip'),
    count(*) filter (where f.kind = 'response'),
    avg(f.team_rating),
    greatest(v_last_activity, max(f.created_at))
  into v_bugs, v_tips, v_responses, v_avg_rating, v_last_activity
  from public.feedback f
  where f.tester_id = p_tester_id;

  v_baseline := least(60, v_responses * 4 + v_bugs * 5 + v_tips * 3);
  v_helpfulness := case
    when v_avg_rating is null then v_baseline
    else round(0.4 * v_baseline + 0.6 * (v_avg_rating * 20))::integer
  end;

  v_stage := case
    when v_tester.user_id is null then 'invited'
    when v_progress = 100 then 'completed'
    when (v_bugs + v_tips + v_responses) >= 1 and v_progress >= 75 then 'feedback_sent'
    when v_started or (v_bugs + v_tips + v_responses) >= 1 then 'testing'
    when v_tester.terms_accepted_at is not null then 'onboarded'
    else 'invited'
  end::public.tester_stage;

  update public.testers t
  set progress = v_progress,
      bugs_count = v_bugs,
      tips_count = v_tips,
      responses_count = v_responses,
      helpfulness = v_helpfulness,
      stage = v_stage,
      last_active_at = greatest(t.last_active_at, v_last_activity)
  where t.id = p_tester_id
    and (t.progress, t.bugs_count, t.tips_count, t.responses_count, t.helpfulness, t.stage, t.last_active_at)
      is distinct from
        (v_progress, v_bugs, v_tips, v_responses, v_helpfulness, v_stage, greatest(t.last_active_at, v_last_activity));

  perform public.award_rewards(p_tester_id);
end;
$$;

-- Records any reward whose threshold the tester has reached. Rewards are never taken away.
create or replace function public.award_rewards(p_tester_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.tester_rewards (tester_id, reward_id)
  select t.id, r.id
  from public.testers t
  join public.rewards r on r.program_id = t.program_id
  where t.id = p_tester_id
    and t.user_id is not null
    and (case r.metric
           when 'helpfulness' then t.helpfulness
           when 'bugs_count' then t.bugs_count
           when 'tips_count' then t.tips_count
           when 'responses_count' then t.responses_count
           when 'progress' then t.progress
         end) >= r.threshold
  on conflict do nothing;
$$;

create or replace function public.trg_recompute_from_child()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_tester_stats(new.tester_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.tester_id is distinct from new.tester_id) then
    perform public.recompute_tester_stats(old.tester_id);
  end if;
  return null;
end;
$$;

create trigger feedback_recompute_stats
after insert or update or delete on public.feedback
for each row execute function public.trg_recompute_from_child();

create trigger tester_missions_recompute_stats
after insert or update or delete on public.tester_missions
for each row execute function public.trg_recompute_from_child();

-- Adding or removing a mission changes everyone's progress in that program.
create or replace function public.trg_recompute_program()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_program uuid := coalesce(new.program_id, old.program_id);
  v_tester uuid;
begin
  if not exists (select 1 from public.programs where id = v_program) then
    return null; -- program is being deleted
  end if;
  for v_tester in select id from public.testers where program_id = v_program loop
    perform public.recompute_tester_stats(v_tester);
  end loop;
  return null;
end;
$$;

create trigger missions_recompute_stats
after insert or delete on public.missions
for each row execute function public.trg_recompute_program();

create or replace function public.trg_recompute_tester_self()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.recompute_tester_stats(new.id);
  return null;
end;
$$;

create trigger testers_recompute_on_account
after insert or update of user_id, terms_accepted_at on public.testers
for each row execute function public.trg_recompute_tester_self();

-- New or changed reward rules apply to testers who already qualify.
create or replace function public.trg_rewards_backfill()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tester uuid;
begin
  for v_tester in select id from public.testers where program_id = new.program_id loop
    perform public.award_rewards(v_tester);
  end loop;
  return null;
end;
$$;

create trigger rewards_backfill
after insert or update of metric, threshold on public.rewards
for each row execute function public.trg_rewards_backfill();

-- ---------------------------------------------------------------------------
-- Referral code redemption. Called only by server code with the service role.
-- Every failure raises the same message so codes cannot be probed.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_referral_code(p_code text)
returns table (code_id uuid, program_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_code public.referral_codes%rowtype;
begin
  select * into v_code
  from public.referral_codes rc
  where rc.code = upper(btrim(p_code))
  for update;

  if not found
     or v_code.revoked_at is not null
     or (v_code.expires_at is not null and v_code.expires_at <= now())
     or (v_code.max_uses is not null and v_code.uses >= v_code.max_uses) then
    raise exception 'invalid_referral_code' using errcode = 'P0001';
  end if;

  update public.referral_codes set uses = uses + 1 where id = v_code.id;

  return query select v_code.id, v_code.program_id;
end;
$$;

-- Gives a use back when account creation fails after a successful redemption.
create or replace function public.release_referral_code(p_code_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.referral_codes set uses = greatest(uses - 1, 0) where id = p_code_id;
$$;

revoke all on function public.redeem_referral_code(text) from public, anon, authenticated;
revoke all on function public.release_referral_code(uuid) from public, anon, authenticated;
grant execute on function public.redeem_referral_code(text) to service_role;
grant execute on function public.release_referral_code(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Terms versioning
-- ---------------------------------------------------------------------------
create or replace function public.trg_programs_terms_version()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.terms_text is distinct from old.terms_text then
    new.terms_version := old.terms_version + 1;
    new.terms_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger programs_terms_version
before update on public.programs
for each row execute function public.trg_programs_terms_version();

-- Tester accepts the current terms of their program.
create or replace function public.accept_terms(p_tester_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_version integer;
begin
  select p.terms_version into v_version
  from public.testers t
  join public.programs p on p.id = t.program_id
  where t.id = p_tester_id
    and t.user_id = (select auth.uid())
    and t.access_revoked_at is null;

  if v_version is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.testers
  set terms_accepted_at = now(), terms_version_accepted = v_version
  where id = p_tester_id;

  insert into public.terms_acceptances (tester_id, terms_version) values (p_tester_id, v_version);
end;
$$;

revoke all on function public.accept_terms(uuid) from public, anon;
grant execute on function public.accept_terms(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Nominations: may this tester nominate someone right now?
-- ---------------------------------------------------------------------------
create or replace function public.can_nominate(p_tester_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.testers t
    join public.programs p on p.id = t.program_id
    where t.id = p_tester_id
      and t.user_id = (select auth.uid())
      and t.access_revoked_at is null
      and t.helpfulness >= p.nomination_min_helpfulness
      and (select count(*) from public.nominations n where n.nominated_by_tester_id = t.id) < p.nominations_per_tester
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.trg_touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger feedback_touch before update on public.feedback
for each row execute function public.trg_touch_updated_at();

create or replace function public.trg_tester_missions_timestamps()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Clients can only write `status` (column grants), so their timestamps are always "now".
  -- Server code (service role) may backdate, which the demo seed uses.
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.updated_at, now());
  elsif new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  if new.status in ('doing', 'done') and new.started_at is null then
    new.started_at := new.updated_at;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := coalesce(case when tg_op = 'INSERT' then new.completed_at end, new.updated_at);
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tester_missions_timestamps before insert or update on public.tester_missions
for each row execute function public.trg_tester_missions_timestamps();

-- ---------------------------------------------------------------------------
-- Webhook outbox: events are queued in the same transaction as the change.
-- Delivery (signing, retries with backoff) happens in server code.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_webhook_event(p_program_id uuid, p_event text, p_data jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.webhook_deliveries (webhook_id, program_id, event, payload)
  select w.id, w.program_id, p_event,
         jsonb_build_object(
           'id', gen_random_uuid(),
           'event', p_event,
           'created_at', now(),
           'program_id', p_program_id,
           'data', p_data)
  from public.webhooks w
  where w.program_id = p_program_id
    and w.active
    and p_event = any (w.events);
$$;

create or replace function public.trg_feedback_webhooks()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_webhook_event(new.program_id, 'feedback.created',
      jsonb_build_object('feedback_id', new.id, 'tester_id', new.tester_id, 'kind', new.kind,
                         'title', new.title, 'severity', new.severity, 'status', new.status));
  elsif new.status is distinct from old.status then
    perform public.enqueue_webhook_event(new.program_id, 'feedback.status_changed',
      jsonb_build_object('feedback_id', new.id, 'tester_id', new.tester_id,
                         'from', old.status, 'to', new.status));
  end if;
  return null;
end;
$$;

create trigger feedback_webhooks
after insert or update of status on public.feedback
for each row execute function public.trg_feedback_webhooks();

create or replace function public.trg_tester_stage_webhooks()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    perform public.enqueue_webhook_event(new.program_id, 'tester.stage_changed',
      jsonb_build_object('tester_id', new.id, 'from', old.stage, 'to', new.stage));
  end if;
  return null;
end;
$$;

create trigger testers_stage_webhooks
after update of stage on public.testers
for each row execute function public.trg_tester_stage_webhooks();

-- ---------------------------------------------------------------------------
-- Audit log: one generic trigger on every table people change.
-- actor_id is the signed-in user (null for system jobs / service role).
-- ---------------------------------------------------------------------------
create or replace function public.trg_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_program uuid;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  -- Derived or noisy columns that are not worth an audit entry on their own.
  v_ignored text[] := array['progress', 'responses_count', 'helpfulness', 'bugs_count', 'tips_count',
                            'stage', 'last_active_at', 'updated_at', 'uses'];
  -- Never copy secrets into the audit log.
  v_secret text[] := array['secret'];
begin
  v_program := case tg_table_name
    when 'programs' then (v_row ->> 'id')::uuid
    else (v_row ->> 'program_id')::uuid
  end;
  if tg_table_name = 'tester_missions' then
    select t.program_id into v_program from public.testers t where t.id = (v_row ->> 'tester_id')::uuid;
  end if;
  if v_program is not null and not exists (select 1 from public.programs where id = v_program) then
    v_program := null; -- cascading delete of the program itself
  end if;
  if tg_table_name in ('tester_missions') and v_program is null then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if (v_new -> v_key) is distinct from (v_old -> v_key) and not (v_key = any (v_ignored)) then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object(
          'from', case when v_key = any (v_secret) then '"[redacted]"'::jsonb else v_old -> v_key end,
          'to', case when v_key = any (v_secret) then '"[redacted]"'::jsonb else v_new -> v_key end));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - v_secret - v_ignored;
  else
    v_changes := v_old - v_secret - v_ignored;
  end if;

  insert into public.audit_log (program_id, actor_id, action, entity, entity_id, meta)
  values (
    v_program,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', concat_ws(':', v_row ->> 'tester_id', v_row ->> 'mission_id', v_row ->> 'reward_id')),
    v_changes
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['programs', 'referral_codes', 'testers', 'missions', 'feedback',
                           'rewards', 'nominations', 'webhooks'] loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.trg_audit()', t || '_audit', t);
  end loop;
end;
$$;

-- Helpers that are only meant for triggers/policies must not be callable directly over the API.
revoke all on function public.recompute_tester_stats(uuid) from public, anon, authenticated;
revoke all on function public.award_rewards(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_webhook_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.recompute_tester_stats(uuid) to service_role;
