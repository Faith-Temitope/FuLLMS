drop policy if exists "Enrolled students and staff can view published courses" on public.courses;

create policy "Users can view published courses and staff courses"
	on public.courses for select to authenticated
	using (
		published = true
		or lecturer_id = (select auth.uid())
		or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
	);
