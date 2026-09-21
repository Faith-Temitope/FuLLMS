import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildCourseAnalytics } from './course-analytics.js';
import { resolveUserRole } from './role-utils.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
const supabaseAdmin = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(publicDirectory));

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const profileSchema = z.object({
  accessibilityPreferences: z.record(z.string(), z.unknown()),
});

const institutionalUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(120),
  matricNumber: z.string().trim().min(3).max(40).optional(),
  role: z.enum(['student', 'lecturer', 'administrator']).default('student'),
});

const courseSchema = z.object({
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).default(''),
  department: z.string().trim().min(2).max(160),
  lecturerId: z.string().uuid(),
  published: z.boolean().default(false),
});

const enrolmentSchema = z.object({
  studentId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
});

const assignmentCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  instructions: z.string().max(10000).default(''),
  dueAt: z.string().datetime({ offset: true }),
  maxScore: z.number().int().positive().max(1000).default(100),
});

const assignmentSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255).optional(),
  fileData: z.string().max(8_000_000).optional(),
  content: z.string().max(100000).default(''),
});

const assignmentGradeSchema = z.object({
  studentId: z.string().uuid(),
  score: z.number().min(0).max(1000),
  feedback: z.string().max(10000).default(''),
});

const materialCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).default(''),
  materialType: z.enum(['document', 'video', 'image', 'audio', 'link']),
  storagePath: z.string().trim().min(1).max(1000).optional(),
  externalUrl: z.string().url().max(2000).optional(),
  altText: z.string().trim().min(5).max(1000).optional(),
  captionPath: z.string().trim().min(1).max(1000).optional(),
  published: z.boolean().default(false),
}).superRefine((value, context) => {
  if (!value.storagePath && !value.externalUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['storagePath'], message: 'A storage path or external URL is required' });
  }
  if (value.materialType === 'image' && !value.altText) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['altText'], message: 'Alternative text is required for images' });
  }
  if (value.materialType === 'video' && !value.captionPath) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['captionPath'], message: 'A caption file is required for videos' });
  }
});

const announcementCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(20000),
});

const progressUpdateSchema = z.object({
  completionPercent: z.number().min(0).max(100),
});

const messageCreateSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
});

const courseWeekSchema = z.object({
  courseId: z.string().uuid(),
  label: z.string().trim().min(2).max(60),
  title: z.string().trim().min(2).max(160),
  range: z.string().trim().min(2).max(200).optional().default(''),
});

const forumThreadSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(20000),
});

const forumReplySchema = z.object({
  forumId: z.string().uuid(),
  body: z.string().trim().min(2).max(20000),
  parentId: z.string().uuid().nullable().optional(),
});

const quizQuestionSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
  answer: z.string().trim().min(1).max(300),
  score: z.number().int().min(1).max(100).default(1),
});

const quizCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  instructions: z.string().trim().max(10000).default(''),
  questions: z.array(quizQuestionSchema).min(1).max(20),
});

const quizAttemptSchema = z.object({
  quizId: z.string().uuid(),
  responses: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

function getAccessToken(request) {
  const authorization = request.get('authorization');
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}

async function getAuthenticatedClient(request) {
  const accessToken = getAccessToken(request);
  if (!supabase || !accessToken) {
    return null;
  }

  const authenticatedClient = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await authenticatedClient.auth.getUser(accessToken);

  return error || !data.user ? null : { client: authenticatedClient, user: data.user };
}

async function requireAdministrator(request) {
  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return null;
  }

  const roleFromAuth = resolveUserRole(authenticated.user);
  if (roleFromAuth === 'administrator') {
    return authenticated;
  }

  if (!supabaseAdmin) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authenticated.user.id)
    .maybeSingle();

  return profile?.role === 'administrator' ? authenticated : null;
}

async function requireRole(request, roles) {
  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return null;
  }

  const roleNames = new Set(roles);
  const roleFromAuth = resolveUserRole(authenticated.user);
  if (roleFromAuth && roleNames.has(roleFromAuth)) {
    return authenticated;
  }

  if (!supabaseAdmin) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authenticated.user.id)
    .maybeSingle();

  return profile && roleNames.has(profile.role) ? authenticated : null;
}

async function requireCourseAccess(request, courseId) {
  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated || !courseId) {
    return null;
  }

  if (!supabaseAdmin) {
    return null;
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id, published')
    .eq('id', courseId)
    .maybeSingle();

  if (!course) {
    return null;
  }

  if (course.lecturer_id === authenticated.user.id || course.published === true) {
    return authenticated;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authenticated.user.id)
    .maybeSingle();

  if (profile?.role === 'administrator') {
    return authenticated;
  }

  const { data: enrolment } = await supabaseAdmin
    .from('course_enrolments')
    .select('course_id')
    .eq('course_id', courseId)
    .eq('student_id', authenticated.user.id)
    .maybeSingle();

  return enrolment ? authenticated : null;
}

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'fulokoja-lms',
    database: supabase ? 'configured' : 'not-configured',
  });
});

app.post('/api/auth/signup', (_request, response) => {
  response.status(403).json({ error: 'Public account creation is disabled. Contact the university administrator.' });
});

