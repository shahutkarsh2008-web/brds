import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

const raw = JSON.parse(await readFile(new URL('../fixtures/uceed-2021.json', import.meta.url), 'utf8'));

test('UCEED 2021 keys, diagrams, 68 questions, and scoring', async () => {
  const exam = validateExam(raw);
  assert.equal(exam.questions.length, 68);
  assert.equal(exam.maxMarks, 240);

  // Generate perfect score answers dictionary
  const answers = Object.fromEntries(
    exam.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );

  assert.equal(score(exam, answers).score, 240);

  const mark = (id, value) => score(exam, { [id]: { value } }).score;

  // Test NAT boundary scoring
  assert.equal(mark('q01', '4900'), 4);
  assert.equal(mark('q14', '15.00'), 4);
  assert.equal(mark('q14', '16.50'), 4);
  assert.equal(mark('q14', '16.51'), 0);
  assert.equal(mark('q15', '24'), 4);
  assert.equal(mark('q15', '49'), 4);
  assert.equal(mark('q15', '30'), 0);

  // Test MSQ scoring: the official 2021 scheme has no partial credit.
  assert.equal(mark('q19', ['a', 'd']), 4);
  assert.equal(mark('q19', ['a']), -0.19);
  assert.equal(mark('q19', ['a', 'b']), -0.19);

  // Test MCQ scoring
  assert.equal(mark('q37', 'c'), 3);
  assert.equal(mark('q37', 'a'), -0.71);

  // Verify images exist on disk
  const imgQuestions = exam.questions.filter(q => q.image);
  assert.ok(imgQuestions.length >= 45);
  for (const q of imgQuestions) {
    await access(new URL('../public' + q.image, import.meta.url));
  }
});
