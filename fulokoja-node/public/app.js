import {
  getPersistedToken,
  setPersistedToken,
  clearPersistedToken,
  saveDraft,
  loadDraft,
  saveContext,
  loadContext,
} from './storage.js';

const state = {
  token: getPersistedToken(),
  user: null,
  courses: [],
  selectedCourse: null,
  courseData: {},
  messages: [],
  contacts: [],
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload;
}

function showAppError(message) {
  const element = $('#app-error');
  element.textContent = message;
  element.hidden = !message;
}

function renderMessages() {
  const currentUserId = state.user.id;
  const unread = state.messages.filter((message) => message.recipient_id === currentUserId && !message.read_at).length;
  saveContext({ lastOpenMessages: new Date().toISOString() });
  $('#unread-count').textContent = unread;
  $('#unread-count').hidden = unread === 0;
  const contactMap = new Map(state.contacts.map((contact) => [contact.id, contact]));
  $('#message-list').innerHTML = state.messages.length ? state.messages.map((message) => {
    const otherId = message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    const contact = contactMap.get(otherId);
    const unreadClass = message.recipient_id === currentUserId && !message.read_at ? ' message-unread' : '';
    return `<article class="message-item${unreadClass}" data-message-id="${message.id}"><div class="message-meta"><strong>${escapeHtml(contact?.display_name || otherId)}</strong><time>${new Date(message.created_at).toLocaleString()}</time></div><p>${escapeHtml(message.body)}</p>${message.recipient_id === currentUserId && !message.read_at ? '<button class="btn btn-link mark-read" type="button">Mark read</button>' : ''}</article>`;
  }).join('') : '<p class="muted">No messages yet.</p>';
  $('#message-recipient').innerHTML = '<option value="">Choose a contact</option>' + state.contacts.map((contact) => `<option value="${contact.id}">${escapeHtml(contact.display_name)} (${escapeHtml(contact.role)})</option>`).join('');
  document.querySelectorAll('.mark-read').forEach((button) => button.addEventListener('click', markMessageRead));
}

function applyAccessibilityPreferences(preferences = {}) {
  document.documentElement.classList.toggle('text-large', preferences.textSize === 'large');
  document.documentElement.classList.toggle('text-extra-large', preferences.textSize === 'extra-large');
  document.documentElement.classList.toggle('high-contrast', preferences.highContrast === true);
  $('#text-size').value = preferences.textSize || 'normal';
  $('#high-contrast').checked = preferences.highContrast === true;
  $('#captions-preferred').checked = preferences.captionsPreferred === true;
}

async function openAccessibility() {
  state.selectedCourse = null;
  $('#dashboard-panel').hidden = true;
  $('#course-panel').hidden = true;
  $('#messages-panel').hidden = true;
  $('#accessibility-panel').hidden = false;
  $('#breadcrumb-current').textContent = 'Accessibility settings';
  try {
    const preferences = await api('/api/profile/preferences');
    applyAccessibilityPreferences(preferences.data);
  } catch (error) {
    showAppError(error.message);
  }
}

  async function openUserManagement() {
    state.selectedCourse = null;
    $('#dashboard-panel').hidden = true;
    $('#course-panel').hidden = true;
    $('#messages-panel').hidden = true;
    $('#accessibility-panel').hidden = true;
    $('#user-management-panel').hidden = false;
    $('#breadcrumb-current').textContent = 'User management';
    try {
      const users = await api('/api/admin/users');
      $('#user-list').innerHTML = users.data.length ? `<table class="user-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Matric number</th><th>Accessibility</th></tr></thead><tbody>${users.data.map((user) => `<tr><td>${escapeHtml(user.display_name)}</td><td>${escapeHtml(user.email || 'No email')}</td><td><span class="role-chip">${escapeHtml(user.role)}</span></td><td>${escapeHtml(user.matric_number || 'Not provided')}</td><td>${Object.keys(user.accessibility_preferences || {}).length ? 'Configured' : 'Default settings'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No institutional users found.</p>';
    } catch (error) {
      showAppError(error.message);
    }
  }

async function openMessages() {
  state.selectedCourse = null;
  $('#dashboard-panel').hidden = true;
  $('#course-panel').hidden = true;
  $('#messages-panel').hidden = false;
  $('#breadcrumb-current').textContent = 'Messages';
  try {
    const [messages, contacts] = await Promise.all([api('/api/messages'), api('/api/messages/contacts')]);
    state.messages = messages.data || [];
    state.contacts = contacts.data || [];
    renderMessages();
  } catch (error) {
    showAppError(error.message);
  }
}

async function markMessageRead(event) {
  const messageId = event.currentTarget.closest('[data-message-id]').dataset.messageId;
  try {
    await api(`/api/messages/${messageId}/read`, { method: 'PATCH' });
    await openMessages();
  } catch (error) {
    showAppError(error.message);
  }
}

function decodeUser(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { id: payload.sub, email: payload.email || 'University user', role: payload.app_metadata?.role || payload.user_metadata?.role || 'student' };
  } catch {
    return { id: null, email: 'University user', role: 'student' };
  }
}

