export function buildCourseAnalytics({ totalStudents = 0, assignments = [], submissions = [], progress = [] }) {
  const gradedSubmissions = submissions.filter((submission) => submission.score !== null && submission.score !== undefined);
  const assignmentCount = assignments.length || 1;
  const averageProgress = progress.length
    ? Math.round(progress.reduce((total, item) => total + Number(item.completion_percent || 0), 0) / progress.length)
    : 0;
  const averageGrade = gradedSubmissions.length
    ? Math.round(gradedSubmissions.reduce((total, submission) => total + Number(submission.score || 0), 0) / gradedSubmissions.length)
    : 0;
  const validSubmissionCount = gradedSubmissions.length;
  const submissionRate = totalStudents > 0
    ? Math.min(100, Math.round((validSubmissionCount / totalStudents) * 100))
    : 0;

  return {
    students: totalStudents,
    averageProgress,
    submissionRate,
    averageGrade,
    assignmentCount,
    gradedSubmissions: gradedSubmissions.length,
    pendingSubmissions: submissions.filter((submission) => submission.score === null || submission.score === undefined).length,
  };
}
