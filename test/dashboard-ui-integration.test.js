import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('dashboard parses, Library shows honest metadata, and filtered Practice create opens fetched MSQ content', async () => {
  const calls = [];
  let analyticsPayload = null;
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/dashboard', runScripts: 'outside-only', virtualConsole: new VirtualConsole()
  });
  const question = { id: 'q1', examId: 'library-paper', examTitle: 'Library Paper', sectionId: 'part-a', topic: 'Spatial Reasoning', type: 'MSQ', prompt: 'Which shapes are rotated?', options: [{ id: 'a', text: 'Triangle' }, { id: 'b', text: 'Square' }], marks: { correct: 3, incorrect: -1, unanswered: 0 } };
  dom.window.fetch = async (url, options = {}) => {
    const path = String(url);
    calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
    let payload = {};
    if (path === '/api/student/dashboard') payload = analyticsPayload || { user: { name: 'Test Student', targetExam: 'UCEED 2026' }, sparks: 0, kpis: { questionsAnswered: 0, completedAttempts: 0 }, calendar: [], attempts: [], topics: [], nextBestAction: { title: 'Start', reason: 'Try a paper.' } };
    else if (path === '/api/student/analytics') payload = analyticsPayload || { sample: { completedAttempts: 0, reliableTrends: false, topicThreshold: 10 }, kpis: { completedAttempts: 0 }, attempts: [], topics: [], marksLeaks: [], questionStrategy: [], riskMap: [], trend: [], calendar: [], nextBestAction: { title: 'Complete practice', reason: 'Need more attempts.' } };
    else if (path === '/api/exams') payload = { exams: [
      { id: 'library-paper', title: 'Library Paper', totalQuestions: null, maxMarks: null, durationSeconds: null, hasImages: false, status: 'available' },
      { id: 'active-paper', title: 'Active Mock', totalQuestions: 2, maxMarks: 6, durationSeconds: 600, hasImages: false, status: 'active', attemptId: 'attempt-active' },
      { id: 'completed-paper', title: 'Completed Mock', totalQuestions: 2, maxMarks: 6, durationSeconds: 600, hasImages: true, status: 'submitted', attemptId: 'attempt-completed' }
    ] };
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
  assert.doesNotMatch(libraryText, /57 Questions|200 Marks/);
  assert.equal((libraryText.match(/Diagrams Included/g) || []).length, 1, 'only the paper with image metadata should show the diagram indicator');

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

  [...dom.window.document.querySelectorAll('.nav-icon-btn')][4].click();
  await tick(); await tick();
  const mocksText = dom.window.document.querySelector('#app').textContent;
  assert.match(mocksText, /Active Mock/);
  assert.match(mocksText, /Completed Mock/);
  assert.match(mocksText, /Resume Mock/);
  assert.match(mocksText, /View Scorecard/);

  analyticsPayload = {
    sample: { completedAttempts: 1, reliableTrends: false, topicThreshold: 10 },
    kpis: { completedAttempts: 1, questionsAnswered: 1, accuracyPct: 100, averageTimeSeconds: 15, marks: 3, skipped: 1, negativeMarks: 0 },
    attempts: [{ attemptId: 'a1', examId: 'uceed-2026-mini', title: 'UCEED 2026 Mini Mock', status: 'submitted', submittedAt: Date.now(), score: 3, maxMarks: 6, percentage: 50, answeredCount: 1, correct: 1, incorrect: 0, partial: 0, skipped: 1, negativeMarks: 0, timeTakenSeconds: 15, questions: [
      { questionId: 'q1', type: 'MSQ', topic: 'Spatial Reasoning', outcome: 'correct', marks: 3, maxMarks: 3 },
      { questionId: 'q2', type: 'MSQ', topic: 'Spatial Reasoning', outcome: 'unanswered', marks: 0, maxMarks: 3 }
    ] }],
    topics: [], marksLeaks: [], questionStrategy: [], riskMap: [], trend: [], calendar: [{ date: new Date().toISOString().slice(0, 10), questions: 1 }],
    nextBestAction: { title: 'Build a reliable topic sample', reason: 'More questions needed.' }
  };
  nav[1].click(); await tick(); await tick();
  let analyticsText = documentText(dom.window);
  assert.match(analyticsText, /Baseline analytics loaded from 1 completed attempt/);
  assert.doesNotMatch(analyticsText, /null%/);
  assert.match(analyticsText, /No reliable strengths yet/);
  assert.match(analyticsText, /1 unanswered question/);

  const examFilterSelect = [...dom.window.document.querySelectorAll('.analytics-container select')].at(-1);
  examFilterSelect.value = 'uceed-2025';
  examFilterSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await tick(); await tick();
  analyticsText = documentText(dom.window);
  assert.match(analyticsText, /No Completed Exam Attempts Found/);
  examFilterSelect.value = 'all';
  examFilterSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await tick(); await tick();

  analyticsPayload = {
    ...analyticsPayload,
    sample: { completedAttempts: 3, reliableTrends: true, topicThreshold: 10 },
    attempts: [1, 2, 3].map(index => ({ ...analyticsPayload.attempts[0], attemptId: `a${index}`, title: `UCEED 2026 Mini Mock ${index}`, submittedAt: Date.now() - index * 86400000 })),
    trend: [1, 2, 3].map(index => ({ attemptId: `a${index}`, score: index * 3, maxMarks: 6, percentage: index * 10, submittedAt: Date.now() - index * 86400000 }))
  };
  const refresh = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Refresh Analytics'));
  refresh.click(); await tick(); await tick();
  analyticsText = documentText(dom.window);
  assert.doesNotMatch(analyticsText, /Complete 3 full-length mocks/);
  assert.match(analyticsText, /3 mock\(s\) completed/);
  assert.match(analyticsText, /-9\.0 Marks Total Leak/);
  dom.window.close();
});

function documentText(dom) { return dom.window.document.querySelector('#app').textContent; }
