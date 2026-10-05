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
  // The official key accepts either A or B for Q79.
  assert.equal(mark('q79', 'a'), 3);
  assert.equal(mark('q79', 'b'), 3);
  assert.equal(mark('q79', 'c'), -1);

  // Verify images exist on disk
  const imgQuestions = exam.questions.filter(q => q.image);
  assert.ok(imgQuestions.length >= 40);
  for (const q of imgQuestions) {
    await access(new URL('../public' + q.image, import.meta.url));
  }
});

test('all 80 UCEED 2016 fixture keys match the official final key', () => {
  const expectedNat = ['19','26','8','11','50','0.26,0.27,26,27','12','85','65-66','12','99','12','1068','21-22','33','26','810000','10','451','0.82'];
  const expectedMsq = 'bc,ad,ad,bd,abd,abcd,c,abd,bc,ac,abc,bc,ad,d,acd,abcd,c,d,abc,abd'.split(',');
  const expectedMcq = 'b,d,c,c,d,a,c,a,a,a,c,d,d,b,c,d,c,b,c,a,b,a,c,a,b,b,d,c,a,c,b,d,c,b,d,b,d,a,ab,b'.split(',');
  for (const [index, question] of raw.questions.entries()) {
    if (question.type === 'NAT') {
      const answer = question.answer.values ? question.answer.values.join(',') : question.answer.min === question.answer.max ? String(question.answer.min) : `${question.answer.min}-${question.answer.max}`;
      assert.equal(answer, expectedNat[index], question.id);
    } else if (question.type === 'MSQ') {
      const keys = [question.answer, ...(question.answerAlternatives || [])].map(key => [...key].sort().join(''));
      assert.deepEqual(keys, [expectedMsq[index - 20]], question.id);
    } else {
      const keys = [question.answer, ...(question.answerAlternatives || [])].sort().join('');
      assert.equal(keys, expectedMcq[index - 40], question.id);
    }
  }
});
