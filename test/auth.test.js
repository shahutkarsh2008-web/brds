import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { createOtpProvider, OtpUnavailable } from '../src/otp.js';
import { bootstrapAdmin } from '../scripts/bootstrap-admin.js';

const password = 'Test-only password 123!';
async function fixture(t, options = {}) {
  const database = await openDatabase({ SQLITE_PATH: ':memory:' }); await migrate(database);
  let clock = Date.now(); let sent = 0;
  const providerSessions = new Map();
  const otp = options.otp || { async send(phone) { sent++; const id = randomUUID(); providerSessions.set(id, phone); return id; }, async verify(id, code) { return providerSessions.has(id) && code === '123456'; } };
  for (const role of ['student', 'teacher', 'admin']) await createUser(database, { loginId: role, name: `${role} test`, role, phone: '919999999999', password });
  const app = createApp(database, { otp, env: {}, now: () => clock });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening'); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const jars = {};
  async function request(path, data, actor = 'student', overrides = {}) {
    const headers = { ...(data === undefined ? {} : { 'Content-Type': 'application/json', Origin: base }), Cookie: jars[actor] || '', ...overrides };
    const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : { body: JSON.stringify(data) }), redirect: 'manual' });
    const cookies = Object.fromEntries((jars[actor] || '').split('; ').filter(Boolean).map(x => x.split('=')));
    for (const entry of response.headers.getSetCookie()) { const [name, value] = entry.split(';')[0].split('='); cookies[name] = value; }
    jars[actor] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text(), headers: response.headers };
  }
  async function login(role = 'student') { assert.equal((await request('/api/login', { loginId: role, password }, role)).status, 200); return request('/api/verify-otp', { code: '123456' }, role); }
  return { database, base, request, login, jars, advance: value => { clock += value; }, sent: () => sent };
}

test('password then OTP is required; roles are enforced on pages and APIs', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/teacher')).status, 401);
  assert.equal((await f.request('/student')).status, 302);
  assert.equal((await f.request('/api/login', { loginId: 'student', password: 'wrong' })).status, 401);
  assert.equal(f.sent(), 0);
  const pending = await f.request('/api/login', { loginId: 'STUDENT', password });
  assert.equal(pending.status, 200); assert.equal(pending.body.phoneHint, '••••••9999');
  assert.equal((await f.request('/api/me')).body.user, null);
  assert.equal((await f.request('/api/verify-otp', { code: '000000' })).status, 401);
  const verified = await f.request('/api/verify-otp', { code: '123456' });
  assert.equal(verified.body.redirect, '/student');
  assert.match(verified.headers.get('set-cookie'), /HttpOnly/);
  assert.match(verified.headers.get('set-cookie'), /SameSite=Strict/);
  assert.equal((await f.request('/api/student')).status, 200);
  assert.equal((await f.request('/api/teacher')).status, 403);
  assert.equal((await f.request('/teacher')).status, 403);
  assert.equal((await f.request('/api/admin/users')).status, 403);
  assert.equal((await f.login('teacher')).body.user.role, 'teacher');
  assert.equal((await f.request('/api/teacher', undefined, 'teacher')).status, 200);
  assert.equal((await f.request('/api/admin/users', undefined, 'teacher')).status, 403);
  const rows = await f.database.query('SELECT password_hash FROM users');
  assert.ok(rows.rows.every(row => row.password_hash.startsWith('scrypt:') && !row.password_hash.includes(password)));
});

test('expired, replayed and exhausted challenges cannot create sessions', async t => {
  const f = await fixture(t);
  await f.request('/api/login', { loginId: 'student', password });
  const stale = f.jars.student;
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/verify-otp', { code: '000000' })).status, 401);
  assert.equal((await f.request('/api/verify-otp', { code: '123456' })).status, 401);
  f.advance(16 * 60000); await f.request('/api/login', { loginId: 'student', password });
  assert.equal((await f.request('/api/verify-otp', { code: '123456' }, 'student', { Cookie: stale })).status, 401);
  f.advance(6 * 60000);
  assert.equal((await f.request('/api/verify-otp', { code: '123456' })).status, 401);
});

test('concurrent OTP verification issues exactly one session and login record', async t => {
  const f = await fixture(t); await f.request('/api/login', { loginId: 'student', password });
  const challengeCookie = f.jars.student;
  const responses = await Promise.all([1, 2].map(() => f.request('/api/verify-otp', { code: '123456' }, 'student', { Cookie: challengeCookie })));
  assert.deepEqual(responses.map(x => x.status).sort(), [200, 401]);
  assert.equal((await f.database.query('SELECT * FROM sessions')).rowCount, 1);
  assert.equal((await f.database.query('SELECT * FROM login_history')).rowCount, 1);
});

