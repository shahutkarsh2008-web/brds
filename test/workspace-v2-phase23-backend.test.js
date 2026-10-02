import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { createUser, digest } from '../src/auth.js';
import { importExam } from '../src/exams.js';

async function setup(t) {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);
  const students = {};
  for (const loginId of ['practice_a', 'practice_b']) {
    const user = await createUser(db, { loginId, name: loginId, role: 'student', password: 'Password12345!', phone: '919876543210' });
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await db.query('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)', [digest(token), user.id, Date.now(), Date.now() + 86400000]);
    students[loginId] = { user, cookie: `brds_session=${token}` };
  }
  const exam = {
    id: 'phase23-topic-bank', title: 'Phase 2/3 Topic Bank', durationSeconds: 3600, totalQuestions: 4, maxMarks: 10,
    sections: [{ id: 'visual', title: 'Visual Reasoning' }],
    questions: [
      { id: 'spatial-1', sectionId: 'visual', type: 'MCQ', prompt: 'Spatial rotation sample', topic: 'Spatial Reasoning', difficulty: 'Easy', tags: ['rotation'], options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answer: 'a', marks: { correct: 3, incorrect: -1, unanswered: 0 } },
      { id: 'spatial-2', sectionId: 'visual', type: 'MCQ', prompt: 'Spatial reflection sample', topic: 'Spatial Reasoning', difficulty: 'Easy', tags: ['reflection'], options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answer: 'a', marks: { correct: 3, incorrect: -1, unanswered: 0 } },
      { id: 'science-1', sectionId: 'visual', type: 'NAT', prompt: 'Material science sample', topic: 'Scientific Knowledge', difficulty: 'Hard', answer: { min: 4, max: 4 }, marks: { correct: 2, incorrect: 0, unanswered: 0 } },
      { id: 'design-1', sectionId: 'visual', type: 'MCQ', prompt: 'Design sensitivity sample', topic: 'Design Sensitivity', difficulty: 'Medium', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answer: 'b', marks: { correct: 2, incorrect: -1, unanswered: 0 } }
    ]
  };
  await importExam(db, exam, [students.practice_a.user.id, students.practice_b.user.id]);
  let now = Date.now();
  const app = createApp(db, { now: () => now, otp: { send: async () => 'fixture', verify: async () => true } });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function api(path, body, who = 'practice_a') {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: base, Cookie: students[who].cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  return { db, app, api, students, exam, advance: ms => { now += ms; } };
}

test('Phase 2: topic filters return actual unique questions; empty matches stay empty; saved answers resume after reload', async t => {
  const f = await setup(t);
  assert.deepEqual((await f.api('/api/student/practice/count')).body, { count: 4 });
  const created = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Spatial Reasoning'], type: 'MCQ', difficulty: 'Easy', skipDone: false, setSize: 10 });
  assert.equal(created.status, 200);
  assert.deepEqual(created.body.set.questionIds, ['spatial-1', 'spatial-2']);
  assert.equal(created.body.set.totalQuestions, 2);
  const opened = await f.api(`/api/student/practice/sets/${created.body.set.id}`);
  assert.equal(opened.body.set.questions.length, 2);
  assert.equal(opened.body.set.questions[0].prompt, 'Spatial rotation sample');
  assert.ok(!JSON.stringify(opened.body.set.questions).includes('"answer"'));
  const done = await f.api('/api/student/practice/answer', { setId: created.body.set.id, questionId: 'spatial-1', value: 'a' });
  assert.equal(done.body.progress.completedQuestions, 1);
  assert.equal((await f.api(`/api/student/practice/sets/${created.body.set.id}`)).body.set.answers['spatial-1'].value, 'a');
  assert.equal((await f.api(`/api/student/practice/sets/${created.body.set.id}`, undefined, 'practice_b')).status, 404);
  assert.equal((await f.api('/api/student/practice/answer', { setId: created.body.set.id, questionId: 'science-1', value: 4 })).status, 400);
  await f.api('/api/student/practice/answer', { setId: created.body.set.id, questionId: 'spatial-2', value: 'b' });
  const revision = await f.api('/api/student/practice/revision');
  assert.equal(revision.body.questions.length, 1);
  assert.equal(revision.body.questions[0].id, 'spatial-2');
  assert.ok(!JSON.stringify(revision.body.questions).includes('"answer"'));

  const noMatch = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Astronomy'], type: 'ALL', setSize: 5, skipDone: false });
  assert.equal(noMatch.body.set.totalQuestions, 0);
  assert.deepEqual(noMatch.body.set.questionIds, []);
  assert.equal((await f.api('/api/student/practice/count', { topics: ['Astronomy'] })).body.count, 0);
});

