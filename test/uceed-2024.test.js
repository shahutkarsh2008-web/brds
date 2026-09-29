import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {validateExam,score} from '../src/exams.js';
const raw=JSON.parse(await readFile(new URL('../fixtures/uceed-2024.json',import.meta.url),'utf8'));
test('UCEED 2024 keys, diagrams and exact NAT alternatives',async()=>{
 const exam=validateExam(raw);
 assert.equal(exam.questions.length,57);
 const answers=Object.fromEntries(exam.questions.map(q=>[q.id,{value:q.type==='NAT'?String(q.answer.min):q.answer}]));
 assert.equal(score(exam,answers).score,200);
 const mark=(id,value)=>score(exam,{[id]:{value}}).score;
 assert.equal(mark('q14','12'),4);assert.equal(mark('q14','13'),4);
 assert.equal(mark('q14','12.5'),0);assert.equal(mark('q14',''),0);
 for(const [id,lo,hi] of [['q08',615,645],['q09',5,5.35],['q12',32.5,34.5]]){
  assert.equal(mark(id,String(lo)),4);assert.equal(mark(id,String(hi)),4);assert.equal(mark(id,String(hi+.01)),0);
 }
 assert.equal(mark('q20',['a','b']),2);assert.equal(mark('q20',['a','d']),-1);
 assert.equal(mark('q22',['a']),4);assert.equal(mark('q30','a'),-.71);
 assert.equal(exam.questions.filter(q=>q.image).length,53);
 for(const q of exam.questions.filter(q=>q.image))await access(new URL('../public'+q.image,import.meta.url));
 for(const values of [[],[12,12],[12,14],['12'],[NaN]]){
  const value=structuredClone(raw);value.questions[13].answer.values=values;assert.throws(()=>validateExam(value));
 }
});
