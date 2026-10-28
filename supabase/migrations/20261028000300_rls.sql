-- Referral: Row Level Security.
-- Rules:
--   * Company members (owner, admin, viewer) can read rows of programs in their company.
--   * Only owners and admins can write. Viewers are read-only.
--   * Testers can read and write only their own rows (and read their program's public settings).
--   * anon gets nothing; public flows (join, tokenized feedback) run in server code with the service role.

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.programs enable row level security;
alter table public.referral_codes enable row level security;
alter table public.testers enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.missions enable row level security;
alter table public.tester_missions enable row level security;
alter table public.feedback enable row level security;
alter table public.email_log enable row level security;
alter table public.rewards enable row level security;
alter table public.tester_rewards enable row level security;
alter table public.nominations enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.audit_log enable row level security;

-- anon never touches tables directly.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies for select to authenticated
  using (public.is_company_member(id));
create policy companies_update on public.companies for update to authenticated
  using (public.has_company_role(id, array['owner']::public.member_role[]))
  with check (public.has_company_role(id, array['owner']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- company_members
-- ---------------------------------------------------------------------------
create policy members_select on public.company_members for select to authenticated
  using (public.is_company_member(company_id));
-- Owners and admins manage members; only an owner can create or promote owners.
create policy members_insert on public.company_members for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner', 'admin']::public.member_role[])
    and (role <> 'owner' or public.has_company_role(company_id, array['owner']::public.member_role[]))
  );
create policy members_update on public.company_members for update to authenticated
  using (public.has_company_role(company_id, array['owner']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.member_role[]));
create policy members_delete on public.company_members for delete to authenticated
  using (
    public.has_company_role(company_id, array['owner']::public.member_role[])
    or (public.has_company_role(company_id, array['admin']::public.member_role[]) and role = 'viewer')
  );

-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
create policy programs_select on public.programs for select to authenticated
  using (public.is_company_member(company_id) or public.is_program_tester(id));
create policy programs_insert on public.programs for insert to authenticated
  with check (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]));
create policy programs_update on public.programs for update to authenticated
  using (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner', 'admin']::public.member_role[]));
create policy programs_delete on public.programs for delete to authenticated
  using (public.has_company_role(company_id, array['owner']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- referral_codes (company only)
-- ---------------------------------------------------------------------------
create policy codes_select on public.referral_codes for select to authenticated
  using (public.is_program_member(program_id));
create policy codes_insert on public.referral_codes for insert to authenticated
  with check (public.can_edit_program(program_id) and uses = 0 and (created_by is null or created_by = (select auth.uid())));
create policy codes_update on public.referral_codes for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));
create policy codes_delete on public.referral_codes for delete to authenticated
  using (public.can_edit_program(program_id));
-- Clients may not tamper with usage counts. (A column REVOKE does not override a table-level
-- grant, so revoke the table privilege and grant back only the editable columns.)
revoke update on public.referral_codes from authenticated;
grant update (label, max_uses, expires_at, revoked_at) on public.referral_codes to authenticated;

-- ---------------------------------------------------------------------------
-- testers
-- ---------------------------------------------------------------------------
create policy testers_select on public.testers for select to authenticated
  using (public.is_program_member(program_id) or user_id = (select auth.uid()));
create policy testers_insert on public.testers for insert to authenticated
  with check (public.can_edit_program(program_id) and user_id is null);
create policy testers_update on public.testers for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));
create policy testers_delete on public.testers for delete to authenticated
  using (public.can_edit_program(program_id));
-- Stats are computed by recompute_tester_stats; clients can only write these columns.
revoke insert, update on public.testers from authenticated;
grant insert (program_id, name, email, referral_code_id, notes) on public.testers to authenticated;
grant update (name, notes, access_revoked_at, unsubscribed_at) on public.testers to authenticated;

create policy terms_acceptances_select on public.terms_acceptances for select to authenticated
  using (
    public.is_my_tester(tester_id)
    or exists (select 1 from public.testers t where t.id = tester_id and public.is_program_member(t.program_id))
  );

-- ---------------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------------
create policy missions_select on public.missions for select to authenticated
  using (public.is_program_member(program_id) or public.is_program_tester(program_id));
create policy missions_insert on public.missions for insert to authenticated
  with check (public.can_edit_program(program_id));
create policy missions_update on public.missions for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));
create policy missions_delete on public.missions for delete to authenticated
  using (public.can_edit_program(program_id));