test('admin issues accounts; duplicates, short passwords and unauthorized creation rejected', async t => {
  const f = await fixture(t); await f.login('admin');
  const input = { loginId: 'student002', name: 'New student', role: 'student', phone: '+91 9999999999', password };
  assert.equal((await f.request('/api/admin/users', input, 'admin')).status, 201);
  assert.equal((await f.request('/api/admin/users', input, 'admin')).status, 409);
  assert.equal((await f.request('/api/admin/users', { ...input, loginId: 'new', password: 'short' }, 'admin')).status, 400);
  assert.equal((await f.request('/api/admin/users', undefined, 'admin')).body.users.length, 4);
  assert.equal((await f.request('/api/admin/users', input)).status, 401);
});

test('sessions survive independent requests, expire, and logout revokes HTTP and WebSocket access', async t => {
  const f = await fixture(t); await f.login();
  assert.equal((await f.request('/api/me')).body.user.role, 'student');
  const cookie = f.jars.student;
  const ws = new WebSocket(f.base.replace('http:', 'ws:') + '/session-ws', { origin: f.base, headers: { Cookie: cookie } });
  const hello = once(ws, 'message'); await once(ws, 'open');
  assert.equal(JSON.parse((await hello)[0]).role, 'student');
  const closed = once(ws, 'close');
  assert.equal((await f.request('/api/logout', {})).status, 200);
  assert.equal((await closed)[0], 4001);
  assert.equal((await f.request('/api/me', undefined, 'student', { Cookie: cookie })).body.user, null);
  f.advance(16 * 60000); await f.login(); f.advance(13 * 60 * 60000);
  assert.equal((await f.request('/api/me')).body.user, null);
});

test('authenticated WebSocket rejects missing sessions', async t => {
  const f = await fixture(t);
  const ws = new WebSocket(f.base.replace('http:', 'ws:') + '/session-ws', { origin: f.base }); ws.on('error', () => {});
  const [, response] = await once(ws, 'unexpected-response');
  assert.equal(response.statusCode, 401); ws.terminate();
});

test('origin checks, account rate limits and SMS cooldown prevent unsafe requests', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/login', { loginId: 'student', password }, 'student', { Origin: 'https://evil.example' })).status, 403);
  await f.request('/api/login', { loginId: 'student', password });
  assert.equal((await f.request('/api/login', { loginId: 'student', password })).status, 429);
  assert.equal(f.sent(), 1);
  for (let i = 0; i < 10; i++) await f.request('/api/login', { loginId: 'teacher', password: 'wrong' });
  assert.equal((await f.request('/api/login', { loginId: 'teacher', password })).status, 429);
});

test('missing OTP configuration fails closed without granting a session', async t => {
  const f = await fixture(t, { otp: createOtpProvider({}) });
  assert.equal((await f.request('/api/login', { loginId: 'student', password })).status, 503);
  assert.equal((await f.request('/api/me')).body.user, null);
  assert.equal((await f.database.query('SELECT * FROM sessions')).rowCount, 0);
});

test('2Factor adapter validates responses and never exposes secrets on transport errors', async () => {
  const urls = [];
  const provider = createOtpProvider({ TWOFACTOR_API_KEY: 'test-key', TWOFACTOR_TEMPLATE: 'BRDS OTP' }, async url => {
    urls.push(url); return new Response(JSON.stringify({ Status: 'Success', Details: url.includes('/VERIFY/') ? 'OTP Matched' : 'provider-session' }));
  });
  assert.equal(await provider.send('919999999999'), 'provider-session');
  assert.equal(await provider.verify('provider-session', '123456'), true);
  assert.ok(urls[0].endsWith('/919999999999/AUTOGEN/BRDS%20OTP'));
  assert.ok(urls[1].endsWith('/VERIFY/provider-session/123456'));
  const unavailable = createOtpProvider({ TWOFACTOR_API_KEY: 'private-key' }, async () => { throw new Error('private-key'); });
  await assert.rejects(unavailable.send('919999999999'), error => error instanceof OtpUnavailable && !error.message.includes('private-key'));
  const invalid = createOtpProvider({ TWOFACTOR_API_KEY: 'test' }, async () => new Response(JSON.stringify({ Status: 'Success', Details: 'unexpected' })));
  assert.equal(await invalid.verify('id', '123456'), false);
});

test('bootstrap is idempotent and does not reset an existing administrator', async t => {
  const f = await fixture(t);
  await bootstrapAdmin(f.database, { BOOTSTRAP_ADMIN_ID: 'second-admin', BOOTSTRAP_ADMIN_NAME: 'Other', BOOTSTRAP_ADMIN_PHONE: '919999999999', BOOTSTRAP_ADMIN_PASSWORD: password });
  assert.equal((await f.database.query("SELECT * FROM users WHERE role='admin'")).rowCount, 1);
});