app.post('/api/auth/signin', async (request, response) => {
  if (!supabase) {
    return response.status(503).json({ error: 'Database is not configured' });
  }

  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return response.status(401).json({ error: 'Invalid email or password' });
  }

  const { data: profile } = supabaseAdmin
    ? await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', data.user.id)
      .maybeSingle()
    : { data: null };

  return response.json({
    user: { ...data.user, role: profile?.role ?? null, display_name: profile?.display_name ?? null },
    session: data.session,
  });
});

app.patch('/api/profile/preferences', async (request, response) => {
  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const parsed = profileSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'Accessibility preferences must be an object' });
  }

  const { data, error } = await authenticated.client
    .from('profiles')
    .update({ accessibility_preferences: parsed.data.accessibilityPreferences, updated_at: new Date().toISOString() })
    .eq('id', authenticated.user.id)
    .select('id, matric_number, display_name, role, accessibility_preferences')
    .single();

  if (error) {
    console.error('Unable to save profile', error.message);
    return response.status(500).json({ error: 'Unable to save profile' });
  }

  return response.json({ data });
});

app.get('/api/profile', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, matric_number, display_name, role, accessibility_preferences')
    .eq('id', authenticated.user.id)
    .single();
  if (error) {
    console.error('Unable to load profile', error.message);
    return response.status(500).json({ error: 'Unable to load profile' });
  }

  return response.json({ data: { ...data, email: authenticated.user.email } });
});

app.get('/api/profile/preferences', async (request, response) => {
  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const { data, error } = await authenticated.client
    .from('profiles')
    .select('accessibility_preferences')
    .eq('id', authenticated.user.id)
    .single();

  if (error) {
    console.error('Unable to load profile preferences', error.message);
    return response.status(500).json({ error: 'Unable to load accessibility preferences' });
  }

  return response.json({ data: data.accessibility_preferences ?? {} });
});

app.post('/api/admin/users', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  if (!await requireAdministrator(request)) {
    return response.status(403).json({ error: 'Administrator permission required' });
  }

  const parsed = institutionalUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid email, password, display name, and role are required' });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      display_name: parsed.data.displayName,
      role: parsed.data.role,
    },
  });

  if (createError || !created.user) {
    return response.status(400).json({ error: createError?.message ?? 'Unable to create user' });
  }

  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(created.user.id, {
    app_metadata: { role: parsed.data.role },
  });

  if (metadataError) {
    console.warn('Unable to sync auth role metadata for user', created.user.id, metadataError.message);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: created.user.id,
      display_name: parsed.data.displayName,
      matric_number: parsed.data.matricNumber ?? null,
      role: parsed.data.role,
    })
    .select('id, matric_number, display_name, role')
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    console.error('Unable to create institutional profile', profileError.message);
    return response.status(500).json({ error: 'Unable to create institutional profile' });
  }

  return response.status(201).json({ data: profile });
});

app.get('/api/admin/users', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  if (!await requireAdministrator(request)) {
    return response.status(403).json({ error: 'Administrator permission required' });
  }

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, matric_number, display_name, role, accessibility_preferences, created_at')
    .order('display_name');
  if (profileError) {
    console.error('Unable to load institutional users', profileError.message);
    return response.status(500).json({ error: 'Unable to load users' });
  }

  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (authError) {
    console.error('Unable to load authentication users', authError.message);
    return response.status(500).json({ error: 'Unable to load users' });
  }

  const emailById = new Map((authUsers.users ?? []).map((user) => [user.id, user.email]));
  return response.json({
    data: (profiles ?? []).map((profile) => ({ ...profile, email: emailById.get(profile.id) ?? null })),
  });
});

app.post('/api/admin/courses', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  if (!await requireAdministrator(request)) {
    return response.status(403).json({ error: 'Administrator permission required' });
  }

  const parsed = courseSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid course code, title, department, and lecturer are required' });
  }

  const { data: lecturer } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.lecturerId)
    .eq('role', 'lecturer')
    .maybeSingle();

  if (!lecturer) {
    return response.status(400).json({ error: 'The selected lecturer does not exist or is not a lecturer' });
  }

  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .insert({
      code: parsed.data.code,
      title: parsed.data.title,
      description: parsed.data.description,
      department: parsed.data.department,
      lecturer_id: parsed.data.lecturerId,
      published: parsed.data.published,
    })
    .select('id, code, title, description, department, lecturer_id, published, created_at')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    console.error('Unable to create course', error.message);
    return response.status(status).json({ error: status === 409 ? 'A course with that code already exists' : 'Unable to create course' });
  }

  return response.status(201).json({ data: course });
});

app.post('/api/admin/courses/:courseId/enrolments', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  if (!await requireAdministrator(request)) {
    return response.status(403).json({ error: 'Administrator permission required' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  const parsed = enrolmentSchema.safeParse(request.body);
  if (!courseId.success || !parsed.success) {
    return response.status(400).json({ error: 'A valid course and student enrolment are required' });
  }

  const { data: student } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.studentId)
    .eq('role', 'student')
    .maybeSingle();

  if (!student) {
    return response.status(400).json({ error: 'The selected user does not exist or is not a student' });
  }

  const { data: enrolment, error } = await supabaseAdmin
    .from('course_enrolments')
    .insert({
      course_id: courseId.data,
      student_id: parsed.data.studentId,
      start_at: parsed.data.startAt ?? null,
      end_at: parsed.data.endAt ?? null,
    })
    .select('course_id, student_id, enrolled_at')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    console.error('Unable to enrol student', error.message);
    return response.status(status).json({ error: status === 409 ? 'Student is already enrolled in this course' : 'Unable to enrol student' });
  }

  return response.status(201).json({ data: enrolment });
});