function setRoleDashboard() {
  const dashboards = {
    student: {
      eyebrow: 'Learner home',
      heading: 'Keep your learning moving.',
      copy: 'Choose a course from the navigation drawer to view your materials, announcements, and assignments.',
    },
    lecturer: {
      eyebrow: 'Teaching home',
      heading: 'Manage your teaching.',
      copy: 'Open a course to review its materials, announcements, and assignments for your students.',
    },
    administrator: {
      eyebrow: 'Administration home',
      heading: 'Keep the university learning space organised.',
      copy: 'Review courses and institutional activity from the administration dashboard.',
    },
  };
  const dashboard = dashboards[state.user.role] || dashboards.student;
  $('#page-eyebrow').textContent = dashboard.eyebrow;
  $('#welcome-heading').textContent = dashboard.heading;
  $('#welcome-copy').textContent = dashboard.copy;
  const courseLabels = { student: 'My courses', lecturer: 'Teaching courses', administrator: 'Institutional courses' };
  $('#course-section-label').textContent = courseLabels[state.user.role] || courseLabels.student;
  $('#user-management-link').hidden = state.user.role !== 'administrator';
  $('#course-management-link').hidden = state.user.role !== 'administrator';
}

function renderCourses() {
  const courseList = $('#course-list');
  if (!state.courses.length) {
    courseList.innerHTML = '<p class="muted drawer-empty">No courses available.</p>';
    return;
  }
  courseList.innerHTML = state.courses.map((course) => `<a class="course-link ${state.selectedCourse?.id === course.id ? 'active' : ''}" href="#course/${course.id}" data-course-id="${course.id}">${escapeHtml(course.code)}<small>${escapeHtml(course.title)}</small></a>`).join('');
  courseList.querySelectorAll('[data-course-id]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    openCourse(link.dataset.courseId);
  }));
}

function renderRecentActivity() {
  const container = $('#recent-activity');
  const items = [];

  Object.values(state.courseData).forEach((courseData) => {
    (courseData.announcements || []).slice(0, 2).forEach((announcement) => {
      items.push({
        title: announcement.title,
        detail: `Announcement · ${announcement.course_id || state.selectedCourse?.id || 'Course'}`,
        time: new Date(announcement.published_at || announcement.created_at || Date.now()).toLocaleDateString(),
      });
    });
    (courseData.assignments || []).slice(0, 2).forEach((assignment) => {
      items.push({
        title: assignment.title,
        detail: `Assignment due ${new Date(assignment.due_at).toLocaleDateString()}`,
        time: new Date(assignment.due_at).toLocaleDateString(),
      });
    });
  });

  if (!items.length) {
    container.innerHTML = '<p class="muted">Your course activity will appear here.</p>';
    return;
  }

  container.innerHTML = items.slice(0, 5).map((item) => `<div class="activity-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span><small>${escapeHtml(item.time)}</small></div>`).join('');
}

function renderDashboard() {
  setRoleDashboard();
  $('#course-count').textContent = state.courses.length;
  $('#assignment-count').textContent = Object.values(state.courseData).reduce((total, data) => total + (data.assignments?.length || 0), 0);
  $('#session-user').textContent = `${state.user.email} | ${state.user.role}`;
  $('#user-role').textContent = state.user.role;
  renderRecentActivity();
  renderCourses();
}

function renderContentList(items, type) {
  if (!items?.length) return '<div class="empty-state">There is nothing here yet.</div>';
  if (type === 'materials') {
    return items.map((item) => `<article class="content-item"><h2>${escapeHtml(item.title)}</h2><p class="content-meta">${escapeHtml(item.material_type)} | ${item.accessibility_status === 'passed' ? 'Accessibility checked' : 'Accessibility pending'}</p><p>${escapeHtml(item.description || 'No description provided.')}</p>${item.external_url ? `<a href="${escapeHtml(item.external_url)}" target="_blank" rel="noreferrer">Open material</a>` : ''}</article>`).join('');
  }
  if (type === 'announcements') {
    return items.map((item) => `<article class="content-item"><h2>${escapeHtml(item.title)}</h2><p class="content-meta">${new Date(item.published_at).toLocaleString()}</p><p>${escapeHtml(item.body)}</p></article>`).join('');
  }
  return items.map((item) => {
    const submission = state.courseData[state.selectedCourse.id].submissions?.[item.id];
    const studentAction = state.user.role === 'student'
      ? `<form class="submission-form" data-assignment-id="${item.id}"><label for="file-${item.id}">Upload file</label><input id="file-${item.id}" name="file" type="file"><label for="content-${item.id}">Your response</label><textarea id="content-${item.id}" name="content" rows="4" maxlength="100000" required>${escapeHtml(submission?.content || '')}</textarea><button class="btn btn-primary" type="submit">${submission ? 'Resubmit assignment' : 'Submit assignment'}</button>${submission?.storage_path?.includes('/') ? `<p class="content-meta">File uploaded: ${escapeHtml(submission.storage_path.split('/').pop())}</p>` : ''}${submission?.score !== null && submission?.score !== undefined ? `<p class="submission-result"><strong>Grade: ${escapeHtml(submission.score)} / ${escapeHtml(item.max_score)}</strong><br>${escapeHtml(submission.feedback || 'No feedback provided.')}</p>` : submission ? '<p class="content-meta">Submitted. Awaiting grading.</p>' : ''}</form>`
      : '';
    const lecturerAction = ['lecturer', 'administrator'].includes(state.user.role)
      ? `<div class="submission-list"><p class="content-meta">${submission?.length || 0} submission(s)</p>${(submission || []).map((entry) => `<form class="grading-form" data-assignment-id="${item.id}" data-student-id="${entry.student_id}"><p><strong>Student:</strong> ${escapeHtml(entry.student_id)}<br><span class="content-meta">Submitted ${new Date(entry.submitted_at).toLocaleString()}</span></p><label>Score<input name="score" type="number" min="0" max="${item.max_score}" step="0.01" value="${entry.score ?? ''}" required></label><label>Feedback<textarea name="feedback" rows="3">${escapeHtml(entry.feedback || '')}</textarea></label><button class="btn btn-secondary" type="submit">Save grade</button></form>`).join('')}</div>`
      : '';
    return `<article class="content-item"><h2>${escapeHtml(item.title)}</h2><p class="content-meta">Due ${new Date(item.due_at).toLocaleString()} | Maximum score ${escapeHtml(item.max_score)}</p><p>${escapeHtml(item.instructions || 'No instructions provided.')}</p>${studentAction}${lecturerAction}</article>`;
  }).join('');
}

