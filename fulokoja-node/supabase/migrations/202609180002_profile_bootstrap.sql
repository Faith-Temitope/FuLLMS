create policy "Users can create their own student profile"
    on public.profiles for insert to authenticated
    with check ((select auth.uid()) = id and role = 'student');