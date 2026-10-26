import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

test('Spatial and Visual Test 02 validation, media files and scoring', async () => {
  const raw = JSON.parse(await readFile(new URL('../fixtures/spatial-visual-test-02.json', import.meta.url), 'utf8'));
  const exam = validateExam(raw);

  assert.equal(exam.id, 'spatial-visual-test-02');
  assert.equal(exam.title, 'Spatial and Visual Test 02');
  assert.equal(exam.totalQuestions, 40);
  assert.equal(exam.questions.length, 40);
  assert.equal(exam.maxMarks, 128);
  assert.equal(exam.durationSeconds, 3600);

  const mcqs = exam.questions.filter(q => q.type === 'MCQ');
  const msqs = exam.questions.filter(q => q.type === 'MSQ');
  const nats = exam.questions.filter(q => q.type === 'NAT');

  assert.equal(mcqs.length, 32);
  assert.equal(msqs.length, 2);
  assert.equal(nats.length, 6);

  // All 40 questions must have valid images accessible in public/media
  for (const q of exam.questions) {
    assert.ok(q.image, `Question ${q.id} missing image`);
    await access(new URL('../public' + q.image, import.meta.url));
  }

  // All-correct scoring yields exactly maxMarks (128)
  const allCorrect = Object.fromEntries(
    exam.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );

  const result = score(exam, allCorrect);
  assert.equal(result.score, 128);
});
