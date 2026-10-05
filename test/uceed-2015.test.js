import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

const raw = JSON.parse(await readFile(new URL('../fixtures/uceed-2015.json', import.meta.url), 'utf8'));

test('UCEED 2015 keys, diagrams, 100 questions, and scoring', async () => {
  const exam = validateExam(raw);
  assert.equal(exam.questions.length, 100);
  assert.equal(exam.maxMarks, 300);
  assert.deepEqual(exam.questions.find(q => q.id === 'q37').options.map(o => o.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(exam.questions.find(q => q.id === 'q40').options.map(o => o.id), ['a', 'b', 'c', 'd']);

  // Generate perfect score answers dictionary
  const answers = Object.fromEntries(
    exam.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );

  assert.equal(score(exam, answers).score, 300);

  const mark = (id, value) => score(exam, { [id]: { value } }).score;

  // Test NAT scoring (+3 / -1)
  assert.equal(mark('q01', String(raw.questions[0].answer.min)), 3);
  assert.equal(mark('q01', '999'), -1);

  // Test MSQ scoring (+3 / 0, no partial credit)
  assert.equal(mark('q21', raw.questions[20].answer), 3);
  assert.equal(mark('q21', ['a']), 0);

  // Test MCQ scoring (+3 / -1)
  assert.equal(mark('q51', raw.questions[50].answer), 3);

  // Verify images exist on disk
  const imgQuestions = exam.questions.filter(q => q.image);
  assert.ok(imgQuestions.length >= 60);
  for (const q of imgQuestions) {
    await access(new URL('../public' + q.image, import.meta.url));
  }
});
