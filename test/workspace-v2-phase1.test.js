import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';

async function fixture(t) {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);
  const app = createApp(db, { otp: { send: async () => 'sess-123', verify: async () => true } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { base, db };
}

test('Phase 1: Serving static dark mode assets and student signup page', async (t) => {
  const { base } = await fixture(t);

  // Test static signup page asset
  const resSignup = await fetch(`${base}/signup.html`);
  assert.equal(resSignup.status, 200);
  const textSignup = await resSignup.text();
  assert.ok(textSignup.includes('Create Student Account'));

  // Test static dark mode CSS asset
  const resCss = await fetch(`${base}/workspace-dark.css`);
  assert.equal(resCss.status, 200);
  const textCss = await resCss.text();
  assert.ok(textCss.includes('--bg-canvas'));
});

test('Phase 1: Student self-registration via POST /api/auth/register', async (t) => {
  const { base } = await fixture(t);

  const payload = {
    name: 'Test Student',
    loginId: 'teststudent_2026',
    phone: '919876543210',
    password: 'Password12345!',
    targetExam: 'UCEED 2026'
  };

  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.user.loginId, 'teststudent_2026');
  assert.equal(data.user.role, 'student');
});
