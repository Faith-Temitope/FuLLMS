import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCourseAnalytics } from '../src/course-analytics.js';

test('buildCourseAnalytics summarises course engagement and grading', () => {
  const analytics = buildCourseAnalytics({
    totalStudents: 4,
    assignments: [
      { id: 'a1', max_score: 100 },
      { id: 'a2', max_score: 50 },
    ],
    submissions: [
      { assignment_id: 'a1', score: 90 },
      { assignment_id: 'a1', score: 80 },
      { assignment_id: 'a2', score: 50 },
      { assignment_id: 'a2', score: null },
    ],
    progress: [
      { completion_percent: 100 },
      { completion_percent: 70 },
      { completion_percent: 50 },
      { completion_percent: 0 },
    ],
  });

  assert.equal(analytics.students, 4);
  assert.equal(analytics.averageProgress, 55);
  assert.equal(analytics.submissionRate, 75);
  assert.equal(analytics.averageGrade, 73);
});
