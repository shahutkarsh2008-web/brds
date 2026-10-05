import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { validateExam, score, importExam, createExamEngine } from '../src/exams.js';

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
  // Official key accepts every option for dropped Q67 and either B or C for Q78.
  for (const option of ['a', 'b', 'c', 'd']) assert.equal(mark('q67', option), 3);
  assert.equal(mark('q78', 'b'), 3);
  assert.equal(mark('q78', 'c'), 3);
  assert.equal(mark('q78', 'a'), -1);

  // Verify images exist on disk
  const imgQuestions = exam.questions.filter(q => q.image);
  assert.ok(imgQuestions.length >= 60);
  for (const q of imgQuestions) {
    await access(new URL('../public' + q.image, import.meta.url));
  }
});

test('all 100 UCEED 2015 fixture keys match the official final key', () => {
  const expectedNat = '22,8,37,14,9,286,7,70,7,7,15,35,7,4,2823,3,5,18,158,2'.split(',');
  const expectedMsq = 'abd,abc,ad,bcd,acd,bc,abc,ab,cd,d,abd,abd,ab,abcd,bd,abd,bc,ad,ac,abd,ac,ac,abc,cd,bd,d,bd,bd,c,b'.split(',');
  const expectedMcq = 'd,b,d,c,b,d,d,a,a,c,c,b,b,b,c,a,abcd,d,d,d,c,b,d,c,d,b,b,bc,a,c,d,a,a,c,a,b,c,b,d,c,b,d,a,a,a,a,a,b,c,b'.split(',');
  for (const [index, question] of raw.questions.entries()) {
    if (question.type === 'NAT') assert.equal(String(question.answer.min), expectedNat[index], question.id);
    else if (question.type === 'MSQ') {
      const keys = [question.answer, ...(question.answerAlternatives || [])].map(key => [...key].sort().join(''));
      assert.deepEqual(keys, [expectedMsq[index - 20]], question.id);
    } else {
      const keys = [question.answer, ...(question.answerAlternatives || [])].sort().join('');
      assert.equal(keys, expectedMcq[index - 50], question.id);
    }
  }
});

test('official UCEED 2015 alternative MCQ keys survive import and remain private during an attempt', async () => {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  try {
    await migrate(db);
    const student = await createUser(db, { loginId: 'uceed-alt-key', name: 'UCEED Key Test', role: 'student', phone: '919999999991', password: 'Test-password-123!' });
    await importExam(db, raw, [student.id]);
    const engine = createExamEngine(db);
    const attempt = await engine.start(raw.id, student.id);
    for (const id of ['q67', 'q78']) {
      const question = attempt.exam.questions.find(item => item.id === id);
      assert.ok(question);
      assert.equal(Object.hasOwn(question, 'answer'), false);
      assert.equal(Object.hasOwn(question, 'answerAlternatives'), false);
    }
    const q67 = await engine.answer(attempt.id, student.id, { questionId: 'q67', value: 'd', expectedVersion: 0, mutationId: 'uceed-q67-alt', review: false });
    const q78 = await engine.answer(attempt.id, student.id, { questionId: 'q78', value: 'c', expectedVersion: q67.version, mutationId: 'uceed-q78-alt', review: false });
    const submitted = await engine.submit(attempt.id, student.id, q78.version);
    assert.equal(submitted.result.score, 6);
    assert.equal(submitted.result.questions.find(item => item.id === 'q67').outcome, 'correct');
    assert.equal(submitted.result.questions.find(item => item.id === 'q78').outcome, 'correct');
  } finally {
    await db.close();
  }
});
