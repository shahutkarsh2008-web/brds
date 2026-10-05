import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

const raw = JSON.parse(await readFile(new URL('../fixtures/uceed-2019.json', import.meta.url), 'utf8'));

test('UCEED 2019 keys, diagrams, 85 questions, and scoring', async () => {
  const exam = validateExam(raw);
  assert.equal(exam.questions.length, 85);
  assert.equal(exam.maxMarks, 300);
  for (const question of exam.questions.filter(q => q.type === 'MCQ')) {
    assert.equal(typeof question.answer, 'string', `${question.id} MCQ answer should be a choice ID`);
  }

  // Generate perfect score answers dictionary
  const answers = Object.fromEntries(
    exam.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );

  assert.equal(score(exam, answers).score, 300);

  const mark = (id, value) => score(exam, { [id]: { value } }).score;

  // Test NAT scoring
  assert.equal(mark('q01', String(raw.questions[0].answer.min)), 3);

  // Imported fixture and marking table configure 2019 MSQ as 3 marks, no partial credit.
  assert.equal(mark('q21', raw.questions[20].answer), 3);
  assert.equal(mark('q21', [raw.questions[20].answer[0]]), -0.19);

  // Test MCQ scoring
  assert.equal(mark('q46', raw.questions[45].answer), 4);

  // Verify images exist on disk
  const imgQuestions = exam.questions.filter(q => q.image);
  assert.ok(imgQuestions.length >= 60);
  for (const q of imgQuestions) {
    await access(new URL('../public' + q.image, import.meta.url));
  }
});
