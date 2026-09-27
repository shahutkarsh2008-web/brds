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
  const admin = await createUser(db, { loginId: 'admin_test', name: 'Admin Test', role: 'admin', password: 'Abc123@def!99', phone: '919981084008' });
  const app = createApp(db, { otp: { send: async () => 'sess-123', verify: async () => true } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { base, db, admin };
}

test('POST /api/log-client-event records frontend telemetry logs', async t => {
  const { base } = await fixture(t);
  const response = await fetch(base + '/api/log-client-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ path: '/exam', message: 'Test client error', stack: 'Error: Test\n at exam.js:10' })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { logged: true });
});

test('GET /api/admin/backup returns database backup JSON for admin', async t => {
  const { base } = await fixture(t);
  // Login as admin
  const loginRes = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ loginId: 'admin_test', password: 'Abc123@def!99' })
  });
  assert.equal(loginRes.status, 200);
  const cookies = loginRes.headers.get('set-cookie');

  const verifyRes = await fetch(base + '/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: cookies },
    body: JSON.stringify({ code: '123456' })
  });
  assert.equal(verifyRes.status, 200);
  const sessionCookie = verifyRes.headers.get('set-cookie');

  const backupRes = await fetch(base + '/api/admin/backup', {
    headers: { cookie: sessionCookie }
  });
  assert.equal(backupRes.status, 200);
  const backup = await backupRes.json();
  assert.ok(backup.exportedAt);
  assert.ok(backup.summary);
  assert.ok(Array.isArray(backup.users));
});

test('POST /api/admin/verify-pin verifies admin password for sensitive actions', async t => {
  const { base } = await fixture(t);
  // Login as admin
  const loginRes = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ loginId: 'admin_test', password: 'Abc123@def!99' })
  });
  const cookies = loginRes.headers.get('set-cookie');
  const verifyRes = await fetch(base + '/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: cookies },
    body: JSON.stringify({ code: '123456' })
  });
  const sessionCookie = verifyRes.headers.get('set-cookie');

  const pinRes = await fetch(base + '/api/admin/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: sessionCookie },
    body: JSON.stringify({ password: 'Abc123@def!99' })
  });
  assert.equal(pinRes.status, 200);
  assert.deepEqual(await pinRes.json(), { verified: true });

  const invalidPinRes = await fetch(base + '/api/admin/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, cookie: sessionCookie },
    body: JSON.stringify({ password: 'WrongPassword123!' })
  });
  assert.equal(invalidPinRes.status, 401);
});
