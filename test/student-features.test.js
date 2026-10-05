import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { createUser, digest } from '../src/auth.js';

async function fixture(t) {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);
  const users = {};
  for (const loginId of ['features_a', 'features_b']) {
    const user = await createUser(db, { loginId, name: loginId, role: 'student', password: 'Password12345!', phone: '919876543210' });
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await db.query('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)', [digest(token), user.id, Date.now(), Date.now() + 86400000]);
    users[loginId] = { user, cookie: `brds_session=${token}` };
  }
  const app = createApp(db, { otp: { send: async () => 'fixture', verify: async () => true } });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function api(path, method = 'GET', body, who = 'features_a') {
    const response = await fetch(base + path, { method, headers: { Origin: base, Cookie: users[who].cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  return { api };
}

test('Phase 4 preferences and GK review persist per student with validated inputs', async t => {
  const f = await fixture(t);
  const initial = await f.api('/api/student/preferences');
  assert.deepEqual(initial.body.preferences, { targetExam: 'UCEED 2026', theme: 'dark', reminders: false });
  assert.match(initial.headers.get('content-security-policy'), /img-src 'self' data:/);
  const saved = await f.api('/api/student/preferences', 'POST', { targetExam: 'CEED 2027', theme: 'light', reminders: true });
  assert.equal(saved.status, 200);
  await Promise.all([
    f.api('/api/student/preferences', 'POST', { targetExam: 'NIFT 2027' }),
    f.api('/api/student/preferences', 'POST', { theme: 'dark' })
  ]);
  assert.deepEqual((await f.api('/api/student/preferences')).body.preferences, { targetExam: 'NIFT 2027', theme: 'dark', reminders: true });
  assert.equal((await f.api('/api/student/preferences', 'POST', { theme: 'neon' })).status, 400);
  assert.equal((await f.api('/api/student/preferences', 'POST', { admin: true })).status, 400);
  assert.equal((await f.api('/api/student/preferences', 'POST', { targetExam: 'UCEED' }, 'features_b')).body.preferences.targetExam, 'UCEED');
  assert.equal((await f.api('/api/student/preferences', 'GET', undefined, 'features_b')).body.preferences.theme, 'dark');

  const deck = await f.api('/api/student/features/gk/cards');
  assert.ok(deck.body.totalCards >= 10);
  assert.equal(deck.body.cards[0].box, 0);
  const review = await f.api('/api/student/features/gk/review', 'POST', { cardId: deck.body.cards[0].id, rating: 'remembered' });
  assert.equal(review.body.progress.box, 1);
  assert.equal((await f.api('/api/student/features/gk/cards')).body.cards[0].seenCount, 1);
  await Promise.all(Array.from({ length: 3 }, () => f.api('/api/student/features/gk/review', 'POST', { cardId: deck.body.cards[0].id, rating: 'remembered' })));
  const repeated = (await f.api('/api/student/features/gk/cards')).body.cards[0];
  assert.equal(repeated.box, 4);
  assert.equal(repeated.seenCount, 4);
  assert.equal((await f.api('/api/student/features/gk/cards', 'GET', undefined, 'features_b')).body.cards[0].seenCount, 0);
  assert.equal((await f.api('/api/student/features/gk/review', 'POST', { cardId: 'missing', rating: 'again' })).status, 404);
});

test('Phase 4 sketch gallery validates image uploads and keeps records private', async t => {
  const f = await fixture(t);
  const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=';
  assert.equal((await f.api('/api/student/features/sketches', 'POST', { title: 'Study', prompt: 'Draw a wayfinding sign', imageDataUrl: 'data:image/png;base64,ZmFrZQ==' })).status, 400);
  const created = await f.api('/api/student/features/sketches', 'POST', { title: 'Wayfinding', prompt: 'Draw a clear sign for a busy station', imageDataUrl });
  assert.equal(created.status, 201);
  assert.equal((await f.api('/api/student/features/sketches')).body.sketches.length, 1);
  assert.equal((await f.api('/api/student/features/sketches', 'GET', undefined, 'features_b')).body.sketches.length, 0);
  assert.equal((await f.api(`/api/student/features/sketches/${created.body.sketch.id}/delete`, 'POST', {} , 'features_b')).status, 404);
  assert.equal((await f.api(`/api/student/features/sketches/${created.body.sketch.id}/delete`, 'POST', {})).body.deleted, true);
  assert.equal((await f.api('/api/student/features/sketches')).body.sketches.length, 0);
});

test('Phase 4 guide notes and five-question quiz expose no answer key and persist scores', async t => {
  const f = await fixture(t);
  const catalog = await f.api('/api/student/features/guides');
  assert.ok(catalog.body.guides.length >= 3);
  const guide = catalog.body.guides[0];
  assert.ok(guide.summary && guide.workedExample);
  assert.equal(guide.quiz.length, 5);
  assert.ok(guide.quiz.every(question => !Object.hasOwn(question, 'answer')));
  assert.equal((await f.api(`/api/student/features/guides/${guide.id}/quiz`, 'POST', { answers: {} })).status, 400);
  const answers = Object.fromEntries(guide.quiz.map(question => {
    const shift = Number(question.id.match(/(\d+)$/)?.[1] || 0) % question.options.length;
    return [question.id, (question.options.length - shift) % question.options.length];
  }));
  const result = await f.api(`/api/student/features/guides/${guide.id}/quiz`, 'POST', { answers });
  assert.equal(result.status, 200);
  assert.equal(result.body.result.correct, 5, 'server score must follow shuffled option positions without returning its key');
  assert.equal(result.body.result.total, 5);
  assert.ok(result.body.result.correct >= 0 && result.body.result.correct <= 5);
  const retry = await f.api(`/api/student/features/guides/${guide.id}/quiz`, 'POST', { answers });
  const progress = await f.api('/api/student/features/guides/progress');
  assert.equal(progress.body.progress.find(item => item.guideId === guide.id).attempts, 2);
  assert.equal(progress.body.progress.find(item => item.guideId === guide.id).lastCorrect, retry.body.result.correct);
});