function buildCourseWeekPlan(courseId, data) {
  const weeks = [];
  const entries = [
    ...(data?.materials ?? []).map((item) => ({ ...item, kind: 'material', sortKey: new Date(item.created_at || Date.now()).getTime() })),
    ...(data?.assignments ?? []).map((item) => ({ ...item, kind: 'assignment', sortKey: new Date(item.due_at || item.created_at || Date.now()).getTime() })),
    ...(data?.announcements ?? []).map((item) => ({ ...item, kind: 'announcement', sortKey: new Date(item.published_at || item.created_at || Date.now()).getTime() })),
  ].sort((left, right) => left.sortKey - right.sortKey);

  const savedWeeks = state.courseData[courseId]?.weeks ?? [];
  const customWeekCount = savedWeeks.length;
  const baseWeekCount = Math.max(1, customWeekCount || Math.min(12, entries.length ? Math.ceil(entries.length / 2) : 1));

  for (let index = 1; index <= baseWeekCount; index += 1) {
    const saved = savedWeeks[index - 1];
    const weekLabel = saved?.label || `Week ${index}`;
    const weekTitle = saved?.title || `Teaching week ${index}`;
    const weekEntries = [];
    const weekRange = saved?.range || `Current learning week ${index}`;

    entries.forEach((entry) => {
      const entryWeek = Math.max(1, Math.ceil(((entry.sortKey / 86400000) + 1) / 7));
      if (entryWeek === index) {
        weekEntries.push(entry);
      }
    });

    weeks.push({
      id: `week-${index}`,
      label: weekLabel,
      title: weekTitle,
      range: weekRange,
      entries: weekEntries,
    });
  }

  if (!weeks.length) {
    weeks.push({ id: 'week-1', label: 'Week 1', title: 'Teaching week 1', range: 'Course launch', entries: [] });
  }

  return weeks;
}

function renderWeekPlan(weeks, courseId) {
  return weeks.map((week) => `
    <section class="card week-card">
      <div class="week-header">
        <div>
          <p class="eyebrow">${escapeHtml(week.label)}</p>
          <h3>${escapeHtml(week.title)}</h3>
        </div>
        <span class="week-range">${escapeHtml(week.range)}</span>
      </div>
      <div class="week-entry-list">
        ${week.entries.length ? week.entries.map((entry) => {
          if (entry.kind === 'material') {
            return `<article class="week-entry"><strong>Material:</strong> ${escapeHtml(entry.title)}<p>${escapeHtml(entry.description || 'No description provided.')}</p></article>`;
          }
          if (entry.kind === 'announcement') {
            return `<article class="week-entry"><strong>Announcement:</strong> ${escapeHtml(entry.title)}<p>${escapeHtml(entry.body || 'No details provided.')}</p></article>`;
          }
          return `<article class="week-entry"><strong>Assignment:</strong> ${escapeHtml(entry.title)}<p>Due ${new Date(entry.due_at).toLocaleString()} | Max score ${escapeHtml(entry.max_score)}</p></article>`;
        }).join('') : '<p class="muted">No items scheduled for this week yet.</p>'}
      </div>
    </section>
  `).join('');
}

function renderForums(data) {
  const forums = data.forums || { threads: [], posts: [] };
  if (!forums.threads.length) return '<div class="empty-state">No discussion forums have been created yet.</div>';
  return forums.threads.map((thread) => {
    const posts = forums.posts.filter((post) => post.forum_id === thread.id);
    return `<article class="content-item forum-thread"><h2>${escapeHtml(thread.title)}</h2><p>${escapeHtml(thread.description)}</p><div class="forum-post-list">${posts.length ? posts.map((post) => `<div class="forum-post"><p>${escapeHtml(post.body)}</p><small>${new Date(post.created_at).toLocaleString()}</small></div>`).join('') : '<p class="muted">No replies yet.</p>'}</div><form class="forum-reply-form" data-forum-id="${thread.id}"><label>Reply<textarea name="body" rows="3" maxlength="20000" required></textarea></label><button class="btn btn-secondary" type="submit">Post reply</button></form></article>`;
  }).join('');
}

