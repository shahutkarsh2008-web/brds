import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

test('Phase 4 workspace dashboard renderer is valid and present', async () => {
  const source = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(source, /function render|const render/);
  assert.match(source, /Papers Library|overview/i);
  assert.match(source, /api\/student\/practice\/sets/);
  assert.match(source, /No matching questions found in the bank/);
  assert.match(source, /isMsq/);
  assert.match(source, /exam\.html\?id=/);
  for (const endpoint of ['/api/student/features/gk/cards', '/api/student/features/sketches', '/api/student/features/guides', '/api/student/preferences', '/api/student/bookmarks']) assert.ok(source.includes(endpoint));
  assert.match(source, /No sketches saved yet/);
  assert.match(source, /Nothing matches these filters/);
});

test('Phase 4 feature tabs render usable GK, sketch, revision, guide and settings flows', async () => {
  const source = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  const calls = [];
  const errors = [];
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/dashboard', runScripts: 'outside-only', virtualConsole: new VirtualConsole().on('jsdomError', error => errors.push(error.message)) });
  const guide = { id: 'guide', title: 'Visual observation', topic: 'Observation', summary: 'Separate observation from inference.', workedExample: 'Track one landmark.', quiz: Array.from({ length: 5 }, (_, index) => ({ id: `q${index + 1}`, prompt: `Prompt ${index + 1}`, options: ['A', 'B', 'C'] })) };
  dom.window.fetch = async (url, options = {}) => {
    const path = String(url);
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, method: options.method || 'GET', body });
    let payload = {};
    if (path === '/api/student/preferences') payload = options.method === 'POST' ? { preferences: { targetExam: body.targetExam || 'UCEED 2026', theme: body.theme || 'dark', reminders: body.reminders ?? false } } : { preferences: { targetExam: 'UCEED 2026', theme: 'dark', reminders: false } };
    else if (path === '/api/student/features/gk/cards') payload = { totalCards: 1, dueCount: 1, cards: [{ id: 'card-one', category: 'Craft', front: 'Front side', back: 'Back side', box: 0, seenCount: 0 }] };
    else if (path === '/api/student/features/sketches') payload = { sketches: [] };
    else if (path === '/api/student/bookmarks') payload = { bookmarks: [{ id: 'q1', questionId: 'q1', examId: 'paper-1', examTitle: 'Paper 1', topic: 'Spatial Reasoning', type: 'MCQ', prompt: 'Saved question', bookmarked: true }] };
    else if (path === '/api/student/features/revision') payload = { questions: [{ id: 'q2', originalQuestionId: 'q2', examId: 'paper-2', examTitle: 'Paper 2', topic: 'Observation', type: 'MSQ', prompt: 'Missed question', reviewed: false }] };
    else if (path === '/api/student/features/revision/review') payload = { review: { reviewed: body.reviewed } };
    else if (path === '/api/student/features/guides') payload = { guides: [guide] };
    else if (path === '/api/student/features/guides/progress') payload = { progress: [] };
    else if (path.endsWith('/quiz')) payload = { result: { correct: 4, total: 5, percentage: 80 } };
    else if (path.endsWith('/review')) payload = { progress: { box: 1 } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  dom.window.eval(source);
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const go = index => [...dom.window.document.querySelectorAll('.nav-icon-btn')][index].click();
  await tick(); await tick();

  go(5); await tick(); await tick();
  assert.match(dom.window.document.querySelector('#app').textContent, /Front side/);
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Reveal answer')).click(); await tick();
  assert.match(dom.window.document.querySelector('#app').textContent, /Back side/);
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Remembered')).click(); await tick(); await tick();
  assert.ok(calls.some(call => call.path.endsWith('/review') && call.body.rating === 'remembered'));

  go(6); await tick(); await tick();
  assert.match(dom.window.document.querySelector('#app').textContent, /private gallery/);
  assert.ok(dom.window.document.querySelector('input[type=file]'));
  assert.match(dom.window.document.querySelector('#app').textContent, /20-minute timebox/);
  const startTimer = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Start timer');
  startTimer.click();
  assert.match(dom.window.document.querySelector('#sketch-timer-status').textContent, /Timer running/);
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Pause timer').click();
  go(7); await tick(); await tick();
  const bookmarkText = dom.window.document.querySelector('#app').textContent;
  assert.match(bookmarkText, /Saved question/); assert.match(bookmarkText, /Missed question/);
  const revisionAction = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Practice this topic'));
  revisionAction.click(); await tick(); await tick();
  assert.match(dom.window.document.querySelector('#app').textContent, /Practice Set Builder/);
  go(7); await tick(); await tick();
  const markReviewed = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Mark reviewed'));
  markReviewed.click(); await tick(); await tick();
  assert.ok(calls.some(call => call.path.endsWith('/revision/review') && call.body.reviewed === true));

  go(8); await tick(); await tick();
  assert.ok(dom.window.document.querySelector('input[placeholder="Search guide topics"]'));
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Start 5-question quiz')).click(); await tick(); await tick();
  for (let index = 0; index < 5; index++) {
    const firstOption = dom.window.document.querySelectorAll('.quiz-question')[index].querySelector('.quiz-option');
    firstOption.click(); await tick(); await tick();
  }
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Submit answers')).click(); await tick(); await tick();
  assert.match(dom.window.document.querySelector('#app').textContent, /Result saved: 4\/5/);
  assert.ok(calls.some(call => call.path.endsWith('/quiz') && Object.keys(call.body.answers).length === 5));

  go(9); await tick(); await tick();
  dom.window.document.querySelector('#settings-target-exam').value = 'CEED 2027';
  dom.window.document.querySelector('#settings-theme').value = 'light';
  dom.window.document.querySelector('#settings-reminders').checked = true;
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Save preferences')).click(); await tick(); await tick();
  assert.ok(calls.some(call => call.path === '/api/student/preferences' && call.method === 'POST' && call.body.targetExam === 'CEED 2027'));
  assert.equal(dom.window.document.body.classList.contains('light-mode'), true);
  assert.deepEqual(errors, []);
  dom.window.close();
});
