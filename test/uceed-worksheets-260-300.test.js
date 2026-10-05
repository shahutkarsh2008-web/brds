import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

test('UCEED Spatial Worksheet 260 and Quantitative 300 validation, scoring, and media verification', async () => {
  // Test 260
  const raw260 = JSON.parse(await readFile(new URL('../fixtures/uceed-spatial-worksheet-260-revised.json', import.meta.url), 'utf8'));
  const exam260 = validateExam(raw260);
  assert.equal(exam260.questions.length, 260);

  const img260 = exam260.questions.filter(q => q.image);
  assert.ok(img260.length >= 200, 'Expected at least 200 images in Spatial Worksheet 260');
  for (const q of img260) {
    await access(new URL('../public' + q.image, import.meta.url));
  }

  // Test 300
  const raw300 = JSON.parse(await readFile(new URL('../fixtures/uceed-spatial-quantitative-worksheet-300-revised.json', import.meta.url), 'utf8'));
  const exam300 = validateExam(raw300);
  assert.equal(exam300.questions.length, 300);

  const img300 = exam300.questions.filter(q => q.image);
  assert.ok(img300.length >= 90, 'Expected at least 90 images in Quantitative Worksheet 300');
  for (const q of img300) {
    await access(new URL('../public' + q.image, import.meta.url));
  }

  // Verify scoring sample
  const sampleAnswers260 = Object.fromEntries(
    exam260.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );
  assert.equal(score(exam260, sampleAnswers260).score, exam260.maxMarks);

  const sampleAnswers300 = Object.fromEntries(
    exam300.questions.map(q => [
      q.id,
      { value: q.type === 'NAT' ? String(q.answer.min) : q.answer }
    ])
  );
  assert.equal(score(exam300, sampleAnswers300).score, exam300.maxMarks);
});