app.get('/api/admin/courses/:courseId/enrolments', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  if (!await requireAdministrator(request)) {
    return response.status(403).json({ error: 'Administrator permission required' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const { data, error } = await supabaseAdmin
    .from('course_enrolments')
    .select('course_id, student_id, enrolled_at, start_at, end_at')
    .eq('course_id', courseId.data)
    .order('enrolled_at', { ascending: false });
  if (error) {
    console.error('Unable to load course enrolments', error.message);
    return response.status(500).json({ error: 'Unable to load course enrolments' });
  }

  const studentIds = (data ?? []).map((item) => item.student_id);
  const { data: profiles } = studentIds.length
    ? await supabaseAdmin.from('profiles').select('id, display_name, matric_number').in('id', studentIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return response.json({
    data: (data ?? []).map((item) => ({ ...item, student: profileById.get(item.student_id) ?? null })),
  });
});

app.delete('/api/admin/courses/:courseId/enrolments/:studentId', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  if (!await requireAdministrator(request)) {
    return response.status(403).json({ error: 'Administrator permission required' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  const studentId = z.string().uuid().safeParse(request.params.studentId);
  if (!courseId.success || !studentId.success) {
    return response.status(400).json({ error: 'A valid course and student are required' });
  }

  const { error } = await supabaseAdmin
    .from('course_enrolments')
    .delete()
    .eq('course_id', courseId.data)
    .eq('student_id', studentId.data);

  if (error) {
    console.error('Unable to remove enrolment', error.message);
    return response.status(500).json({ error: 'Unable to remove enrolment' });
  }

  return response.status(204).send();
});

app.post('/api/lecturer/assignments', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const parsed = assignmentCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid course, title, due date, and maximum score are required' });
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id')
    .eq('id', parsed.data.courseId)
    .maybeSingle();

  if (!course) {
    return response.status(404).json({ error: 'Course not found' });
  }

  const authenticatedUserId = lecturer.user.id;
  const roleFromAuth = resolveUserRole(lecturer.user);
  if (course.lecturer_id !== authenticatedUserId && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this course' });
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('assignments')
    .insert({
      course_id: parsed.data.courseId,
      created_by: authenticatedUserId,
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      due_at: parsed.data.dueAt,
      max_score: parsed.data.maxScore,
    })
    .select('id, course_id, created_by, title, instructions, due_at, max_score, created_at')
    .single();

  if (error) {
    console.error('Unable to create assignment', error.message);
    return response.status(500).json({ error: 'Unable to create assignment' });
  }

  return response.status(201).json({ data: assignment });
});

app.post('/api/lecturer/materials', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const parsed = materialCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'Valid material details, source, and accessibility information are required' });
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id')
    .eq('id', parsed.data.courseId)
    .maybeSingle();

  const roleFromAuth = resolveUserRole(lecturer.user);
  if (!course) {
    return response.status(404).json({ error: 'Course not found' });
  }
  if (course.lecturer_id !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this course' });
  }

  const { data: material, error } = await supabaseAdmin
    .from('course_materials')
    .insert({
      course_id: parsed.data.courseId,
      uploaded_by: lecturer.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      material_type: parsed.data.materialType,
      storage_path: parsed.data.storagePath ?? null,
      external_url: parsed.data.externalUrl ?? null,
      alt_text: parsed.data.altText ?? null,
      caption_path: parsed.data.captionPath ?? null,
      accessibility_status: 'passed',
      published: parsed.data.published,
    })
    .select('id, course_id, uploaded_by, title, description, material_type, storage_path, external_url, alt_text, caption_path, accessibility_status, published, created_at')
    .single();

  if (error) {
    console.error('Unable to create course material', error.message);
    return response.status(500).json({ error: 'Unable to create course material' });
  }

  return response.status(201).json({ data: material });
});

app.get('/api/courses/:courseId/materials', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const roleFromAuth = resolveUserRole(allowed.user);
  const profile = roleFromAuth ? null : (await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', allowed.user.id)
    .maybeSingle()).data;
  const isStaff = ['lecturer', 'administrator'].includes(roleFromAuth ?? profile?.role);
  let query = supabaseAdmin
    .from('course_materials')
    .select('id, course_id, uploaded_by, title, description, material_type, storage_path, external_url, alt_text, caption_path, accessibility_status, published, created_at')
    .eq('course_id', courseId.data)
    .order('created_at', { ascending: true });

  if (!isStaff) {
    query = query.eq('published', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Unable to load course materials', error.message);
    return response.status(500).json({ error: 'Unable to load course materials' });
  }

  return response.json({ data });
});

app.post('/api/lecturer/announcements', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const parsed = announcementCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid course, announcement title, and body are required' });
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id')
    .eq('id', parsed.data.courseId)
    .maybeSingle();
  const roleFromAuth = resolveUserRole(lecturer.user);

  if (!course) {
    return response.status(404).json({ error: 'Course not found' });
  }
  if (course.lecturer_id !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this course' });
  }

  const { data: announcement, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      course_id: parsed.data.courseId,
      author_id: lecturer.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .select('id, course_id, author_id, title, body, published_at, created_at')
    .single();

  if (error) {
    console.error('Unable to create announcement', error.message);
    return response.status(500).json({ error: 'Unable to create announcement' });
  }

  return response.status(201).json({ data: announcement });
});

app.get('/api/courses/:courseId/announcements', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('id, course_id, author_id, title, body, published_at, created_at')
    .eq('course_id', courseId.data)
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Unable to load announcements', error.message);
    return response.status(500).json({ error: 'Unable to load announcements' });
  }

  return response.json({ data });
});

