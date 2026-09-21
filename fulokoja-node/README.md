# FULokoja LMS Node Application

This application is the Node/Supabase service boundary for the Federal University Lokoja integrated learning management system described in `../project.md`.

## Direction

- Moodle remains the reference implementation for interface structure, accessibility behavior, language, and interaction patterns.
- Supabase provides authentication, PostgreSQL data, file storage, realtime events, and row-level security.
- The application will implement courses, materials, accessibility checks, assignments, grading, announcements, messaging, progress, and administrative reporting incrementally.
- No separate visual design system is introduced here. UI work must reuse Moodle's existing templates, CSS conventions, and accessibility patterns.

## Local setup

1. Copy `.env.example` to `.env` and provide the Supabase project URL and publishable key.
2. Install dependencies with `npm install`.
3. Run the API with `npm run dev`.
4. Check `http://localhost:3000/health`.

The Moodle-style browser dashboard is served by the same application at `http://localhost:3000/`. Sign in with an administrator-provisioned university account to view courses, materials, announcements, and assignments.

Authenticated clients can request `GET /api/courses` with a Supabase access token in the `Authorization: Bearer <token>` header. Course visibility is enforced by the database RLS policies.

Authentication uses `POST /api/auth/signin`. Public signup is intentionally disabled: university administrators provision users directly through `POST /api/admin/users` by creating their Supabase Auth account and assigning a role. Students may update accessibility preferences through `PATCH /api/profile/preferences`.

The administrator provisioning endpoint requires `SUPABASE_SECRET_KEY` on the server. Never expose that key to a browser or commit it to the repository. This follows Moodle's administrator-created user flow; course enrolment is a separate institutional action.

The Supabase secret/service-role key must never be placed in this application or exposed to a browser client.
