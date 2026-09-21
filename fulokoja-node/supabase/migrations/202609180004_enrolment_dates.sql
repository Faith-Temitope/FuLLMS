alter table public.course_enrolments
    add column start_at timestamptz not null default now(),
    add column end_at timestamptz,
    add constraint course_enrolment_dates_check check (end_at is null or end_at > start_at);

drop policy if exists "Enrolled students and staff can view published courses" on public.courses;

create policy "Enrolled students and staff can view published courses"
    on public.courses for select to authenticated
    using (
        published = true
        or lecturer_id = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
        or exists (
            select 1 from public.course_enrolments enrolment
            where enrolment.course_id = courses.id
              and enrolment.student_id = (select auth.uid())
              and enrolment.start_at <= now()
              and (enrolment.end_at is null or enrolment.end_at > now())
        )
    );