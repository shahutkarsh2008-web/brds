const APPLICATION_TABLES = [
  'exam_assignments',
  'answer_mutations',
  'attempt_controls',
  'teacher_actions',
  'practice_sets',
  'practice_answers',
  'practice_outcomes',
  'practice_bookmarks',
  'student_preferences',
  'gk_card_progress',
  'student_sketches',
  'guide_quiz_attempts',
  'student_revision_reviews',
  'login_history',
];

const safeJson = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

export function createBackupApi({ auth, database, now = Date.now }) {
  return async function handleBackup(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return safeJson(res, 405, { error: 'Method not allowed.' });
    }
    try {
      await auth.requireRole(req, ['admin']);
      const backup = await database.transaction(async query => {
        const users = (await query('SELECT id, login_id, name, role, created_at FROM users ORDER BY id')).rows;
        const exams = (await query('SELECT * FROM exams ORDER BY id')).rows;
        const attempts = (await query('SELECT * FROM attempts ORDER BY id')).rows;
        const flags = (await query('SELECT * FROM activity_flags ORDER BY id')).rows;
        const applicationData = {};
        for (const table of APPLICATION_TABLES) {
          applicationData[table] = (await query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
        }
        return {
          formatVersion: 2,
          exportedAt: new Date(now()).toISOString(),
          summary: {
            users: users.length,
            exams: exams.length,
            attempts: attempts.length,
            flags: flags.length,
            applicationRecords: Object.values(applicationData).reduce((sum, rows) => sum + rows.length, 0),
          },
          // Keep the original top-level fields for existing admin tooling.
          users,
          exams,
          attempts,
          flags,
          applicationData,
          limitations: [
            'Password hashes, phone numbers, active sessions and OTP challenges are excluded from this export.',
            'Use the database provider’s encrypted snapshot and tested restore process for full disaster recovery.',
          ],
        };
      });
      res.setHeader('Content-Disposition', `attachment; filename="brds-cbt-backup-${backup.exportedAt.slice(0, 10)}.json"`);
      return safeJson(res, 200, backup);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status >= 500) console.error('[BACKUP EXPORT ERROR]', { message: error.message });
      return safeJson(res, status, { error: status === 500 ? 'Backup export failed.' : error.message });
    }
  };
}