app.get('/api/courses/:courseId/progress', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const authenticated = await requireCourseAccess(request, courseId.data);
  if (!authenticated) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data, error } = await supabaseAdmin
    .from('course_progress')
    .select('course_id, student_id, completion_percent, updated_at')
    .eq('course_id', courseId.data)
    .eq('student_id', authenticated.user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load course progress', error.message);
    return response.status(500).json({ error: 'Unable to load course progress' });
  }

  return response.json({
    data: data ?? {
      course_id: courseId.data,
      student_id: authenticated.user.id,
      completion_percent: 0,
      updated_at: null,
    },
  });
});

app.put('/api/student/courses/:courseId/progress', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const student = await requireRole(request, ['student']);
  if (!student) {
    return response.status(403).json({ error: 'Student permission required' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  const parsed = progressUpdateSchema.safeParse(request.body);
  if (!courseId.success || !parsed.success) {
    return response.status(400).json({ error: 'A valid course and completion percentage are required' });
  }

  if (!await requireCourseAccess(request, courseId.data)) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data, error } = await supabaseAdmin
    .from('course_progress')
    .upsert({
      course_id: courseId.data,
      student_id: student.user.id,
      completion_percent: parsed.data.completionPercent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'course_id,student_id' })
    .select('course_id, student_id, completion_percent, updated_at')
    .single();

  if (error) {
    console.error('Unable to update course progress', error.message);
    return response.status(500).json({ error: 'Unable to update course progress' });
  }

  return response.json({ data });
});

app.get('/api/messages/contacts', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authenticated.user.id)
    .maybeSingle();
  let contactIds = [];

  if (profile?.role === 'student') {
    const { data: enrolments } = await supabaseAdmin
      .from('course_enrolments')
      .select('course_id')
      .eq('student_id', authenticated.user.id);
    const courseIds = (enrolments ?? []).map((item) => item.course_id);
    if (courseIds.length) {
      const { data: courses } = await supabaseAdmin
        .from('courses')
        .select('lecturer_id')
        .in('id', courseIds);
      contactIds = [...new Set((courses ?? []).map((course) => course.lecturer_id))];
    }
  } else if (profile?.role === 'lecturer') {
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('lecturer_id', authenticated.user.id);
    const courseIds = (courses ?? []).map((course) => course.id);
    if (courseIds.length) {
      const { data: enrolments } = await supabaseAdmin
        .from('course_enrolments')
        .select('student_id')
        .in('course_id', courseIds);
      contactIds = [...new Set((enrolments ?? []).map((enrolment) => enrolment.student_id))];
    }
  } else if (profile?.role === 'administrator') {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .neq('id', authenticated.user.id);
    contactIds = (profiles ?? []).map((item) => item.id);
  }

  if (!contactIds.length) {
    return response.json({ data: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, matric_number, role')
    .in('id', contactIds)
    .order('display_name');
  if (error) {
    console.error('Unable to load message contacts', error.message);
    return response.status(500).json({ error: 'Unable to load message contacts' });
  }

  return response.json({ data });
});

app.get('/api/messages', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, recipient_id, body, read_at, created_at')
    .or(`sender_id.eq.${authenticated.user.id},recipient_id.eq.${authenticated.user.id}`)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Unable to load messages', error.message);
    return response.status(500).json({ error: 'Unable to load messages' });
  }

  return response.json({ data });
});

app.post('/api/messages', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  const parsed = messageCreateSchema.safeParse(request.body);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid recipient and message body are required' });
  }

  const { data: contacts } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.recipientId);
  const { data: senderProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authenticated.user.id)
    .maybeSingle();
  if (!contacts?.length || parsed.data.recipientId === authenticated.user.id) {
    return response.status(400).json({ error: 'Recipient is not available' });
  }
  if (!senderProfile) {
    return response.status(403).json({ error: 'Institutional profile required' });
  }

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({ sender_id: authenticated.user.id, recipient_id: parsed.data.recipientId, body: parsed.data.body })
    .select('id, sender_id, recipient_id, body, read_at, created_at')
    .single();
  if (error) {
    console.error('Unable to send message', error.message);
    return response.status(500).json({ error: 'Unable to send message' });
  }

  return response.status(201).json({ data: message });
});

app.patch('/api/messages/:messageId/read', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  const messageId = z.string().uuid().safeParse(request.params.messageId);
  if (!authenticated || !messageId.success) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId.data)
    .eq('recipient_id', authenticated.user.id)
    .select('id, sender_id, recipient_id, body, read_at, created_at')
    .maybeSingle();
  if (error || !data) {
    return response.status(404).json({ error: 'Message not found' });
  }

  return response.json({ data });
});

