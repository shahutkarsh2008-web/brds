import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/app.js';

test('admin data export contains persisted learning records and excludes credential data', async t => {
  const database = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(database);
  const admin = await createUser(database, { loginId: 'backup_admin', name: 'Backup Admin', role: 'admin', password: 'SecurePass123!Long', phone: '919981084008' });
  const student = await createUser(database, { loginId: 'backup_student', name: 'Backup Student', role: 'student', password: 'SecurePass456!Long', phone: '919981084009' });
  await database.query('INSERT INTO exams(id,title,definition,created_at) VALUES($1,$2,$3,$4)', ['exam-backup', 'Backup Exam', '{}', 1]);
  await database.query('INSERT INTO exam_assignments(exam_id,user_id) VALUES($1,$2)', ['exam-backup', student.id]);
  await database.query('INSERT INTO practice_sets(id,user_id,title,filters_json,question_ids_json,total_questions,completed_questions,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', ['set-backup', student.id, 'Saved practice', '{}', '[]', 1, 1, 'completed', 2]);
  await database.query('INSERT INTO practice_bookmarks(user_id,question_id,exam_id,created_at) VALUES($1,$2,$3,$4)', [student.id, 'q1', 'exam-backup', 3]);
  await database.query('INSERT INTO student_preferences(user_id,preferences_json,updated_at) VALUES($1,$2,$3)', [student.id, '{"theme":"dark"}', 4]);
  await database.query('INSERT INTO gk_card_progress(user_id,card_id,box,seen_count,last_reviewed_at) VALUES($1,$2,$3,$4,$5)', [student.id, 'gk-1', 2, 5, 6]);
  await database.query('INSERT INTO student_sketches(id,user_id,title,prompt,image_data_url,created_at) VALUES($1,$2,$3,$4,$5,$6)', ['sketch-1', student.id, 'Study', 'Draw a chair', 'data:image/png;base64,AA==', 7]);
  await database.query('INSERT INTO guide_quiz_attempts(id,user_id,guide_id,correct,total,submitted_at) VALUES($1,$2,$3,$4,$5,$6)', ['quiz-1', student.id, 'guide-1', 4, 5, 8]);
  await database.query('INSERT INTO student_revision_reviews(user_id,exam_id,question_id,reviewed_at) VALUES($1,$2,$3,$4)', [student.id, 'exam-backup', 'q1', 9]);

  const app = createApp(database, { otp: { send: async () => 'fixture', verify: async () => true } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;

  const anonymous = await fetch(base + '/api/admin/backup');
  assert.equal(anonymous.status, 401);

  const login = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ loginId: 'backup_admin', password: 'SecurePass123!Long' }),
  });
  const challengeCookie = login.headers.get('set-cookie');
  const verify = await fetch(base + '/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: challengeCookie },
    body: JSON.stringify({ code: '123456' }),
  });
  const backupResponse = await fetch(base + '/api/admin/backup', { headers: { cookie: verify.headers.get('set-cookie') } });
  assert.equal(backupResponse.status, 200);
  assert.match(backupResponse.headers.get('content-disposition'), /brds-cbt-backup-\d{4}-\d{2}-\d{2}\.json/);

  const backup = await backupResponse.json();
  assert.equal(backup.formatVersion, 2);
  assert.equal(backup.summary.users, 2);
  assert.equal(backup.summary.applicationRecords, Object.values(backup.applicationData).reduce((sum, rows) => sum + rows.length, 0));
  assert.equal(backup.applicationData.exam_assignments.length, 1);
  assert.equal(backup.applicationData.practice_sets[0].id, 'set-backup');
  assert.equal(backup.applicationData.practice_bookmarks[0].question_id, 'q1');
  assert.equal(backup.applicationData.student_preferences.length, 1);
  assert.equal(backup.applicationData.gk_card_progress.length, 1);
  assert.equal(backup.applicationData.student_sketches.length, 1);
  assert.equal(backup.applicationData.guide_quiz_attempts.length, 1);
  assert.equal(backup.applicationData.student_revision_reviews.length, 1);
  assert.equal(Object.hasOwn(backup.users[0], 'password_hash'), false);
  assert.equal(Object.hasOwn(backup.users[0], 'phone'), false);
  assert.ok(backup.limitations.some(item => /provider.*snapshot/i.test(item)));
});