function renderQuizzes(data) {
  const quizzes = data.quizzes || { quizzes: [], questions: [] };
  if (!quizzes.quizzes.length) return '<div class="empty-state">No quizzes have been created yet.</div>';
  return quizzes.quizzes.map((quiz) => {
    const questions = quizzes.questions.filter((question) => question.quiz_id === quiz.id);
    const questionsMarkup = questions.map((question, index) => `<fieldset class="quiz-question"><legend>${index + 1}. ${escapeHtml(question.question)} (${escapeHtml(question.score)} mark${question.score === 1 ? '' : 's'})</legend>${(question.options || []).map((option) => `<label class="quiz-option"><input type="radio" name="question-${question.id}" value="${escapeHtml(option)}" required>${escapeHtml(option)}</label>`).join('')}</fieldset>`).join('');
    const attempt = data.quizAttempts?.[quiz.id];
    return `<article class="content-item quiz-item"><h2>${escapeHtml(quiz.title)}</h2><p>${escapeHtml(quiz.instructions || 'Answer all questions and submit your attempt.')}</p>${state.user.role === 'student' ? `<form class="quiz-form" data-quiz-id="${quiz.id}">${questionsMarkup}<button class="btn btn-primary" type="submit">Submit quiz</button>${attempt ? `<p class="submission-result"><strong>Score: ${escapeHtml(attempt.score)}</strong><br>Submitted ${new Date(attempt.submitted_at).toLocaleString()}</p>` : ''}</form>` : `<p class="content-meta">${questions.length} question(s)</p>`}</article>`;
  }).join('');
}

function renderAnalytics(analytics) {
  if (!analytics) return '';
  return `<section class="card analytics-card"><h2>Course analytics</h2><div class="student-summary-grid"><div><span>Students</span><strong>${analytics.students}</strong></div><div><span>Average progress</span><strong>${analytics.averageProgress}%</strong></div><div><span>Submission rate</span><strong>${analytics.submissionRate}%</strong></div><div><span>Average grade</span><strong>${analytics.averageGrade}%</strong></div><div><span>Graded submissions</span><strong>${analytics.gradedSubmissions}</strong></div><div><span>Awaiting grading</span><strong>${analytics.pendingSubmissions}</strong></div></div></section>`;
}