app.post('/api/lecturer/weeks', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const parsed = courseWeekSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid course week is required' });
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id')
    .eq('id', parsed.data.courseId)
    .maybeSingle();

  if (!course) {
    return response.status(404).json({ error: 'Course not found' });
  }

  const roleFromAuth = resolveUserRole(lecturer.user);
  if (course.lecturer_id !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this course' });
  }

  const { data: week, error } = await supabaseAdmin
    .from('course_weeks')
    .insert({
      course_id: parsed.data.courseId,
      created_by: lecturer.user.id,
      label: parsed.data.label,
      title: parsed.data.title,
      range: parsed.data.range,
      sort_order: (Date.now() % 1000000),
    })
    .select('id, course_id, created_by, label, title, range, sort_order, created_at')
    .single();

  if (error) {
    console.error('Unable to create course week', error.message);
    return response.status(500).json({ error: 'Unable to create course week' });
  }

  return response.status(201).json({ data: week });
});

app.get('/api/courses/:courseId/weeks', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data, error } = await supabaseAdmin
    .from('course_weeks')
    .select('id, course_id, created_by, label, title, range, sort_order, created_at')
    .eq('course_id', courseId.data)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Unable to load course weeks', error.message);
    return response.status(500).json({ error: 'Unable to load course weeks' });
  }

  return response.json({ data });
});

app.post('/api/lecturer/forums', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const parsed = forumThreadSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid forum title and discussion are required' });
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id')
    .eq('id', parsed.data.courseId)
    .maybeSingle();

  if (!course) {
    return response.status(404).json({ error: 'Course not found' });
  }

  const roleFromAuth = resolveUserRole(lecturer.user);
  if (course.lecturer_id !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this course' });
  }

  const { data: thread, error } = await supabaseAdmin
    .from('course_forums')
    .insert({
      course_id: parsed.data.courseId,
      created_by: lecturer.user.id,
      title: parsed.data.title,
      description: parsed.data.body,
    })
    .select('id, course_id, created_by, title, description, created_at')
    .single();

  if (error) {
    console.error('Unable to create forum thread', error.message);
    return response.status(500).json({ error: 'Unable to create discussion forum' });
  }

  return response.status(201).json({ data: thread });
});

app.get('/api/courses/:courseId/forums', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data: threads, error } = await supabaseAdmin
    .from('course_forums')
    .select('id, course_id, created_by, title, description, created_at')
    .eq('course_id', courseId.data)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load course forums', error.message);
    return response.status(500).json({ error: 'Unable to load course discussion forums' });
  }

  const forumIds = (threads ?? []).map((thread) => thread.id);
  const { data: posts } = forumIds.length
    ? await supabaseAdmin.from('forum_posts').select('id, forum_id, author_id, body, parent_id, created_at').in('forum_id', forumIds).order('created_at', { ascending: true })
    : { data: [] };

  return response.json({ data: { threads: threads ?? [], posts: posts ?? [] } });
});

app.post('/api/forums/:forumId/posts', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const forumId = z.string().uuid().safeParse(request.params.forumId);
  const parsed = forumReplySchema.safeParse({ ...request.body, forumId: request.params.forumId });
  if (!forumId.success || !parsed.success) {
    return response.status(400).json({ error: 'A valid forum and message are required' });
  }

  const { data: forum } = await supabaseAdmin
    .from('course_forums')
    .select('id, course_id')
    .eq('id', forumId.data)
    .maybeSingle();

  if (!forum) {
    return response.status(404).json({ error: 'Forum not found' });
  }

  const allowed = await requireCourseAccess(request, forum.course_id);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data: post, error } = await supabaseAdmin
    .from('forum_posts')
    .insert({
      forum_id: forumId.data,
      author_id: authenticated.user.id,
      body: parsed.data.body,
      parent_id: parsed.data.parentId ?? null,
    })
    .select('id, forum_id, author_id, body, parent_id, created_at')
    .single();

  if (error) {
    console.error('Unable to create forum post', error.message);
    return response.status(500).json({ error: 'Unable to create forum post' });
  }

  return response.status(201).json({ data: post });
});

app.post('/api/lecturer/quizzes', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const parsed = quizCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: 'A valid quiz with questions is required' });
  }

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, lecturer_id')
    .eq('id', parsed.data.courseId)
    .maybeSingle();

  if (!course) {
    return response.status(404).json({ error: 'Course not found' });
  }

  const roleFromAuth = resolveUserRole(lecturer.user);
  if (course.lecturer_id !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this course' });
  }

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from('quizzes')
    .insert({
      course_id: parsed.data.courseId,
      created_by: lecturer.user.id,
      title: parsed.data.title,
      instructions: parsed.data.instructions,
    })
    .select('id, course_id, created_by, title, instructions, created_at')
    .single();

  if (quizError || !quiz) {
    console.error('Unable to create quiz', quizError?.message ?? 'Quiz creation failed');
    return response.status(500).json({ error: 'Unable to create quiz' });
  }

  const { error: questionError } = await supabaseAdmin
    .from('quiz_questions')
    .insert(parsed.data.questions.map((question) => ({
      quiz_id: quiz.id,
      question: question.question,
      options: question.options,
      answer: question.answer,
      score: question.score,
    })));

  if (questionError) {
    console.error('Unable to create quiz questions', questionError.message);
    return response.status(500).json({ error: 'Unable to create quiz questions' });
  }

  return response.status(201).json({ data: quiz });
});

