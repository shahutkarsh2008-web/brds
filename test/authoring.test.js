import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/app.js';

test('Phase 6: Complete Exam Authoring, Assignment, and Student Scoring Engine', async () => {
  const database = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(database);

  const otp = {
    async send() { return 'session-123'; },
    async verify(id, code) { return code === '123456'; }
  };

  await createUser(database, { loginId: 'admin', name: 'Admin User', role: 'admin', phone: '919999999999', password: 'AdminPass123!' });
  await createUser(database, { loginId: 'student1', name: 'Student One', role: 'student', phone: '918888888888', password: 'StudentPass123!' });

  const app = createApp(database, { otp, env: {} });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;

  async function login(loginId, password) {
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ loginId, password })
    });
    assert.equal(res.status, 200, 'Login step 1 failed');
    const challengeCookie = res.headers.get('set-cookie').split(';')[0];

    const verify = await fetch(`${base}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: challengeCookie },
      body: JSON.stringify({ code: '123456' })
    });
    assert.equal(verify.status, 200, 'Login verify failed');
    return verify.headers.get('set-cookie').split(';')[0];
  }

  try {
    const adminCookie = await login('admin', 'AdminPass123!');

    // 1. Rejection of unauthenticated fetch to authoring
    const unauth = await fetch(`${base}/api/author/exams`);
    assert.equal(unauth.status, 401, 'Unauthenticated authoring fetch should fail');

    // 2. Author a complete new exam paper
    const examPayload = {
      id: 'author-test-exam-1',
      title: 'Authored Design & Logic Paper 2026',
      durationSeconds: 1800,
      totalQuestions: 3,
      maxMarks: 12,
      instructions: 'Read all questions carefully.',
      sections: [
        { id: 's1', title: 'Section A: Design Theory', durationSeconds: 1800 }
      ],
      questions: [
        {
          id: 'q1',
          sectionId: 's1',
          type: 'MCQ',
          prompt: 'What is the primary brand color of BRDS?',
          image: '/media/brds-logo-enhanced.png',
          imageAlt: 'BRDS Logo',
          options: [
            { id: 'a', text: 'Red' },
            { id: 'b', text: 'Blue' },
            { id: 'c', text: 'Green' }
          ],
          marks: { correct: 4, incorrect: -1, unanswered: 0 },
          answer: 'a'
        },
        {
          id: 'q2',
          sectionId: 's1',
          type: 'MSQ',
          prompt: 'Select primary RGB colors:',
          options: [
            { id: 'red', text: 'Red' },
            { id: 'green', text: 'Green' },
            { id: 'yellow', text: 'Yellow' }
          ],
          marks: { correct: 4, incorrect: -1, unanswered: 0 },
          answer: ['green', 'red']
        },
        {
          id: 'q3',
          sectionId: 's1',
          type: 'NAT',
          prompt: 'Calculate 10.5 + 4.5',
          marks: { correct: 4, incorrect: 0, unanswered: 0 },
          answer: { min: 14.9, max: 15.1 }
        }
      ]
    };

    const saveRes = await fetch(`${base}/api/author/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: adminCookie },
      body: JSON.stringify(examPayload)
    });
    const saveText = await saveRes.text();
    assert.equal(saveRes.status, 200, `Save exam failed: ${saveText}`);
    const saveJson = JSON.parse(saveText);
    assert.equal(saveJson.ok, true);
    assert.equal(saveJson.id, 'author-test-exam-1');

    // 3. List authored exams
    const listRes = await fetch(`${base}/api/author/exams`, {
      headers: { Cookie: adminCookie }
    });
    const listJson = await listRes.json();
    assert.equal(listJson.exams.length, 1);
    assert.equal(listJson.exams[0].id, 'author-test-exam-1');

    // 4. Issue new student account visually
    const createUserRes = await fetch(`${base}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: adminCookie },
      body: JSON.stringify({
        loginId: 'newstudent',
        name: 'New Authored Student',
        phone: '917777777777',
        role: 'student',
        password: 'StudentPass123!'
      })
    });
    assert.equal(createUserRes.status, 201, 'User creation failed');

    // 5. Assign authored exam to newstudent
    const assignRes = await fetch(`${base}/api/author/exams/author-test-exam-1/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: adminCookie },
      body: JSON.stringify({ userIds: ['newstudent'] })
    });
    assert.equal(assignRes.status, 200, 'Assign exam failed');

    // 6. Sign in as newstudent and attempt the exam
    const studentCookie = await login('newstudent', 'StudentPass123!');

    const startRes = await fetch(`${base}/api/exams/author-test-exam-1/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: studentCookie },
      body: JSON.stringify({})
    });
    assert.equal(startRes.status, 200, 'Student failed to start authored exam');
    const attempt = await startRes.json();
    assert.equal(attempt.exam.questions.length, 3);

    // 7. Submit correct answers using version chaining
    const a1Res = await fetch(`${base}/api/attempts/${attempt.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: studentCookie },
      body: JSON.stringify({ mutationId: 'm1', questionId: 'q1', value: 'a', review: false, expectedVersion: attempt.version })
    });
    const a1 = await a1Res.json();

    const a2Res = await fetch(`${base}/api/attempts/${attempt.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: studentCookie },
      body: JSON.stringify({ mutationId: 'm2', questionId: 'q2', value: ['green', 'red'], review: false, expectedVersion: a1.version })
    });
    const a2 = await a2Res.json();

    const a3Res = await fetch(`${base}/api/attempts/${attempt.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: studentCookie },
      body: JSON.stringify({ mutationId: 'm3', questionId: 'q3', value: '15', review: false, expectedVersion: a2.version })
    });
    const a3 = await a3Res.json();

    const submitRes = await fetch(`${base}/api/attempts/${attempt.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, Cookie: studentCookie },
      body: JSON.stringify({ expectedVersion: a3.version })
    });
    assert.equal(submitRes.status, 200, 'Exam submission failed');
    const scoreResult = await submitRes.json();
    assert.equal(scoreResult.status, 'submitted');
    assert.equal(scoreResult.result.score, 12, 'Perfect score should equal maxMarks (12)');
  } finally {
    app.server.close();
    await database.close();
  }
});
