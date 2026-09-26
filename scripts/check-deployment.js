import { WebSocket } from 'ws';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const input = process.argv[2];
if (!input) { console.error('Usage: npm run deployment:check -- https://your-service.onrender.com'); process.exit(1); }
const base = new URL(input);
if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Provide a public HTTPS URL without credentials');
base.pathname = '/'; base.search = ''; base.hash = '';
const response = await fetch(new URL('/health', base), { signal: AbortSignal.timeout(60000) });
assert.equal(response.status, 200);
const health = await response.json();
assert.equal(health.status, 'ok'); assert.equal(health.database, 'postgres');
console.log('PASS: public health endpoint and PostgreSQL connection');
const socketUrl = new URL('/ws', base); socketUrl.protocol = 'wss:';
const ws = new WebSocket(socketUrl, { origin: base.origin, handshakeTimeout: 60000 });
try {
  await once(ws, 'open', { signal: AbortSignal.timeout(65000) });
  const pending = once(ws, 'message', { signal: AbortSignal.timeout(10000) });
  const sent = 'BRDS deployment check ' + Date.now();
  ws.send(sent);
  assert.equal((await pending)[0].toString(), sent);
  console.log('PASS: public secure WebSocket exact-message round-trip');
} finally { ws.terminate(); }
const protectedResponse = await fetch(new URL('/api/teacher', base), { signal: AbortSignal.timeout(10000) });
assert.equal(protectedResponse.status, 401);
console.log('PASS: unauthenticated teacher access rejected');
console.log('Device acceptance and real OTP delivery are separate checks.');