test('Phase 2: skip-done excludes questions used in prior sets; bookmarks are private and persistent', async t => {
  const f = await setup(t);
  const first = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Scientific Knowledge'], skipDone: false, setSize: 1 });
  const abandoned = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Spatial Reasoning'], skipDone: false, setSize: 1 });
  const beforeAnswered = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Spatial Reasoning'], skipDone: true, setSize: 2 });
  assert.equal(beforeAnswered.body.set.totalQuestions, 2, 'an unanswered saved set must remain available to resume');
  await f.api('/api/student/practice/answer', { setId: abandoned.body.set.id, questionId: 'spatial-1', value: 'a' });
  const afterAnswered = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Spatial Reasoning'], skipDone: true, setSize: 2 });
  assert.deepEqual(afterAnswered.body.set.questionIds, ['spatial-2']);
  const second = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Scientific Knowledge'], skipDone: true, setSize: 1 });
  assert.deepEqual(second.body.set.questionIds, ['science-1']);
  await f.api('/api/student/practice/answer', { setId: second.body.set.id, questionId: 'science-1', value: 4 });
  const afterScience = await f.api('/api/student/practice/create', { exam: 'phase23', topics: ['Scientific Knowledge'], skipDone: true, setSize: 1 });
  assert.equal(afterScience.body.set.totalQuestions, 0);
  assert.equal((await f.api('/api/student/bookmarks', { examId: f.exam.id, questionId: 'spatial-1', bookmarked: true })).status, 200);
  assert.equal((await f.api('/api/student/bookmarks')).body.bookmarks.length, 1);
  assert.equal((await f.api('/api/student/bookmarks', undefined, 'practice_b')).body.bookmarks.length, 0);
  await f.api('/api/student/bookmarks', { examId: f.exam.id, questionId: 'spatial-1', bookmarked: false });
  assert.equal((await f.api('/api/student/bookmarks')).body.bookmarks.length, 0);
});

test('Phase 3: overview has honest empty state and completed attempt KPIs, trends, and partial attempt status', async t => {
  const f = await setup(t);
  const empty = await f.api('/api/student/analytics');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.kpis.accuracyPct, null);
  assert.equal(empty.body.sample.reliableTrends, false);
  assert.deepEqual(empty.body.topics, []);

  const active = await f.api(`/api/exams/${f.exam.id}/start`, {});
  assert.equal(active.status, 200);
  await f.api(`/api/attempts/${active.body.id}/answers`, { questionId: 'spatial-1', value: 'a', review: false, expectedVersion: 0, mutationId: randomUUID() });
  const during = await f.api('/api/student/dashboard');
  assert.equal(during.body.kpis.activeAttempts, 1);
  assert.equal(during.body.kpis.completedAttempts, 0);
  assert.equal(during.body.attempts[0].status, 'active');

  await f.api(`/api/attempts/${active.body.id}/answers`, { questionId: 'spatial-2', value: 'b', review: false, expectedVersion: 1, mutationId: randomUUID() });
  const submitted = await f.api(`/api/attempts/${active.body.id}/submit`, { expectedVersion: 2 });
  assert.equal(submitted.status, 200);
  const result = await f.api('/api/student/analytics');
  assert.equal(result.body.kpis.completedAttempts, 1);
  assert.equal(result.body.kpis.questionsAnswered, 2);
  assert.equal(result.body.kpis.accuracyPct, 50);
  assert.equal(result.body.kpis.skipped, 2);
  assert.equal(result.body.kpis.negativeMarks, 1);
  assert.equal(result.body.sample.reliableTrends, false);
  assert.ok(result.body.topics.some(topic => topic.topic === 'Spatial Reasoning' && topic.accuracy === 50 && topic.reliable === false));
  assert.equal(result.body.calendar.length, 1);
});
