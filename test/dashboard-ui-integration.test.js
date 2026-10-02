import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('dashboard parses, Library shows honest metadata, and filtered Practice create opens fetched MSQ content', async () => {
  const calls = [];
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/dashboard', runScripts: 'outside-only', virtualConsole: new VirtualConsole()
  });
  const question = { id: 'q1', examId: 'library-paper', examTitle: 'Library Paper', sectionId: 'part-a', topic: 'Spatial Reasoning', type: 'MSQ', prompt: 'Which shapes are rotated?', options: [{ id: 'a', text: 'Triangle' }, { id: 'b', text: 'Square' }], marks: { correct: 3, incorrect: -1, unanswered: 0 } };
  dom.window.fetch = async (url, options = {}) => {
    const path = String(url);
    calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
    let payload = {};
    if (path === '/api/student/dashboard') payload = { user: { name: 'Test Student', targetExam: 'UCEED 2026' }, sparks: 0, kpis: { questionsAnswered: 0, completedAttempts: 0 }, calendar: [], attempts: [], topics: [], nextBestAction: { title: 'Start', reason: 'Try a paper.' } };
    else if (path === '/api/exams') payload = { exams: [{ id: 'library-paper', title: 'Library Paper', totalQuestions: null, maxMarks: null, durationSeconds: null, hasImages: false, status: 'available' }] };
    else if (path === '/api/student/practice/count') payload = { count: 1 };
    else if (path === '/api/student/practice/create') payload = { set: { id: 'set-1', questionIds: ['q1'], totalQuestions: 1, status: 'in_progress' } };
    else if (path === '/api/student/practice/sets/set-1') payload = { set: { id: 'set-1', title: 'Spatial Set', questionIds: ['q1'], questions: [question], answers: {}, totalQuestions: 1, completedQuestions: 0, status: 'in_progress' } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  assert.doesNotThrow(() => dom.window.eval(dashboardSource));
  await tick(); await tick();
  const nav = [...dom.window.document.querySelectorAll('.nav-icon-btn')];
  nav[3].click();
  await tick(); await tick();
  const libraryText = dom.window.document.querySelector('#app').textContent;
  assert.match(libraryText, /— Questions/);
  assert.match(libraryText, /— Mins/);
  assert.match(libraryText, /— Marks/);
  assert.doesNotMatch(libraryText, /57 Questions|200 Marks|Diagrams Included/);

  nav[2].click();
  await tick(); await tick();
  const examFilter = dom.window.document.querySelector('.practice-container select');
  examFilter.value = 'uceed-2026';
  examFilter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(); await tick();
  const create = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Generate Custom Practice Set'));
  assert.ok(create);
  create.click();
  await tick(); await tick(); await tick();
  assert.match(dom.window.document.querySelector('#app').textContent, /Which shapes are rotated\?/);
  const createCall = calls.find(call => call.path === '/api/student/practice/create');
  assert.equal(createCall.body.exam, 'uceed-2026');
  assert.equal(calls.some(call => call.path === '/api/student/practice/sets/set-1'), true);
  let option = [...dom.window.document.querySelectorAll('.option-choice-btn')].find(button => button.textContent.includes('Triangle'));
  option.click(); await tick(); await tick();
  option = [...dom.window.document.querySelectorAll('.option-choice-btn')].find(button => button.textContent.includes('Square'));
  option.click(); await tick(); await tick();
  const savedAnswers = calls.filter(call => call.path === '/api/student/practice/answer');
  assert.deepEqual(savedAnswers.at(-1).body.value, ['a', 'b']);
  dom.window.close();
});
