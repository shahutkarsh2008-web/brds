import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

const raw = JSON.parse(await readFile(new URL('../fixtures/uceed-2016.json', import.meta.url), 'utf8'));

test('UCEED 2016 keys, diagrams, 80 questions, and scoring', async () => {
  const exam = validateExam(raw);
  assert.equal(exam.questions.length, 80);
  assert.equal(exam.maxMarks, 300);
  assert.deepEqual(exam.questions.find(q => q.id === 'q51').options.map(o => o.id), ['a', 'b', 'c', 'd']);

  // Generate perfect score answers dictionary
  const answers = Object.fromEntries(
    exam.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );

  assert.equal(score(exam, answers).score, 300);

  const mark = (id, value) => score(exam, { [id]: { value } }).score;

  // Test NAT scoring (+4 / -1)
  assert.equal(mark('q01', String(raw.questions[0].answer.min)), 4);
  assert.equal(mark('q01', '999'), -1);
  for (const accepted of ['0.26', '0.27', '26', '27']) assert.equal(mark('q06', accepted), 4);
  assert.equal(mark('q06', '1'), -1);

  // Test MSQ scoring (+5 / -0.5, no partial credit)
  assert.equal(mark('q21', raw.questions[20].answer), 5);
  assert.equal(mark('q21', ['b']), -0.5);

  // Test MCQ scoring (+3 / -1)
  assert.equal(mark('q41', raw.questions[40].answer), 3);

  // Verify images exist on disk
  const imgQuestions = exam.questions.filter(q => q.image);
  assert.ok(imgQuestions.length >= 40);
  for (const q of imgQuestions) {
    await access(new URL('../public' + q.image, import.meta.url));
  }
});
