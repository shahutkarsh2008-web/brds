import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';

async function fixture(t, database) {
  const app = createApp(database || await openDatabase({ SQLITE_PATH: ':memory:' }));
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { base, ws: base.replace('http:', 'ws:') + '/ws' };
}

test('health verifies database and page assets come from the same server', async t => {
  const { base } = await fixture(t);
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', database: 'sqlite', phase: 1 });
  for (const path of ['/', '/app.js', '/style.css']) assert.equal((await fetch(base + path)).status, 200);
  assert.equal((await fetch(base + '/missing')).status, 404);
  assert.equal((await fetch(base + '/health', { method: 'POST' })).status, 405);
});

test('health fails closed when database is unavailable without exposing details', async t => {
  const { base } = await fixture(t, { kind: 'postgres', check: async () => { throw new Error('secret connection string'); }, close: async () => {} });
  const response = await fetch(base + '/health');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
});

test('WebSocket echoes exact text and binary payloads', { timeout: 5000 }, async t => {
  const { ws } = await fixture(t);
  const client = new WebSocket(ws);
  await once(client, 'open');
  for (const payload of ['BRDS ✓ connection check', Buffer.from([0, 1, 127, 255])]) {
    const received = once(client, 'message');
    client.send(payload);
    const [data, binary] = await received;
    assert.equal(binary, Buffer.isBuffer(payload));
    assert.deepEqual(data, Buffer.from(payload));
  }
  client.close(); await once(client, 'close');
});

test('WebSocket rejects foreign browser origins and unknown paths', { timeout: 5000 }, async t => {
  const { ws } = await fixture(t);
  for (const [url, options, expected] of [[ws, { origin: 'https://other.example' }, 403], [ws + '/missing', {}, 404]]) {
    const client = new WebSocket(url, options);
    client.on('error', () => {});
    const [, response] = await once(client, 'unexpected-response');
    assert.equal(response.statusCode, expected);
    client.terminate();
  }
});

test('SQLite stores schema metadata across reopening the file', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'brds-test-'));
  const path = join(folder, 'test.sqlite');
  try {
    const first = await openDatabase({ SQLITE_PATH: path }); await first.check(); await first.close();
    const { DatabaseSync } = await import('node:sqlite');
    const reopened = new DatabaseSync(path);
    assert.equal(reopened.prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'").get().value, '0');
    reopened.close();
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('production refuses ephemeral SQLite fallback', async () => {
  await assert.rejects(openDatabase({ NODE_ENV: 'production' }), /DATABASE_URL/);
});
