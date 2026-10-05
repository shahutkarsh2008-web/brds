import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score } from '../src/exams.js';

test('CEED 2021-2026 fixture validation, scoring, Part B preservation, and image verification', async () => {
  const years = [2021, 2022, 2023, 2024, 2025, 2026];

  for (const year of years) {
    const rawText = await readFile(new URL(`../fixtures/ceed-${year}.json`, import.meta.url), 'utf8');
    const rawData = JSON.parse(rawText);
    const exam = validateExam(rawData);

    if (year <= 2023) {
      assert.equal(exam.questions.length, 41);
      assert.equal(exam.maxMarks, 100);
    } else {
      assert.equal(exam.questions.length, 44);
      assert.equal(exam.maxMarks, 150);
    }

    // Verify Part B questions preserved
    assert.ok(Array.isArray(rawData.partBQuestions));
    assert.equal(rawData.partBQuestions.length, 5);
    for (const pb of rawData.partBQuestions) {
      assert.equal(pb.type, 'DRAWING_DESIGN');
      assert.equal(pb.marks, 20);
      assert.ok(typeof pb.prompt === 'string' && pb.prompt.length > 0);
    }

    // Verify perfect score calculation
    const answers = Object.fromEntries(
      exam.questions.map(q => {
        let val;
        if (q.type === 'NAT') {
          val = String(q.answer.min);
        } else if (q.type === 'MSQ') {
          val = q.answer;
        } else {
          val = q.answer;
        }
        return [q.id, { value: val }];
      })
    );

    const scored = score(exam, answers);
    assert.equal(scored.score, exam.maxMarks);

    // Verify images exist on disk
    const imgQuestions = exam.questions.filter(q => q.image);
    assert.ok(imgQuestions.length >= 30, `Expected at least 30 images in CEED ${year}`);
    for (const q of imgQuestions) {
      await access(new URL('../public' + q.image, import.meta.url));
    }
  }

  // Specific check for CEED 2023 Q31 and Q34 fallback prompts
  const ceed2023 = JSON.parse(await readFile(new URL('../fixtures/ceed-2023.json', import.meta.url), 'utf8'));
  const q31 = ceed2023.questions.find(q => q.originalQuestionId === 'T31-01' || q.id === 'ceed-2023-q31');
  const q34 = ceed2023.questions.find(q => q.originalQuestionId === 'T34-01' || q.id === 'ceed-2023-q34');
  assert.ok(q31.prompt.includes('Portrait pattern matching'));
  assert.ok(q34.prompt.includes('Shape-grid patterns'));
});
