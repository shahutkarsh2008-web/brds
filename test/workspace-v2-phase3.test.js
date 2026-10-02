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
  const student = await createUser(db, {
    loginId: 'student_p3',
    name: 'Student Phase3',
    role: 'student',
    password: 'Password12345!',
    phone: '919876543219'
  });
  const app = createApp(db, {
    otp: { send: async () => 'sess-123', verify: async () => true }
  });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { base, db, student };
}

test('Phase 3: Custom Practice Set Generator - Create set, list sets & count', async (t) => {
  const { base, student } = await fixture(t);

  // 1. Sign in as student
  const loginRes = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ loginId: student.loginId, password: 'Password12345!' })
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

  // 2. Fetch practice question count
  const countRes = await fetch(`${base}/api/student/practice/count`, {
    headers: { cookie: sessionCookie }
  });
  assert.equal(countRes.status, 200);
  const countData = await countRes.json();
  assert.ok(typeof countData.count === 'number');

  // 3. Create Custom Practice Set via POST /api/student/practice/create
  const createPayload = {
    exam: 'UCEED',
    topics: ['Spatial Reasoning', 'Pattern Recognition'],
    type: 'MCQ',
    difficulty: 'Medium',
    skipDone: true,
    setSize: 10,
    title: 'UCEED Spatial Practice Drill #1'
  };

  const createRes = await fetch(`${base}/api/student/practice/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: sessionCookie },
    body: JSON.stringify(createPayload)
  });
  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.ok(createData.set);
  assert.equal(createData.set.title, 'UCEED Spatial Practice Drill #1');
  assert.equal(createData.set.totalQuestions, 0);
  assert.equal(createData.set.questionIds.length, 0);
  assert.equal(createData.set.status, 'empty');

  // 4. Fetch Saved Practice Sets via GET /api/student/practice/sets
  const setsRes = await fetch(`${base}/api/student/practice/sets`, {
    headers: { cookie: sessionCookie }
  });
  assert.equal(setsRes.status, 200);
  const setsData = await setsRes.json();
  assert.ok(Array.isArray(setsData.sets));
  assert.equal(setsData.sets.length, 1);
  assert.equal(setsData.sets[0].id, createData.set.id);
  assert.equal(setsData.sets[0].title, 'UCEED Spatial Practice Drill #1');

  // 5. Unauthenticated request rejected
  const unauthRes = await fetch(`${base}/api/student/practice/sets`);
  assert.equal(unauthRes.status, 401);
});
