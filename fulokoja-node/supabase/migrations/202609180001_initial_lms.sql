create type public.user_role as enum ('student', 'lecturer', 'administrator');
create type public.material_type as enum ('document', 'video', 'image', 'audio', 'link');
create type public.accessibility_status as enum ('pending', 'passed', 'flagged');

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    matric_number text unique,
    display_name text not null,
    role public.user_role not null default 'student',
    accessibility_preferences jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.courses (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    title text not null,
    description text not null default '',
    department text not null,
    lecturer_id uuid not null references public.profiles(id),
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.course_enrolments (
    course_id uuid not null references public.courses(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    enrolled_at timestamptz not null default now(),
    primary key (course_id, student_id)
);

create table public.course_materials (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    uploaded_by uuid not null references public.profiles(id),
    title text not null,
    description text not null default '',
    material_type public.material_type not null,
    storage_path text,
    external_url text,
    alt_text text,
    caption_path text,
    accessibility_status public.accessibility_status not null default 'pending',
    published boolean not null default false,
    created_at timestamptz not null default now(),
    constraint material_source_check check (storage_path is not null or external_url is not null),
    constraint material_alt_text_check check (material_type <> 'image' or (alt_text is not null and length(trim(alt_text)) >= 5)),
    constraint material_caption_check check (material_type <> 'video' or caption_path is not null)
);

create table public.assignments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    created_by uuid not null references public.profiles(id),
    title text not null,
    instructions text not null default '',
    due_at timestamptz not null,
    max_score numeric(6, 2) not null default 100 check (max_score > 0),
    created_at timestamptz not null default now()
);

create table public.submissions (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references public.assignments(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    storage_path text not null,
    submitted_at timestamptz not null default now(),
    score numeric(6, 2),
    feedback text,
    graded_at timestamptz,
    unique (assignment_id, student_id),
    constraint submission_score_check check (score is null or score >= 0)
);

create table public.announcements (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    author_id uuid not null references public.profiles(id),
    title text not null,
    body text not null,
    published_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid not null references public.profiles(id) on delete cascade,
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    body text not null,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    constraint message_participants_check check (sender_id <> recipient_id)
);

create table public.course_progress (
    course_id uuid not null references public.courses(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    completion_percent numeric(5, 2) not null default 0 check (completion_percent between 0 and 100),
    updated_at timestamptz not null default now(),
    primary key (course_id, student_id)
);

create index course_enrolments_student_id_idx on public.course_enrolments(student_id);
create index course_materials_course_id_idx on public.course_materials(course_id);
create index assignments_course_id_idx on public.assignments(course_id);
create index submissions_student_id_idx on public.submissions(student_id);
create index announcements_course_id_idx on public.announcements(course_id);
create index messages_recipient_id_idx on public.messages(recipient_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrolments enable row level security;
alter table public.course_materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.announcements enable row level security;
alter table public.messages enable row level security;
alter table public.course_progress enable row level security;

create policy "Users can view their own profile"
    on public.profiles for select to authenticated
    using ((select auth.uid()) = id);

create policy "Users can update their own accessibility preferences"
    on public.profiles for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

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
        )
    );

create policy "Students can view their enrolments"
    on public.course_enrolments for select to authenticated
    using (student_id = (select auth.uid()));

create policy "Staff can manage course enrolments"
    on public.course_enrolments for all to authenticated
    using (
        exists (select 1 from public.courses where courses.id = course_enrolments.course_id and courses.lecturer_id = (select auth.uid()))
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    )
    with check (
        exists (select 1 from public.courses where courses.id = course_enrolments.course_id and courses.lecturer_id = (select auth.uid()))
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Enrolled students and staff can view published materials"
    on public.course_materials for select to authenticated
    using (
        published = true
        and exists (select 1 from public.course_enrolments where course_id = course_materials.course_id and student_id = (select auth.uid()))
        or uploaded_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Lecturers can manage their course materials"
    on public.course_materials for all to authenticated
    using (
        uploaded_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    )
    with check (
        uploaded_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Students can view course assignments"
    on public.assignments for select to authenticated
    using (
        exists (select 1 from public.course_enrolments where course_id = assignments.course_id and student_id = (select auth.uid()))
        or created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Lecturers can manage assignments"
    on public.assignments for all to authenticated
    using (created_by = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator')
    with check (created_by = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator');

create policy "Students can manage their submissions"
    on public.submissions for all to authenticated
    using (student_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('lecturer', 'administrator'))
    with check (student_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('lecturer', 'administrator'));

create policy "Course members can view announcements"
    on public.announcements for select to authenticated
    using (
        author_id = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
        or exists (select 1 from public.course_enrolments where course_id = announcements.course_id and student_id = (select auth.uid()))
    );

create policy "Lecturers can manage announcements"
    on public.announcements for all to authenticated
    using (author_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator')
    with check (author_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator');

create policy "Users can view their messages"
    on public.messages for select to authenticated
    using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "Users can send messages"
    on public.messages for insert to authenticated
    with check (sender_id = (select auth.uid()));

create policy "Recipients can mark messages read"
    on public.messages for update to authenticated
    using (recipient_id = (select auth.uid()))
    with check (recipient_id = (select auth.uid()));

create policy "Students can view their progress"
    on public.course_progress for select to authenticated
    using (student_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('lecturer', 'administrator'));

create policy "Students can update their progress"
    on public.course_progress for insert to authenticated
    with check (student_id = (select auth.uid()));

create policy "Students can update their own progress"
    on public.course_progress for update to authenticated
    using (student_id = (select auth.uid()))
    with check (student_id = (select auth.uid()));