function renderGrades(data) {
  const gradebook = data.gradebook || { assignments: [], submissions: [], quizzes: [], attempts: [], students: [] };
  const submissionByKey = new Map(gradebook.submissions.map((item) => [`${item.student_id}:${item.assignment_id}`, item]));
  const attemptByKey = new Map(gradebook.attempts.map((item) => [`${item.student_id}:${item.quiz_id}`, item]));
  const students = gradebook.students.length ? gradebook.students : [{ id: state.user.id, display_name: state.user.displayName || state.user.email }];
  return `<section class="card gradebook-card"><h2>Gradebook</h2><div class="user-list"><table class="user-table"><thead><tr><th>Student</th>${gradebook.assignments.map((item) => `<th>${escapeHtml(item.title)}</th>`).join('')}${gradebook.quizzes.map((item) => `<th>${escapeHtml(item.title)}</th>`).join('')}<th>Average</th></tr></thead><tbody>${students.map((student) => { const scores = [...gradebook.assignments.map((item) => { const submission = submissionByKey.get(`${student.id}:${item.id}`); return submission?.score === null || submission?.score === undefined ? null : Number(submission.score) / Number(item.max_score || 100) * 100; }), ...gradebook.quizzes.map((item) => { const attempt = attemptByKey.get(`${student.id}:${item.id}`); return attempt?.score === null || attempt?.score === undefined ? null : Number(attempt.score); })].filter((score) => score !== null); const average = scores.length ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)}%` : '—'; return `<tr><td>${escapeHtml(student.display_name || student.email || student.id)}</td>${gradebook.assignments.map((item) => { const submission = submissionByKey.get(`${student.id}:${item.id}`); return `<td>${submission?.score === null || submission?.score === undefined ? 'Pending' : `${submission.score}/${item.max_score}`}</td>`; }).join('')}${gradebook.quizzes.map((item) => { const attempt = attemptByKey.get(`${student.id}:${item.id}`); return `<td>${attempt?.score === null || attempt?.score === undefined ? 'Not attempted' : escapeHtml(attempt.score)}</td>`; }).join('')}<td><strong>${average}</strong></td></tr>`; }).join('')}</tbody></table></div></section>`;
}

function renderCourseTab(tab) {
  const course = state.selectedCourse;
  const data = state.courseData[course.id];
  $('.secondary-tab.active')?.classList.remove('active');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  if (tab === 'overview') {
    const progress = data.progress?.completion_percent ?? 0;
    const submissions = Object.values(data.submissions || {}).flatMap((value) => Array.isArray(value) ? value : [value]);
    const gradeSummary = state.user.role === 'student' ? `
      <section class="card student-summary-card">
        <h2>Assessment summary</h2>
        <div class="student-summary-grid">
          <div><span>Completed work</span><strong>${submissions.filter((item) => item?.score !== null && item?.score !== undefined).length}</strong></div>
          <div><span>Average score</span><strong>${submissions.length ? `${(submissions.filter((item) => item?.score !== null && item?.score !== undefined).reduce((sum, item) => sum + Number(item.score || 0), 0) / submissions.filter((item) => item?.score !== null && item?.score !== undefined).length).toFixed(1)}%` : '—'}</strong></div>
          <div><span>Pending grading</span><strong>${submissions.filter((item) => item && item.score === null).length}</strong></div>
        </div>
      </section>
    ` : '';
    const progressControl = state.user.role === 'student'
      ? `<form id="progress-form" class="progress-form"><label for="progress-input">Update completion</label><div class="progress-form-row"><input id="progress-input" type="number" min="0" max="100" step="1" value="${progress}"><span>%</span><button class="btn btn-primary" type="submit">Save progress</button></div></form>`
      : '';
    const weeks = buildCourseWeekPlan(course.id, data);
    const weekPlanner = ['lecturer', 'administrator'].includes(state.user.role)
      ? `<section class="card staff-tools"><h2>Course planner</h2><form id="week-form" class="week-form"><div class="week-form-row"><label>Week label<input name="label" placeholder="Week 1" maxlength="40" required></label><label>Week title<input name="title" placeholder="Course launch" maxlength="120" required></label><label>Range<input name="range" placeholder="Introductory week" maxlength="120"></label><button class="btn btn-primary" type="submit">Add teaching week</button></div></form></section>`
      : '';
    const staffTools = ['lecturer', 'administrator'].includes(state.user.role)
      ? `<section class="card staff-tools"><h2>Course tools</h2><div class="staff-tool-grid"><form class="staff-form" data-action="assignment"><h3>Create assignment</h3><label>Title<input name="title" required maxlength="200"></label><label>Instructions<textarea name="instructions" rows="3" maxlength="10000"></textarea></label><div class="staff-inline-grid"><label>Due date<input name="dueAt" type="datetime-local" required></label><label>Max score<input name="maxScore" type="number" min="1" max="1000" value="100" required></label></div><button class="btn btn-primary" type="submit">Publish assignment</button></form><form class="staff-form" data-action="material"><h3>Add material</h3><label>Title<input name="title" required maxlength="200"></label><label>Description<textarea name="description" rows="3" maxlength="5000"></textarea></label><div class="staff-inline-grid"><label>Type<select name="materialType"><option value="document">Document</option><option value="video">Video</option><option value="image">Image</option><option value="audio">Audio</option><option value="link">Link</option></select></label><label>External URL<input name="externalUrl" type="url" maxlength="2000" placeholder="https://..."></label></div><label class="toggle-row"><input name="published" type="checkbox"> Publish now</label><button class="btn btn-primary" type="submit">Upload material</button></form><form class="staff-form" data-action="announcement"><h3>Post announcement</h3><label>Title<input name="title" required maxlength="200"></label><label>Body<textarea name="body" rows="4" required maxlength="20000"></textarea></label><button class="btn btn-primary" type="submit">Publish announcement</button></form><form class="staff-form" data-action="forum"><h3>Start discussion forum</h3><label>Title<input name="title" required maxlength="200"></label><label>Discussion prompt<textarea name="body" rows="4" required maxlength="20000"></textarea></label><button class="btn btn-primary" type="submit">Create forum</button></form><form class="staff-form" data-action="quiz"><h3>Create quiz</h3><label>Title<input name="title" required maxlength="200"></label><label>Instructions<textarea name="instructions" rows="3" maxlength="10000"></textarea></label><label>Question<input name="question" required maxlength="1000"></label><label>Options<input name="options" required placeholder="Option A, Option B, Option C"></label><label>Correct answer<input name="answer" required maxlength="300"></label><button class="btn btn-primary" type="submit">Publish quiz</button></form></div></section>`
      : '';
    $('#course-content').innerHTML = `<section class="card"><p class="eyebrow">Course overview</p><h2>${escapeHtml(course.title)}</h2><p class="muted">${escapeHtml(course.description || 'Your lecturer has not added a course description yet.')}</p><div class="progress-summary"><div class="progress-label"><span>Course progress</span><strong>${progress}%</strong></div><div class="progress-track" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width: ${progress}%"></span></div></div>${progressControl}</section>${gradeSummary}${renderAnalytics(data.analytics)}${weekPlanner}${renderWeekPlan(weeks, course.id)}${staffTools}`;
    $('#progress-form')?.addEventListener('submit', updateProgress);
    document.querySelectorAll('.staff-form').forEach((form) => form.addEventListener('submit', handleStaffCourseForm));
    $('#week-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        const result = await api('/api/lecturer/weeks', { method: 'POST', body: JSON.stringify({ courseId: course.id, label: String(form.get('label') || '').trim(), title: String(form.get('title') || '').trim(), range: String(form.get('range') || '').trim() }) });
        state.courseData[course.id].weeks.push(result.data);
        event.currentTarget.reset();
        renderCourseTab('overview');
      } catch (error) {
        showAppError(error.message);
      }
    });
    return;
  }
  const labels = { materials: 'Course materials', assignments: 'Assignments', forums: 'Discussion forums', quizzes: 'Quizzes', grades: 'Grades', announcements: 'Announcements' };
  const content = tab === 'forums' ? renderForums(data) : tab === 'quizzes' ? renderQuizzes(data) : tab === 'grades' ? renderGrades(data) : renderContentList(data[tab], tab);
  $('#course-content').innerHTML = `<div><p class="eyebrow">${labels[tab]}</p>${content}</div>`;
  document.querySelectorAll('.submission-form').forEach((form) => form.addEventListener('submit', submitAssignment));
  document.querySelectorAll('.grading-form').forEach((form) => form.addEventListener('submit', gradeAssignment));
  document.querySelectorAll('.forum-reply-form').forEach((form) => form.addEventListener('submit', submitForumReply));
  document.querySelectorAll('.quiz-form').forEach((form) => form.addEventListener('submit', submitQuiz));
}

