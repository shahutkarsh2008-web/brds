import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { validateExam, score, createExamEngine } from '../src/exams.js';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { seedExams } from '../scripts/seed-exams.js';

const raw = JSON.parse(await readFile(new URL('../fixtures/uceed-2026.json', import.meta.url), 'utf8'));
const exam = validateExam(raw);
const marked = (id, value) => score(exam, {[id]:{value}}).score;

test('UCEED final key, 57 questions, 200 marks and all diagram assets', async () => {
  assert.equal(exam.questions.length,57);
  assert.equal(exam.durationSeconds,7200);
  assert.ok(exam.sections.every(s=>s.durationSeconds===undefined));
  assert.deepEqual(exam.questions.slice(29).map(q=>q.answer), 'A B C B D A C B B D C C C D B C B C C C B B A D B D B A'.toLowerCase().split(' '));
  const answers=Object.fromEntries(exam.questions.map(q=>[q.id,{value:q.type==='NAT'?String(q.answer.min):q.answer}]));
  assert.equal(score(exam,answers).score,200);
  assert.equal(score(exam,{}).score,0);
  const diagrams=exam.questions.filter(q=>q.image);
  assert.equal(diagrams.length,47);
  for(const q of diagrams) await access(new URL('../public'+q.image,import.meta.url));
  assert.equal(exam.questions[15].options[1].text,'2 cut-outs of Q, 1 cut-out of R, 2 cut-outs of S, 2 cut-outs of T');
  assert.equal(exam.questions[15].options[3].text,'2 cut-outs of Q, 2 cut-outs of R, 2 cut-outs of S, 2 cut-outs of T');
});
test('UCEED MSQ proper subsets, wrong selections, alternatives and NAT inclusive limits',()=>{
  for(const [value,marks] of [[[],0],[['a'],1],[['a','b'],2],[['a','b','c'],3],[['d','c','b','a'],4]]) assert.equal(marked('q21',value),marks);
  assert.equal(marked('q15',['a','d']),-1);
  assert.equal(marked('q18',['b','c']),4);
  assert.equal(marked('q18',['b','c','d']),4);
  assert.equal(marked('q18',['b','d']),2);
  assert.equal(marked('q18',['a','b','c','d']),-1);
  for(const value of ['470','475','480']) assert.equal(marked('q14',value),4);
  for(const value of ['469.99','480.01','']) assert.equal(marked('q14',value),0);
  assert.equal(marked('q30','b'),-.71);
  const legacy=structuredClone(exam); delete legacy.questions[20].partialCredit;
  assert.equal(score(legacy,{q21:{value:['a']}}).score,-1);
  assert.equal(score(exam,{q21:{value:['a']}}).sections[1].partial,1);
});
test('marking configuration survives validation and invalid configurations fail',()=>{
  assert.deepEqual(validateExam(exam),exam);
  for(const mutate of [
    e=>e.questions[0].partialCredit={'1':1},
    e=>e.questions[14].answerAlternatives=[['z']],
    e=>e.questions[14].answerAlternatives=[['a','a']],
    e=>e.questions[14].partialCredit={'1':4},
    e=>e.questions[14].partialCredit={'0':1},
    e=>e.questions[14].partialCredit={'1':-1},
  ]) {const value=structuredClone(raw); mutate(value); assert.throws(()=>validateExam(value));}
});
test('startup seeds library without assignments, preserves keys and is idempotent; student view hides all keys',async t=>{
  const db=await openDatabase({SQLITE_PATH:':memory:'}); await migrate(db); t.after(()=>db.close());
  assert.equal(await seedExams(db),3);
  assert.equal(await seedExams(db),0);
  assert.equal((await db.query('SELECT * FROM exam_assignments')).rowCount,0);
  const stored=JSON.parse((await db.query('SELECT definition FROM exams WHERE id=$1',[exam.id])).rows[0].definition);
  assert.deepEqual(stored.questions[17].answerAlternatives,[['b','c','d']]);
  const user=await createUser(db,{loginId:'uceed-fixture',name:'Fixture',role:'student',phone:'919999999999',password:'Test-password-123!'});
  const engine=createExamEngine(db);
  await assert.rejects(engine.start(exam.id,user.id));
  await engine.assignExam(exam.id,[user.id]);
  const view=await engine.start(exam.id,user.id);
  assert.ok(view.exam.questions.every(q=>!('answer' in q)&&!('answerAlternatives' in q)));
});

test('question outcomes match totals and reviews appear only after submission, including older results',async t=>{
  const db=await openDatabase({SQLITE_PATH:':memory:'});await migrate(db);t.after(()=>db.close());
  const user=await createUser(db,{loginId:'review-student',name:'Review Student',role:'student',phone:'919999999999',password:'Test-password-123!'});
  const engine=createExamEngine(db);
  await engine.saveExam(raw);await engine.assignExam(raw.id,[user.id]);
  let view=await engine.start(raw.id,user.id);
  assert.equal(view.result,null);
  const responses={q01:'14',q15:['a'],q30:'b'};
  for(const [questionId,value] of Object.entries(responses))view=await engine.answer(view.id,user.id,{questionId,value,expectedVersion:view.version,mutationId:'review-'+questionId,review:false});
  view=await engine.submit(view.id,user.id,view.version);
  assert.equal(view.result.questions.length,57);
  assert.equal(Number(view.result.questions.reduce((n,q)=>n+q.marks,0).toFixed(6)),view.result.score);
  assert.deepEqual(view.result.questions.slice(0,2).map(q=>q.outcome),['correct','unanswered']);
  assert.equal(view.result.questions[14].outcome,'partial');
  assert.equal(view.result.questions[29].outcome,'incorrect');
  assert.deepEqual(view.result.questions[17].answerAlternatives,[['b','c','d']]);
  const legacy={...view.result};delete legacy.questions;
  await db.query('UPDATE attempts SET result_json=$1 WHERE id=$2',[JSON.stringify(legacy),view.id]);
  const old=await engine.get(view.id,user.id);
  assert.equal(old.result.questions.length,57);
  assert.equal(old.result.score,legacy.score);
});

