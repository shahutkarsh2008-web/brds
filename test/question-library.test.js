import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { importExam } from '../src/exams.js';
import { createPracticeEngine } from '../src/practice.js';
import { categoriseExam, matchesTopic } from '../src/question-topics.js';

async function fixture(t) {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);
  t.after(() => db.close());
  const user = await createUser(db, { loginId: 'topic_student', name: 'Topic Student', role: 'student', password: 'Password12345!', phone: '919876543210' });
  const engine = createPracticeEngine(db);
  return { db, user, engine };
}
const paper = (year, answer, prompt = 'How many surfaces are in this solid?') => ({
  id: `uceed-${year}`, title: `UCEED ${year}`, durationSeconds: 600, totalQuestions: 1, maxMarks: 4,
  sections: [{ id: 'nat', title: 'NAT' }],
  questions: [{ id: 'q01', sectionId: 'nat', type: 'NAT', prompt, answer: { min: answer, max: answer }, marks: { correct: 4, incorrect: 0, unanswered: 0 } }]
});

test('same question IDs from different years retain their own source, answer, bookmark and revision after reload', async t => {
  const { db, user, engine } = await fixture(t);
  await importExam(db, paper(2027, 7), []);
  await importExam(db, paper(2028, 8), []);
  assert.equal((await engine.countMatching()).count, 2);
  const set = await engine.createSet(user.id, { setSize: 10, skipDone: false });
  assert.deepEqual(set.questionIds, ['uceed-2027::q01', 'uceed-2028::q01']);
  const reopened = await createPracticeEngine(db).getSet(user.id, set.id);
  assert.deepEqual(reopened.questions.map(q => q.examId), ['uceed-2027', 'uceed-2028']);
  assert.ok(reopened.questions.every(q => !('answer' in q)));
  await engine.saveAnswer(user.id, set.id, set.questionIds[0], 7);
  await engine.saveAnswer(user.id, set.id, set.questionIds[1], 7);
  const results = await db.query('SELECT exam_id,outcome FROM practice_outcomes ORDER BY exam_id');
  assert.deepEqual(results.rows.map(r => [r.exam_id, r.outcome]), [['uceed-2027', 'correct'], ['uceed-2028', 'incorrect']]);
  const revision = await engine.listRevision(user.id);
  assert.equal(revision[0].id, 'uceed-2028::q01');
  await engine.setBookmark(user.id, 'uceed-2028', set.questionIds[1], true);
  assert.equal((await engine.listBookmarks(user.id))[0].examId, 'uceed-2028');
  assert.equal((await engine.createSet(user.id, { skipDone: true })).totalQuestions, 0);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM attempts')).rows[0].n), 0);
});

test('new imports join topic practice automatically, exact copies deduplicate without removing their mocks', async t => {
  const { db, user, engine } = await fixture(t);
  const first = paper(2027, 4, 'How many surfaces are there in this model?');
  const second = { ...first, id: 'mini-2027' };
  await importExam(db, first, []);
  const saved = await engine.createSet(user.id, { skipDone: false });
  assert.deepEqual(saved.questionIds, ['q01']);
  await importExam(db, second, []);
  assert.equal((await engine.getSet(user.id, saved.id)).questions[0].examId, 'uceed-2027', 'source remains pinned after another import');
  assert.equal((await engine.countMatching({ topics: ['Faces, edges and vertices'] })).count, 1);
  assert.equal((await engine.countMatching({ exam: 'uceed-2027' })).count, 1);
  assert.equal((await engine.countMatching({ exam: 'mini-2027' })).count, 1);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM exams')).rows[0].n), 2);
  assert.equal((await engine.countMatching({ difficulty: 'Hard' })).count, 0, 'unknown difficulty must not match every difficulty');
  const catalog = await engine.topicCatalog();
  assert.equal(catalog.totalQuestions, 1);
  assert.equal(catalog.categories[0].topics[0].count, 1);
});

test('reviewed UCEED 2026 questions have real topics; topic search does not match incidental words', async () => {
  const raw = JSON.parse(await readFile(new URL('../fixtures/uceed-2026.json', import.meta.url)));
  const exam = categoriseExam(raw);
  assert.equal(exam.questions.length, 57);
  assert.ok(exam.questions.every(q => q.classification === 'reviewed-content'));
  assert.equal(exam.questions[0].topic, 'Pattern Counting');
  assert.equal(exam.questions[18].topic, 'Everyday objects and mechanisms');
  assert.equal(exam.questions[54].topic, 'Traditional crafts and objects');
  assert.equal(matchesTopic(exam.questions[0], 'Paper Folding & Unfolding'), false);
  assert.equal(matchesTopic(exam.questions[18], 'Mechanical Reasoning'), true);
  assert.deepEqual(exam.questions.map(q => q.answer), raw.questions.map(q => q.answer));
  const unknown = categoriseExam(paper(2029, 3, 'Which option is correct?'));
  assert.equal(unknown.questions[0].classification, 'needs-review');
  assert.equal(matchesTopic(unknown.questions[0], 'Spatial Assembly'), false);
});

test('ambiguous legacy sets fail explicitly instead of opening or grading another paper', async t => {
  const { db, user, engine } = await fixture(t);
  await importExam(db, paper(2027, 7), []);
  await importExam(db, paper(2028, 8), []);
  const set = await engine.createSet(user.id);
  await db.query('UPDATE practice_sets SET filters_json=$1,question_ids_json=$2 WHERE id=$3', ['{}', '["q01"]', set.id]);
  await assert.rejects(engine.getSet(user.id, set.id), /ambiguous question sources/);
  await assert.rejects(engine.saveAnswer(user.id, set.id, 'q01', 7), /ambiguous question sources/);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM practice_answers')).rows[0].n), 0);
});

test('two worksheet questions on the same page remain distinct while copied editions deduplicate', async t => {
  const { db, engine } = await fixture(t);
  const exam = paper(2030, 4, 'T1-06 — use the worksheet diagram on this page and select/enter the answer.');
  exam.questions[0].image = '/media/worksheet-page.png';
  exam.questions[0].imageAlt = 'Worksheet page with two questions';
  exam.questions.push({ ...exam.questions[0], id: 'q02', prompt: 'T1-07 — use the worksheet diagram on this page and select/enter the answer.' });
  exam.totalQuestions = 2; exam.maxMarks = 8;
  await importExam(db, exam, []);
  const copy = structuredClone(exam); copy.id = 'worksheet-copy';
  copy.questions[0].prompt = 'T1-06 — see diagram on worksheet page 5 and choose the correct option.';
  await importExam(db, copy, []);
  assert.equal((await engine.countMatching()).count, 2);
});