async function handleStaffCourseForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const action = form.dataset.action;
  const commonPayload = { courseId: state.selectedCourse.id };

  try {
    if (action === 'assignment') {
      const formData = new FormData(form);
      await api('/api/lecturer/assignments', {
        method: 'POST',
        body: JSON.stringify({
          ...commonPayload,
          title: String(formData.get('title') || '').trim(),
          instructions: String(formData.get('instructions') || '').trim(),
          dueAt: new Date(String(formData.get('dueAt'))).toISOString(),
          maxScore: Number(formData.get('maxScore') || 100),
        }),
      });
    } else if (action === 'material') {
      const formData = new FormData(form);
      const externalUrl = String(formData.get('externalUrl') || '').trim();
      await api('/api/lecturer/materials', {
        method: 'POST',
        body: JSON.stringify({
          ...commonPayload,
          title: String(formData.get('title') || '').trim(),
          description: String(formData.get('description') || '').trim(),
          materialType: String(formData.get('materialType') || 'document'),
          externalUrl: externalUrl || undefined,
          storagePath: externalUrl ? undefined : `material-${Date.now()}`,
          published: formData.get('published') === 'on',
        }),
      });
    } else if (action === 'announcement') {
      const formData = new FormData(form);
      await api('/api/lecturer/announcements', {
        method: 'POST',
        body: JSON.stringify({
          ...commonPayload,
          title: String(formData.get('title') || '').trim(),
          body: String(formData.get('body') || '').trim(),
        }),
      });
    } else if (action === 'forum') {
      const formData = new FormData(form);
      await api('/api/lecturer/forums', { method: 'POST', body: JSON.stringify({ ...commonPayload, title: String(formData.get('title') || '').trim(), body: String(formData.get('body') || '').trim() }) });
    } else if (action === 'quiz') {
      const formData = new FormData(form);
      const options = String(formData.get('options') || '').split(',').map((option) => option.trim()).filter(Boolean);
      await api('/api/lecturer/quizzes', { method: 'POST', body: JSON.stringify({ ...commonPayload, title: String(formData.get('title') || '').trim(), instructions: String(formData.get('instructions') || '').trim(), questions: [{ question: String(formData.get('question') || '').trim(), options, answer: String(formData.get('answer') || '').trim(), score: 1 }] }) });
    }

    form.reset();
    await openCourse(state.selectedCourse.id);
  } catch (error) {
    showAppError(error.message);
  }
}

async function submitForumReply(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = new FormData(form).get('body');
  try {
    const result = await api(`/api/forums/${form.dataset.forumId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    state.courseData[state.selectedCourse.id].forums.posts.push(result.data);
    renderCourseTab('forums');
  } catch (error) {
    showAppError(error.message);
  }
}

async function submitQuiz(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const responses = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await api(`/api/student/quizzes/${form.dataset.quizId}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ responses }),
    });
    state.courseData[state.selectedCourse.id].quizAttempts[form.dataset.quizId] = result.data;
    renderCourseTab('quizzes');
  } catch (error) {
    showAppError(error.message);
  }
}

async function openCourse(courseId) {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return;
  state.selectedCourse = course;
  $('#dashboard-panel').hidden = true;
  $('#course-panel').hidden = false;
  $('#breadcrumb-current').textContent = course.title;
  $('#course-code').textContent = course.code;
  $('#course-title').textContent = course.title;
  $('#course-description').textContent = course.description || '';
  if (!state.courseData[course.id]) {
    $('#course-content').innerHTML = '<div class="empty-state">Loading course content...</div>';
    try {
      const [materials, assignments, announcements, progress, weeks, forums, quizzes, analytics, gradebook] = await Promise.all([
        api(`/api/courses/${course.id}/materials`),
        api(`/api/courses/${course.id}/assignments`),
        api(`/api/courses/${course.id}/announcements`),
        api(`/api/courses/${course.id}/progress`),
        api(`/api/courses/${course.id}/weeks`),
        api(`/api/courses/${course.id}/forums`),
        api(`/api/courses/${course.id}/quizzes`),
        ['lecturer', 'administrator'].includes(state.user.role) ? api(`/api/courses/${course.id}/analytics`) : Promise.resolve({ data: null }),
        api(`/api/courses/${course.id}/gradebook`),
      ]);
      const submissions = {};
      if (state.user.role === 'student') {
        const results = await Promise.all(assignments.data.map((item) => api(`/api/student/assignments/${item.id}/submission`)));
        assignments.data.forEach((item, index) => { submissions[item.id] = results[index].data; });
      } else if (['lecturer', 'administrator'].includes(state.user.role)) {
        const results = await Promise.all(assignments.data.map((item) => api(`/api/lecturer/assignments/${item.id}/submissions`)));
        assignments.data.forEach((item, index) => { submissions[item.id] = results[index].data; });
      }
      const quizAttempts = {};
      if (state.user.role === 'student') {
        await Promise.all((quizzes.data?.quizzes || []).map(async (quiz) => {
          const attempt = await api(`/api/student/quizzes/${quiz.id}/attempt`);
          if (attempt.data) quizAttempts[quiz.id] = attempt.data;
        }));
      }
      state.courseData[course.id] = { materials: materials.data, assignments: assignments.data, announcements: announcements.data, progress: progress.data, submissions, weeks: weeks.data || [], forums: forums.data, quizzes: quizzes.data, analytics: analytics.data, gradebook: gradebook.data, quizAttempts };
    } catch (error) {
      showAppError(error.message);
      return;
    }
  }
  renderCourses();
  renderCourseTab('overview');
  $('#page').focus();
}