app.get('/api/courses/:courseId/quizzes', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data: quizzes, error } = await supabaseAdmin
    .from('quizzes')
    .select('id, course_id, created_by, title, instructions, created_at')
    .eq('course_id', courseId.data)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load quizzes', error.message);
    return response.status(500).json({ error: 'Unable to load quizzes' });
  }

  const quizIds = (quizzes ?? []).map((quiz) => quiz.id);
  const { data: questions } = quizIds.length
    ? await supabaseAdmin.from('quiz_questions').select('id, quiz_id, question, options, answer, score').in('quiz_id', quizIds)
    : { data: [] };

  return response.json({ data: { quizzes: quizzes ?? [], questions: questions ?? [] } });
});

app.get('/api/student/quizzes/:quizId/attempt', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const student = await requireRole(request, ['student']);
  const quizId = z.string().uuid().safeParse(request.params.quizId);
  if (!student) {
    return response.status(403).json({ error: 'Student permission required' });
  }
  if (!quizId.success) {
    return response.status(400).json({ error: 'A valid quiz ID is required' });
  }

  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, course_id')
    .eq('id', quizId.data)
    .maybeSingle();
  if (!quiz) {
    return response.status(404).json({ error: 'Quiz not found' });
  }

  const allowed = await requireCourseAccess(request, quiz.course_id);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data, error } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, quiz_id, student_id, responses, score, submitted_at')
    .eq('quiz_id', quizId.data)
    .eq('student_id', student.user.id)
    .maybeSingle();
  if (error) {
    console.error('Unable to load quiz attempt', error.message);
    return response.status(500).json({ error: 'Unable to load quiz attempt' });
  }

  return response.json({ data: data ?? null });
});

app.post('/api/student/quizzes/:quizId/attempt', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const student = await requireRole(request, ['student']);
  if (!student) {
    return response.status(403).json({ error: 'Student permission required' });
  }

  const quizId = z.string().uuid().safeParse(request.params.quizId);
  const parsed = quizAttemptSchema.safeParse({ ...request.body, quizId: request.params.quizId });
  if (!quizId.success || !parsed.success) {
    return response.status(400).json({ error: 'A valid quiz attempt is required' });
  }

  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, course_id')
    .eq('id', quizId.data)
    .maybeSingle();

  if (!quiz) {
    return response.status(404).json({ error: 'Quiz not found' });
  }

  const allowed = await requireCourseAccess(request, quiz.course_id);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data: questions } = await supabaseAdmin
    .from('quiz_questions')
    .select('id, answer, score')
    .eq('quiz_id', quizId.data);

  const score = (questions ?? []).reduce((total, question) => {
    const answer = parsed.data.responses[String(question.id)] ?? parsed.data.responses[question.id];
    return total + (answer && String(answer) === String(question.answer) ? Number(question.score || 0) : 0);
  }, 0);

  const { data: attempt, error } = await supabaseAdmin
    .from('quiz_attempts')
    .upsert({
      quiz_id: quizId.data,
      student_id: student.user.id,
      responses: parsed.data.responses,
      score,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'quiz_id,student_id' })
    .select('id, quiz_id, student_id, responses, score, submitted_at')
    .single();

  if (error) {
    console.error('Unable to submit quiz attempt', error.message);
    return response.status(500).json({ error: 'Unable to submit quiz attempt' });
  }

  return response.status(201).json({ data: attempt });
});

app.get('/api/courses/:courseId/analytics', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const [{ data: studentsData }, { data: assignmentsData }, { data: submissionsData }, { data: progressData }] = await Promise.all([
    supabaseAdmin.from('course_enrolments').select('student_id').eq('course_id', courseId.data),
    supabaseAdmin.from('assignments').select('id, max_score').eq('course_id', courseId.data),
    supabaseAdmin.from('submissions').select('assignment_id, score').in('assignment_id', (await supabaseAdmin.from('assignments').select('id').eq('course_id', courseId.data)).data?.map((assignment) => assignment.id) ?? []),
    supabaseAdmin.from('course_progress').select('completion_percent').eq('course_id', courseId.data),
  ]);

  const analytics = buildCourseAnalytics({
    totalStudents: studentsData?.length ?? 0,
    assignments: assignmentsData ?? [],
    submissions: submissionsData ?? [],
    progress: progressData ?? [],
  });

  return response.json({ data: analytics });
});

app.get('/api/courses/:courseId/gradebook', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const authenticated = await requireCourseAccess(request, courseId.data);
  if (!authenticated) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const roleFromAuth = resolveUserRole(authenticated.user);
  const profileRole = roleFromAuth ? null : (await supabaseAdmin.from('profiles').select('role').eq('id', authenticated.user.id).maybeSingle()).data?.role;
  const isStaff = ['lecturer', 'administrator'].includes(roleFromAuth ?? profileRole);
  const [{ data: assignments }, { data: quizzes }, { data: enrolments }] = await Promise.all([
    supabaseAdmin.from('assignments').select('id, title, max_score').eq('course_id', courseId.data).order('due_at', { ascending: true }),
    supabaseAdmin.from('quizzes').select('id, title').eq('course_id', courseId.data).order('created_at', { ascending: true }),
    supabaseAdmin.from('course_enrolments').select('student_id').eq('course_id', courseId.data),
  ]);
  const assignmentIds = (assignments ?? []).map((item) => item.id);
  const quizIds = (quizzes ?? []).map((item) => item.id);
  const studentIds = isStaff ? (enrolments ?? []).map((item) => item.student_id) : [authenticated.user.id];
  const [{ data: submissions }, { data: attempts }, { data: profiles }] = await Promise.all([
    assignmentIds.length ? supabaseAdmin.from('submissions').select('assignment_id, student_id, storage_path, content, score, feedback, submitted_at, graded_at').in('assignment_id', assignmentIds).in('student_id', studentIds) : Promise.resolve({ data: [] }),
    quizIds.length ? supabaseAdmin.from('quiz_attempts').select('quiz_id, student_id, score, submitted_at').in('quiz_id', quizIds).in('student_id', studentIds) : Promise.resolve({ data: [] }),
    isStaff && studentIds.length ? supabaseAdmin.from('profiles').select('id, display_name').in('id', studentIds) : Promise.resolve({ data: [] }),
  ]);

  return response.json({ data: { assignments: assignments ?? [], quizzes: quizzes ?? [], submissions: submissions ?? [], attempts: attempts ?? [], students: profiles ?? [] } });
});