-- ---------------------------------------------------------------------------
-- tester_missions (tester ticks their own checklist; company reads)
-- ---------------------------------------------------------------------------
create policy tester_missions_select on public.tester_missions for select to authenticated
  using (
    public.is_my_tester(tester_id)
    or exists (select 1 from public.testers t where t.id = tester_id and public.is_program_member(t.program_id))
  );
create policy tester_missions_insert on public.tester_missions for insert to authenticated
  with check (
    public.is_my_tester(tester_id)
    and exists (
      select 1 from public.testers t join public.missions m on m.program_id = t.program_id
      where t.id = tester_id and m.id = mission_id
    )
  );
create policy tester_missions_update on public.tester_missions for update to authenticated
  using (public.is_my_tester(tester_id))
  with check (public.is_my_tester(tester_id));
create policy tester_missions_delete on public.tester_missions for delete to authenticated
  using (public.is_my_tester(tester_id));
revoke insert, update on public.tester_missions from authenticated;
grant insert (tester_id, mission_id, status) on public.tester_missions to authenticated;
grant update (status) on public.tester_missions to authenticated;

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
create policy feedback_select on public.feedback for select to authenticated
  using (public.is_program_member(program_id) or public.is_my_tester(tester_id));
-- Testers submit their own feedback; triage fields stay untouched.
create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    public.is_my_tester(tester_id)
    and exists (select 1 from public.testers t where t.id = tester_id and t.program_id = feedback.program_id)
    and status = 'new' and team_rating is null and duplicate_of is null and tags = '{}'
    -- A screenshot must live in this tester's own folder.
    and (screenshot_path is null or screenshot_path like program_id::text || '/' || tester_id::text || '/%')
  );
create policy feedback_update on public.feedback for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));
create policy feedback_delete on public.feedback for delete to authenticated
  using (public.can_edit_program(program_id));
revoke insert, update on public.feedback from authenticated;
grant insert (program_id, tester_id, kind, title, body, severity, context, screenshot_path, source) on public.feedback to authenticated;
grant update (title, body, kind, severity, status, team_rating, duplicate_of, tags) on public.feedback to authenticated;

-- ---------------------------------------------------------------------------
-- email_log (read-only for members; written by server jobs)
-- ---------------------------------------------------------------------------
create policy email_log_select on public.email_log for select to authenticated
  using (public.is_program_member(program_id));

-- ---------------------------------------------------------------------------
-- rewards
-- ---------------------------------------------------------------------------
create policy rewards_select on public.rewards for select to authenticated
  using (public.is_program_member(program_id) or public.is_program_tester(program_id));
create policy rewards_insert on public.rewards for insert to authenticated
  with check (public.can_edit_program(program_id));
create policy rewards_update on public.rewards for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));
create policy rewards_delete on public.rewards for delete to authenticated
  using (public.can_edit_program(program_id));

create policy tester_rewards_select on public.tester_rewards for select to authenticated
  using (
    public.is_my_tester(tester_id)
    or exists (select 1 from public.testers t where t.id = tester_id and public.is_program_member(t.program_id))
  );

-- ---------------------------------------------------------------------------
-- nominations
-- ---------------------------------------------------------------------------
create policy nominations_select on public.nominations for select to authenticated
  using (public.is_program_member(program_id) or public.is_my_tester(nominated_by_tester_id));
create policy nominations_insert on public.nominations for insert to authenticated
  with check (
    public.can_nominate(nominated_by_tester_id)
    and exists (select 1 from public.testers t where t.id = nominated_by_tester_id and t.program_id = nominations.program_id)
    and status = 'pending' and decided_by is null and decided_at is null
  );
create policy nominations_update on public.nominations for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));

-- ---------------------------------------------------------------------------
-- webhooks (owners/admins only: rows contain signing secrets)
-- ---------------------------------------------------------------------------
create policy webhooks_select on public.webhooks for select to authenticated
  using (public.can_edit_program(program_id));
create policy webhooks_insert on public.webhooks for insert to authenticated
  with check (public.can_edit_program(program_id));
create policy webhooks_update on public.webhooks for update to authenticated
  using (public.can_edit_program(program_id))
  with check (public.can_edit_program(program_id));
create policy webhooks_delete on public.webhooks for delete to authenticated
  using (public.can_edit_program(program_id));

create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (public.can_edit_program(program_id));

-- ---------------------------------------------------------------------------
-- audit_log (read-only for members)
-- ---------------------------------------------------------------------------
create policy audit_log_select on public.audit_log for select to authenticated
  using (program_id is not null and public.is_program_member(program_id));
