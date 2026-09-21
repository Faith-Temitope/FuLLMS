insert into storage.buckets (id, name, public)
values ('course-submissions', 'course-submissions', false)
on conflict (id) do nothing;

create policy "Students can upload their assignment files"
	on storage.objects for insert to authenticated
	with check (
		bucket_id = 'course-submissions'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "Course staff and owners can read assignment files"
	on storage.objects for select to authenticated
	using (
		bucket_id = 'course-submissions'
		and (
			(storage.foldername(name))[1] = (select auth.uid())::text
			or exists (
				select 1
				from public.assignments
				where assignments.id::text = (storage.foldername(name))[2]
				  and assignments.created_by = (select auth.uid())
			)
			or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
		)
	);

create policy "Students can replace their assignment files"
	on storage.objects for update to authenticated
	using (
		bucket_id = 'course-submissions'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	)
	with check (
		bucket_id = 'course-submissions'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
