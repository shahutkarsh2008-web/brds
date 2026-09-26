import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/app.js';

test('login session survives closing and reopening server and database', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'brds-persist-'));
  const path = join(folder, 'auth.sqlite');
  const otp = { send: async () => 'test-session', verify: async (_, code) => code === '123456' };
  let app;
  try {
    let db = await openDatabase({ SQLITE_PATH: path }); await migrate(db);
    await createUser(db, { loginId: 'persistent-student', name: 'Persistence Test', role: 'student', phone: '919999999999', password: 'Persistence-test-123!' });
    app = createApp(db, { otp, env: {} }); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
    let base = 'http://127.0.0.1:' + app.server.address().port;
    const pending = await fetch(base + '/api/login', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: 'persistent-student', password: 'Persistence-test-123!' }) });
    assert.equal(pending.status, 200);
    const verified = await fetch(base + '/api/verify-otp', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', Cookie: pending.headers.getSetCookie()[0].split(';')[0] }, body: '{"code":"123456"}' });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.getSetCookie().find(x => x.startsWith('brds_session=')).split(';')[0];
    await app.close(); app = null;
    db = await openDatabase({ SQLITE_PATH: path }); await migrate(db);
    app = createApp(db, { otp, env: {} }); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
    base = 'http://127.0.0.1:' + app.server.address().port;
    const restored = await fetch(base + '/api/me', { headers: { Cookie: cookie } });
    assert.equal((await restored.json()).user.loginId, 'persistent-student');
    assert.equal((await db.query('SELECT * FROM login_history')).rowCount, 1);
  } finally { if (app) await app.close(); await rm(folder, { recursive: true, force: true }); }
});

test('production uses secure host cookies and requires HTTPS origin', async () => {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' }); await migrate(db);
  assert.throws(() => createApp(db, { env: { NODE_ENV: 'production' } }), /HTTPS/);
  assert.throws(() => createApp(db, { env: { NODE_ENV: 'production', APP_ORIGIN: 'http://example.com' } }), /HTTPS/);
  await createUser(db, { loginId: 'secure-test', name: 'Secure test', role: 'teacher', phone: '919999999999', password: 'Secure-password-123!' });
  const app = createApp(db, { env: { NODE_ENV: 'production', APP_ORIGIN: 'https://brds.example' }, otp: { send: async () => 'id', verify: async () => true } });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + app.server.address().port;
    const headers = { Origin: 'https://brds.example', 'Content-Type': 'application/json' };
    const login = await fetch(base + '/api/login', { method: 'POST', headers, body: JSON.stringify({ loginId: 'secure-test', password: 'Secure-password-123!' }) });
    const pending = login.headers.getSetCookie()[0];
    assert.match(pending, /^__Host-brds_challenge=/); assert.match(pending, /; Secure/);
    const verify = await fetch(base + '/api/verify-otp', { method: 'POST', headers: { ...headers, Cookie: pending.split(';')[0] }, body: '{"code":"123456"}' });
    const session = verify.headers.getSetCookie().find(x => x.startsWith('__Host-brds_session='));
    assert.match(session, /; Secure/); assert.match(session, /HttpOnly/); assert.match(session, /SameSite=Strict/);
    assert.doesNotMatch(session, /Domain=/);
  } finally { await app.close(); }
});
