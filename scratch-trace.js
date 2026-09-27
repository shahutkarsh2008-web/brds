import { openDatabase } from './src/database.js';
import { migrate } from './src/schema.js';
import { createUser } from './src/auth.js';
import { createApp } from './src/app.js';
import { once } from 'node:events';

const database = await openDatabase({ SQLITE_PATH: './data/development.sqlite' });
await migrate(database);

const app = createApp(database, {
  development: true,
  env: {},
  otp: {
    async send() { return 'sess-1'; },
    async verify() { return true; }
  }
});

app.server.listen(3002, '127.0.0.1');
await once(app.server, 'listening');
const base = 'http://127.0.0.1:3002';

console.log('--- Testing Step 1: POST /api/login ---');
const r1 = await fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ loginId: 'admin', password: 'BRDS-local-demo-2026!' })
});
console.log('Login status:', r1.status);
const c1 = r1.headers.get('set-cookie').split(';')[0];
console.log('Challenge cookie:', c1);

console.log('--- Testing Step 2: POST /api/verify-otp ---');
const r2 = await fetch(`${base}/api/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base, Cookie: c1 },
  body: JSON.stringify({ code: '123456' })
});
console.log('Verify status:', r2.status);
const data2 = await r2.json();
console.log('Verify body:', data2);
const c2 = r2.headers.get('set-cookie').split(';')[0];
console.log('Session cookie:', c2);

console.log('--- Testing Step 3: GET /admin with Session Cookie ---');
const r3 = await fetch(`${base}/admin`, {
  headers: { Cookie: c2 },
  redirect: 'manual'
});
console.log('GET /admin status:', r3.status);

console.log('--- Testing Step 4: GET /api/me with Session Cookie ---');
const r4 = await fetch(`${base}/api/me`, {
  headers: { Cookie: c2 }
});
console.log('GET /api/me status:', r4.status);
console.log('GET /api/me body:', await r4.json());

app.server.close();
await database.close();
