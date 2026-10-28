-- Referral: screenshot storage bucket and realtime publication.

-- Private bucket. Objects live at <program_id>/<tester_id>/<uuid>.<ext>.
-- Uploads go through server code (which validates type and size); members read via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy screenshots_member_read on storage.objects for select to authenticated
  using (
    bucket_id = 'screenshots'
    and public.is_program_member(((storage.foldername(name))[1])::uuid)
  );

create policy screenshots_tester_read on storage.objects for select to authenticated
  using (
    bucket_id = 'screenshots'
    and public.is_my_tester(((storage.foldername(name))[2])::uuid)
  );

create policy screenshots_tester_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and public.is_my_tester(((storage.foldername(name))[2])::uuid)
    and exists (
      select 1 from public.testers t
      where t.id = ((storage.foldername(name))[2])::uuid
        and t.program_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- Realtime: the dashboard listens to tester and feedback changes (RLS still applies).
alter publication supabase_realtime add table public.testers;
alter publication supabase_realtime add table public.feedback;
