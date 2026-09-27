import { WebSocket } from 'ws';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const input = process.argv[2] || process.env.APP_ORIGIN || 'http://localhost:3000';
console.log(`[PREFLIGHT CHECK] Running preflight launch checks against target: ${input}`);

const base = new URL(input);
base.pathname = '/'; base.search = ''; base.hash = '';

// 1. Check health endpoint
const healthUrl = new URL('/health', base);
const healthRes = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
assert.equal(healthRes.status, 200, `Health check failed with status ${healthRes.status}`);
const health = await healthRes.json();
assert.equal(health.status, 'ok', 'Health status must be ok');
console.log(`✅ [PASS] Health check passed (${health.database} database connected)`);

// 2. Check static page accessibility
const staticPages = ['/login', '/student', '/teacher', '/admin'];
for (const page of staticPages) {
  const pageRes = await fetch(new URL(page, base), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.ok([200, 302].includes(pageRes.status), `Page ${page} returned unexpected status ${pageRes.status}`);
}
console.log('✅ [PASS] Static pages and authentication routing accessible');

// 3. Check protected route authorization
const unauthRes = await fetch(new URL('/api/admin/users', base), { signal: AbortSignal.timeout(10000) });
assert.equal(unauthRes.status, 401, `Unauthenticated endpoint expected 401, got ${unauthRes.status}`);
console.log('✅ [PASS] Protected endpoints reject unauthenticated requests');

// 4. Check WebSocket round-trip
const socketUrl = new URL('/ws', base);
socketUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(socketUrl, { origin: base.origin, handshakeTimeout: 10000 });
try {
  await once(ws, 'open', { signal: AbortSignal.timeout(10000) });
  const messagePromise = once(ws, 'message', { signal: AbortSignal.timeout(10000) });
  const payload = 'BRDS preflight check payload ' + Date.now();
  ws.send(payload);
  const [data] = await messagePromise;
  assert.equal(data.toString(), payload, 'WebSocket echo payload mismatched');
  console.log('✅ [PASS] WebSocket round-trip exact payload verified');
} finally {
  ws.terminate();
}

// 5. Environment configuration report
const key = process.env.TWOFACTOR_API_KEY;
if (key) {
  console.log('✅ [PASS] 2Factor SMS API Key configured in environment');
} else {
  console.log('⚠️ [NOTE] TWOFACTOR_API_KEY not configured in current environment (Mock mode/Tests active)');
}

console.log('\n🎉 ALL PREFLIGHT LAUNCH CHECKS PASSED SUCCESSFULLY!\n');