app.get('/api/courses/:courseId/assignments', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const courseId = z.string().uuid().safeParse(request.params.courseId);
  if (!courseId.success) {
    return response.status(400).json({ error: 'A valid course ID is required' });
  }

  const allowed = await requireCourseAccess(request, courseId.data);
  if (!allowed) {
    return response.status(403).json({ error: 'Course access required' });
  }

  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('id, course_id, created_by, title, instructions, due_at, max_score, created_at')
    .eq('course_id', courseId.data)
    .order('due_at', { ascending: true });

  if (error) {
    console.error('Unable to load assignments', error.message);
    return response.status(500).json({ error: 'Unable to load assignments' });
  }

  return response.json({ data });
});

app.post('/api/student/assignments/:assignmentId/submit', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const student = await requireRole(request, ['student', 'administrator']);
  if (!student) {
    return response.status(403).json({ error: 'Student permission required' });
  }

  const assignmentId = z.string().uuid().safeParse(request.params.assignmentId);
  const parsed = assignmentSubmissionSchema.safeParse({ ...request.body, assignmentId: request.params.assignmentId });
  if (!assignmentId.success || !parsed.success) {
    return response.status(400).json({ error: 'A valid assignment and submission are required' });
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from('assignments')
    .select('id, course_id, due_at, created_by')
    .eq('id', assignmentId.data)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return response.status(404).json({ error: 'Assignment not found' });
  }

  const allowed = await requireCourseAccess(request, assignment.course_id);
  if (!allowed || student.user.id === assignment.created_by) {
    return response.status(403).json({ error: 'You cannot submit to this assignment' });
  }

  const submissionPath = parsed.data.fileName ? parsed.data.fileName : `submission-${Date.now()}.txt`;
  let storedPath = submissionPath;
  if (parsed.data.fileData) {
    const fileMatch = parsed.data.fileData.match(/^data:([^;]+);base64,(.+)$/);
    if (!fileMatch) {
      return response.status(400).json({ error: 'The uploaded file is invalid' });
    }
    const safeFileName = submissionPath.replace(/[^a-zA-Z0-9._-]/g, '_');
    storedPath = `${student.user.id}/${assignmentId.data}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('course-submissions')
      .upload(storedPath, Buffer.from(fileMatch[2], 'base64'), { contentType: fileMatch[1], upsert: true });
    if (uploadError) {
      console.error('Unable to upload assignment file', uploadError.message);
      return response.status(500).json({ error: 'Unable to upload assignment file' });
    }
  }
  const { data: submission, error } = await supabaseAdmin
    .from('submissions')
    .upsert({
      assignment_id: assignmentId.data,
      student_id: student.user.id,
      storage_path: storedPath,
      content: parsed.data.content,
      submitted_at: new Date().toISOString(),
      score: null,
      feedback: null,
      graded_at: null,
    }, { onConflict: 'assignment_id,student_id' })
    .select('id, assignment_id, student_id, storage_path, content, submitted_at, score, feedback, graded_at')
    .single();

  if (error) {
    console.error('Unable to submit assignment', error.message);
    return response.status(500).json({ error: 'Unable to submit assignment' });
  }

  return response.status(201).json({ data: submission });
});

app.get('/api/student/assignments/:assignmentId/submission', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const student = await requireRole(request, ['student']);
  const assignmentId = z.string().uuid().safeParse(request.params.assignmentId);
  if (!student || !assignmentId.success) {
    return response.status(403).json({ error: 'Student permission required' });
  }

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('id, assignment_id, student_id, storage_path, content, submitted_at, score, feedback, graded_at')
    .eq('assignment_id', assignmentId.data)
    .eq('student_id', student.user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load student submission', error.message);
    return response.status(500).json({ error: 'Unable to load student submission' });
  }

  return response.json({ data });
});

app.get('/api/submissions/:submissionId/download', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  const submissionId = z.string().uuid().safeParse(request.params.submissionId);
  if (!authenticated || !submissionId.success) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select('id, student_id, storage_path, assignment_id')
    .eq('id', submissionId.data)
    .maybeSingle();
  if (!submission) {
    return response.status(404).json({ error: 'Submission not found' });
  }

  const { data: assignment } = await supabaseAdmin
    .from('assignments')
    .select('course_id, created_by')
    .eq('id', submission.assignment_id)
    .maybeSingle();
  const allowed = assignment ? await requireCourseAccess(request, assignment.course_id) : null;
  if (!allowed || (submission.student_id !== authenticated.user.id && assignment.created_by !== authenticated.user.id && resolveUserRole(authenticated.user) !== 'administrator')) {
    return response.status(403).json({ error: 'You cannot download this submission' });
  }
  if (!submission.storage_path.includes('/')) {
    return response.status(404).json({ error: 'No uploaded file is attached to this submission' });
  }

  const { data: signed, error } = await supabaseAdmin.storage.from('course-submissions').createSignedUrl(submission.storage_path, 3600);
  if (error || !signed?.signedUrl) {
    console.error('Unable to create submission download URL', error?.message ?? 'no signed URL');
    return response.status(500).json({ error: 'Unable to create submission download URL' });
  }
  return response.json({ data: { url: signed.signedUrl } });
});

app.post('/api/lecturer/assignments/:assignmentId/grade', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  if (!lecturer) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const assignmentId = z.string().uuid().safeParse(request.params.assignmentId);
  const parsed = assignmentGradeSchema.safeParse({ ...request.body, studentId: request.body?.studentId });
  if (!assignmentId.success || !parsed.success) {
    return response.status(400).json({ error: 'A valid assignment, student, and grade are required' });
  }

  const { data: assignment } = await supabaseAdmin
    .from('assignments')
    .select('id, course_id, created_by')
    .eq('id', assignmentId.data)
    .maybeSingle();

  if (!assignment) {
    return response.status(404).json({ error: 'Assignment not found' });
  }

  const roleFromAuth = resolveUserRole(lecturer.user);
  if (assignment.created_by !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this assignment' });
  }

  const { data: submission, error } = await supabaseAdmin
    .from('submissions')
    .update({
      score: parsed.data.score,
      feedback: parsed.data.feedback,
      graded_at: new Date().toISOString(),
    })
    .eq('assignment_id', assignmentId.data)
    .eq('student_id', parsed.data.studentId)
    .select('id, assignment_id, student_id, storage_path, content, submitted_at, score, feedback, graded_at')
    .single();

  if (error || !submission) {
    console.error('Unable to grade assignment', error?.message ?? 'no submission found');
    return response.status(404).json({ error: 'Submission not found' });
  }

  return response.json({ data: submission });
});

app.get('/api/lecturer/assignments/:assignmentId/submissions', async (request, response) => {
  if (!supabaseAdmin) {
    return response.status(503).json({ error: 'Institutional provisioning is not configured' });
  }

  const lecturer = await requireRole(request, ['lecturer', 'administrator']);
  const assignmentId = z.string().uuid().safeParse(request.params.assignmentId);
  if (!lecturer || !assignmentId.success) {
    return response.status(403).json({ error: 'Lecturer permission required' });
  }

  const { data: assignment } = await supabaseAdmin
    .from('assignments')
    .select('id, course_id, created_by')
    .eq('id', assignmentId.data)
    .maybeSingle();
  const roleFromAuth = resolveUserRole(lecturer.user);
  if (!assignment) {
    return response.status(404).json({ error: 'Assignment not found' });
  }
  if (assignment.created_by !== lecturer.user.id && roleFromAuth !== 'administrator') {
    return response.status(403).json({ error: 'You do not manage this assignment' });
  }

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('id, assignment_id, student_id, storage_path, content, submitted_at, score, feedback, graded_at')
    .eq('assignment_id', assignmentId.data)
    .order('submitted_at', { ascending: true });

  if (error) {
    console.error('Unable to load assignment submissions', error.message);
    return response.status(500).json({ error: 'Unable to load assignment submissions' });
  }

  return response.json({ data });
});

app.get('/api/courses', async (request, response) => {
  if (!supabase || !supabaseAdmin) {
    return response.status(503).json({ error: 'Database is not configured' });
  }

  const authenticated = await getAuthenticatedClient(request);
  if (!authenticated) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  const roleFromAuth = resolveUserRole(authenticated.user);
  const { data: profile } = roleFromAuth ? { data: null } : await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authenticated.user.id)
    .maybeSingle();
  const role = roleFromAuth ?? profile?.role;

  let query = supabaseAdmin
    .from('courses')
    .select('id, code, title, description, department, lecturer_id, published, created_at')
    .order('code');

  if (role === 'lecturer') {
    query = query.eq('lecturer_id', authenticated.user.id);
  } else if (role === 'student') {
    const { data: enrolments, error: enrolmentError } = await supabaseAdmin
      .from('course_enrolments')
      .select('course_id')
      .eq('student_id', authenticated.user.id);

    if (enrolmentError) {
      console.error('Unable to load course enrolments', enrolmentError.message);
      return response.status(500).json({ error: 'Unable to load courses' });
    }

    const enrolledCourseIds = (enrolments ?? []).map((enrolment) => enrolment.course_id);
    const { data: courses, error: courseError } = await query;
    if (courseError) {
      console.error('Unable to load courses', courseError.message);
      return response.status(500).json({ error: 'Unable to load courses' });
    }

    return response.json({
      data: (courses ?? []).filter((course) => course.published || enrolledCourseIds.includes(course.id)),
    });
  } else if (role !== 'administrator') {
    return response.status(403).json({ error: 'A valid institutional role is required' });
  }

  const { data, error } = await query;
  if (error) {
    console.error('Unable to load courses', error.message);
    return response.status(500).json({ error: 'Unable to load courses' });
  }

  return response.json({ data });
});

app.get('/', (_request, response) => {
  response.sendFile(path.join(publicDirectory, 'index.html'));
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.listen(port, () => {
  console.log(`FULokoja LMS API listening on port ${port}`);
});