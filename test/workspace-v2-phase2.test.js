import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { createUser } from '../src/auth.js';

async function fixture(t) {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);
  const teacher = await createUser(db, { loginId: 'teacher_v2', name: 'Teacher V2', role: 'teacher', password: 'Password12345!', phone: '919876543211' });
  const app = createApp(db, { otp: { send: async () => 'sess-123', verify: async () => true } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { base, db, teacher };
}

test('Phase 2: Authoring Studio - Save exam with NAT range & MCQ questions', async (t) => {
  const { base, teacher } = await fixture(t);

  // Sign in as teacher
  const loginRes = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ loginId: teacher.loginId, password: 'Password12345!' })
  });
  assert.equal(loginRes.status, 200);
  const cookies = loginRes.headers.get('set-cookie');

  const verifyRes = await fetch(`${base}/api/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: cookies },
    body: JSON.stringify({ code: '123456' })
  });
  assert.equal(verifyRes.status, 200);
  const sessionCookie = verifyRes.headers.get('set-cookie');

  // Save new exam via authoring API
  const newExam = {
    id: 'uceed-2027-v2-mock',
    title: 'UCEED 2027 Authoring Mock',
    durationSeconds: 7200,
    totalQuestions: 2,
    maxMarks: 7,
    sections: [
      { id: 'sec1', title: 'NAT Section', durationSeconds: 3600 },
      { id: 'sec2', title: 'MCQ Section', durationSeconds: 3600 }
    ],
    questions: [
      {
        id: 'q1',
        sectionId: 'sec1',
        prompt: 'Find total number of surfaces in the model.',
        type: 'NAT',
        answer: { min: 14.0, max: 14.0 },
        marks: { correct: 4, incorrect: 0, unanswered: 0 }
      },
      {
        id: 'q2',
        sectionId: 'sec2',
        prompt: 'Which color primary palette is additive?',
        type: 'MCQ',
        options: [
          { id: 'a', text: 'RGB' },
          { id: 'b', text: 'CMYK' }
        ],
        answer: 'a',
        marks: { correct: 3, incorrect: -1, unanswered: 0 }
      }
    ]
  };

  const saveRes = await fetch(`${base}/api/author/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: sessionCookie },
    body: JSON.stringify(newExam)
  });
  assert.equal(saveRes.status, 200);

  // Verify list authored exams
  const listRes = await fetch(`${base}/api/author/exams`, {
    headers: { cookie: sessionCookie }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  const created = listData.exams.find(e => e.id === 'uceed-2027-v2-mock');
  assert.ok(created);
  assert.equal(created.title, 'UCEED 2027 Authoring Mock');
});
