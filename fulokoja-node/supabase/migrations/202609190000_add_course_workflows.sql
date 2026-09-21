create table public.course_weeks (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    created_by uuid not null references public.profiles(id),
    label text not null,
    title text not null,
    range text not null default '',
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table public.course_forums (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    created_by uuid not null references public.profiles(id),
    title text not null,
    description text not null default '',
    created_at timestamptz not null default now()
);

create table public.forum_posts (
    id uuid primary key default gen_random_uuid(),
    forum_id uuid not null references public.course_forums(id) on delete cascade,
    author_id uuid not null references public.profiles(id),
    parent_id uuid references public.forum_posts(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now()
);

create table public.quizzes (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    created_by uuid not null references public.profiles(id),
    title text not null,
    instructions text not null default '',
    created_at timestamptz not null default now()
);

create table public.quiz_questions (
    id uuid primary key default gen_random_uuid(),
    quiz_id uuid not null references public.quizzes(id) on delete cascade,
    question text not null,
    options jsonb not null default '[]'::jsonb,
    answer text not null,
    score integer not null default 1,
    created_at timestamptz not null default now()
);

create table public.quiz_attempts (
    id uuid primary key default gen_random_uuid(),
    quiz_id uuid not null references public.quizzes(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    responses jsonb not null default '{}'::jsonb,
    score numeric(6,2) not null default 0,
    submitted_at timestamptz not null default now(),
    unique (quiz_id, student_id)
);

create index course_weeks_course_id_idx on public.course_weeks(course_id);
create index course_forums_course_id_idx on public.course_forums(course_id);
create index forum_posts_forum_id_idx on public.forum_posts(forum_id);
create index quizzes_course_id_idx on public.quizzes(course_id);
create index quiz_attempts_student_id_idx on public.quiz_attempts(student_id);

alter table public.course_weeks enable row level security;
alter table public.course_forums enable row level security;
alter table public.forum_posts enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "Course members can view course weeks"
    on public.course_weeks for select to authenticated
    using (
        exists (select 1 from public.courses where courses.id = course_weeks.course_id and (
            courses.lecturer_id = (select auth.uid())
            or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
            or exists (select 1 from public.course_enrolments where course_id = courses.id and student_id = (select auth.uid()))
        ))
    );

create policy "Staff can manage course weeks"
    on public.course_weeks for all to authenticated
    using (
        created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    )
    with check (
        created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Course members can view forums"
    on public.course_forums for select to authenticated
    using (
        exists (select 1 from public.courses where courses.id = course_forums.course_id and (
            courses.lecturer_id = (select auth.uid())
            or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
            or exists (select 1 from public.course_enrolments where course_id = courses.id and student_id = (select auth.uid()))
        ))
    );

create policy "Staff can manage forums"
    on public.course_forums for all to authenticated
    using (
        created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    )
    with check (
        created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Course members can view forum posts"
    on public.forum_posts for select to authenticated
    using (
        exists (select 1 from public.course_forums where course_forums.id = forum_posts.forum_id and (
            exists (select 1 from public.courses where courses.id = course_forums.course_id and (
                courses.lecturer_id = (select auth.uid())
                or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
                or exists (select 1 from public.course_enrolments where course_id = courses.id and student_id = (select auth.uid()))
            ))
        ))
    );

create policy "Members can create forum posts"
    on public.forum_posts for insert to authenticated
    with check (author_id = (select auth.uid()));

create policy "Course members can view quizzes"
    on public.quizzes for select to authenticated
    using (
        exists (select 1 from public.courses where courses.id = quizzes.course_id and (
            courses.lecturer_id = (select auth.uid())
            or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
            or exists (select 1 from public.course_enrolments where course_id = courses.id and student_id = (select auth.uid()))
        ))
    );

create policy "Staff can manage quizzes"
    on public.quizzes for all to authenticated
    using (
        created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    )
    with check (
        created_by = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
    );

create policy "Course members can view quiz questions"
    on public.quiz_questions for select to authenticated
    using (
        exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and (
            exists (select 1 from public.courses where courses.id = quizzes.course_id and (
                courses.lecturer_id = (select auth.uid())
                or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator'
                or exists (select 1 from public.course_enrolments where course_id = courses.id and student_id = (select auth.uid()))
            ))
        ))
    );

create policy "Students can submit quiz attempts"
    on public.quiz_attempts for all to authenticated
    using (
        student_id = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('lecturer', 'administrator')
    )
    with check (
        student_id = (select auth.uid())
        or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('lecturer', 'administrator')
    );