async function submitAssignment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  try {
    const file = values.get('file');
    const fileData = file?.size ? await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    }) : undefined;
    const result = await api(`/api/student/assignments/${form.dataset.assignmentId}/submit`, { method: 'POST', body: JSON.stringify({ fileName: file?.name, fileData, content: values.get('content') }) });
    state.courseData[state.selectedCourse.id].submissions[form.dataset.assignmentId] = result.data;
    renderCourseTab('assignments');
  } catch (error) {
    showAppError(error.message);
  }
}

async function openCourseManagement() {
  state.selectedCourse = null;
  $('#dashboard-panel').hidden = true;
  $('#course-panel').hidden = true;
  $('#messages-panel').hidden = true;
  $('#accessibility-panel').hidden = true;
  $('#user-management-panel').hidden = true;
  $('#course-management-panel').hidden = false;
  $('#breadcrumb-current').textContent = 'Course management';
  try {
    const [users, courses] = await Promise.all([api('/api/admin/users'), api('/api/courses')]);
    const lecturers = users.data.filter((user) => user.role === 'lecturer');
    const students = users.data.filter((user) => user.role === 'student');
    $('#enrolment-course-input').innerHTML = '<option value="">Choose course</option>' + courses.data.map((course) => `<option value="${course.id}">${escapeHtml(course.code)} - ${escapeHtml(course.title)}</option>`).join('');
    $('#enrolment-student-input').innerHTML = '<option value="">Choose student</option>' + students.map((student) => `<option value="${student.id}">${escapeHtml(student.display_name)} (${escapeHtml(student.matric_number || student.email || '')})</option>`).join('');
    $('#course-lecturer-input').innerHTML = '<option value="">Choose lecturer</option>' + lecturers.map((lecturer) => `<option value="${lecturer.id}">${escapeHtml(lecturer.display_name)} (${escapeHtml(lecturer.email || '')})</option>`).join('');
    $('#admin-course-list').innerHTML = courses.data.length ? `<table class="user-table"><thead><tr><th>Code</th><th>Title</th><th>Department</th><th>Lecturer</th><th>Status</th></tr></thead><tbody>${courses.data.map((course) => `<tr><td>${escapeHtml(course.code)}</td><td>${escapeHtml(course.title)}</td><td>${escapeHtml(course.department)}</td><td>${escapeHtml(lecturers.find((lecturer) => lecturer.id === course.lecturer_id)?.display_name || course.lecturer_id)}</td><td><span class="role-chip">${course.published ? 'Published' : 'Draft'}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No courses found.</p>';
  } catch (error) {
    showAppError(error.message);
  }
}

async function loadEnrolments() {
  const courseId = $('#enrolment-course-input').value;
  if (!courseId) {
    $('#enrolment-list').innerHTML = '<p class="muted">Choose a course to view enrolments.</p>';
    return;
  }
  try {
    const result = await api(`/api/admin/courses/${courseId}/enrolments`);
    $('#enrolment-list').innerHTML = result.data.length ? `<table class="user-table"><thead><tr><th>Student</th><th>Matric number</th><th>Start</th><th>End</th></tr></thead><tbody>${result.data.map((item) => `<tr><td>${escapeHtml(item.student?.display_name || item.student_id)}</td><td>${escapeHtml(item.student?.matric_number || 'Not provided')}</td><td>${new Date(item.start_at).toLocaleDateString()}</td><td>${item.end_at ? new Date(item.end_at).toLocaleDateString() : 'No end date'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No students enrolled in this course.</p>';
  } catch (error) {
    showAppError(error.message);
  }
}

async function gradeAssignment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  try {
    await api(`/api/lecturer/assignments/${form.dataset.assignmentId}/grade`, { method: 'POST', body: JSON.stringify({ studentId: form.dataset.studentId, score: Number(values.get('score')), feedback: values.get('feedback') }) });
    const refreshed = await api(`/api/lecturer/assignments/${form.dataset.assignmentId}/submissions`);
    state.courseData[state.selectedCourse.id].submissions[form.dataset.assignmentId] = refreshed.data;
    renderCourseTab('assignments');
  } catch (error) {
    showAppError(error.message);
  }
}

async function updateProgress(event) {
  event.preventDefault();
  const value = Number($('#progress-input').value);
  try {
    const result = await api(`/api/student/courses/${state.selectedCourse.id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ completionPercent: value }),
    });
    state.courseData[state.selectedCourse.id].progress = result.data;
    renderCourseTab('overview');
  } catch (error) {
    showAppError(error.message);
  }
}

function showDashboard() {
  state.selectedCourse = null;
  $('#course-panel').hidden = true;
  $('#messages-panel').hidden = true;
  $('#accessibility-panel').hidden = true;
    $('#user-management-panel').hidden = true;
    $('#course-management-panel').hidden = true;
    $('#user-management-link').hidden = state.user.role !== 'administrator';
  $('#dashboard-panel').hidden = false;
  $('#breadcrumb-current').textContent = 'Dashboard';
  renderDashboard();
}

async function loadApp() {
  if (!state.token) {
    const rememberedEmail = loadDraft('login-email');
    if (rememberedEmail) {
      $('#email').value = rememberedEmail;
    }
    return;
  }
  state.user = state.user || decodeUser(state.token);
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  try {
    const profile = await api('/api/profile');
    state.user = {
      id: profile.data.id,
      email: profile.data.email,
      role: profile.data.role,
      displayName: profile.data.display_name,
    };
    const result = await api('/api/courses');
    state.courses = result.data || [];
    renderDashboard();
  } catch (error) {
    clearPersistedToken();
    state.token = null;
    $('#login-view').hidden = false;
    $('#app-view').hidden = true;
    $('#login-error').textContent = error.message;
    $('#login-error').hidden = false;
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorElement = $('#login-error');
  errorElement.hidden = true;
  const form = new FormData(event.currentTarget);
  try {
    const result = await api('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
    state.token = result.session.access_token;
    state.user = {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role || 'student',
    };
    setPersistedToken(state.token);
    saveDraft('login-email', form.get('email'));
    await loadApp();
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  }
});

$('#logout-button').addEventListener('click', () => {
  clearPersistedToken();
  window.location.reload();
});
$('#drawer-toggle').addEventListener('click', () => {
  const drawer = $('#course-drawer');
  const collapsed = drawer.classList.toggle('is-collapsed');
  $('#drawer-toggle').setAttribute('aria-expanded', String(!collapsed));
});
$('#drawer-close').addEventListener('click', () => $('#course-drawer').classList.add('is-collapsed'));
$('#back-dashboard').addEventListener('click', showDashboard);
$('#messages-link').addEventListener('click', (event) => { event.preventDefault(); openMessages(); });
$('#messages-refresh').addEventListener('click', openMessages);
$('#accessibility-link').addEventListener('click', (event) => { event.preventDefault(); openAccessibility(); });
$('#user-management-link').addEventListener('click', (event) => { event.preventDefault(); openUserManagement(); });
$('#users-refresh').addEventListener('click', openUserManagement);
$('#course-management-link').addEventListener('click', (event) => { event.preventDefault(); openCourseManagement(); });
$('#courses-refresh').addEventListener('click', openCourseManagement);
$('#enrolment-course-input').addEventListener('change', loadEnrolments);
$('#message-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = $('#message-body').value.trim();
  try {
    await api('/api/messages', { method: 'POST', body: JSON.stringify({ recipientId: $('#message-recipient').value, body }) });
    $('#message-body').value = '';
    saveDraft('chat-message', '');
    await openMessages();
  } catch (error) {
    showAppError(error.message);
  }
});

$('#message-body').addEventListener('input', (event) => {
  saveDraft('chat-message', event.target.value);
});

const savedDraft = loadDraft('chat-message');
if (savedDraft) {
  $('#message-body').value = savedDraft;
}
$('#accessibility-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const preferences = {
    textSize: $('#text-size').value,
    highContrast: $('#high-contrast').checked,
    captionsPreferred: $('#captions-preferred').checked,
  };
  try {
    await api('/api/profile/preferences', { method: 'PATCH', body: JSON.stringify({ accessibilityPreferences: preferences }) });
    applyAccessibilityPreferences(preferences);
    $('#accessibility-status').textContent = 'Accessibility settings saved.';
  } catch (error) {
    showAppError(error.message);
  }
});
$('#user-create-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  try {
    await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '').trim(),
        displayName: String(formData.get('displayName') || '').trim(),
        matricNumber: String(formData.get('matricNumber') || '').trim() || undefined,
        role: String(formData.get('role') || 'student'),
      }),
    });
    $('#user-create-status').textContent = 'Institutional user created.';
    form.reset();
    await openUserManagement();
  } catch (error) {
    $('#user-create-status').textContent = error.message;
    showAppError(error.message);
  }
});
$('#course-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        code: $('#course-code-input').value,
        title: $('#course-title-input').value,
        department: $('#course-department-input').value,
        lecturerId: $('#course-lecturer-input').value,
        description: $('#course-description-input').value,
        published: $('#course-published-input').checked,
      }),
    });
    $('#course-status').textContent = 'Course created.';
    event.currentTarget.reset();
    await openCourseManagement();
  } catch (error) {
    showAppError(error.message);
  }
});
$('#enrolment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const courseId = $('#enrolment-course-input').value;
  try {
    await api(`/api/admin/courses/${courseId}/enrolments`, {
      method: 'POST',
      body: JSON.stringify({
        studentId: $('#enrolment-student-input').value,
        startAt: `${$('#enrolment-start-input').value}T00:00:00+00:00`,
        endAt: `${$('#enrolment-end-input').value}T23:59:59+00:00`,
      }),
    });
    $('#enrolment-status').textContent = 'Student assigned to course.';
    await loadEnrolments();
  } catch (error) {
    showAppError(error.message);
  }
});
document.querySelectorAll('.secondary-tab').forEach((tab) => tab.addEventListener('click', () => renderCourseTab(tab.dataset.tab)));
document.querySelectorAll('a[href="#dashboard"]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showDashboard(); }));

loadApp();
