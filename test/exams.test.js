import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {openDatabase} from '../src/database.js';
import {migrate} from '../src/schema.js';
import {createUser,digest} from '../src/auth.js';
import {validateExam,importExam,createExamEngine} from '../src/exams.js';
import {createApp} from '../src/app.js';

const source=JSON.parse(await readFile(new URL('../fixtures/design-foundations.json',import.meta.url),'utf8'));
const timedSource=JSON.parse(await readFile(new URL('../fixtures/timed-sections.json',import.meta.url),'utf8'));
async function fixture(t,{students=2,timed=false}={}){
  const db=await openDatabase({SQLITE_PATH:':memory:'});await migrate(db);
  let time=Date.now();const users={},cookies={};
  for(const login of ['teacher',...Array.from({length:students},(_,i)=>'student'+(i+1))]){
    const role=login==='teacher'?'teacher':'student';
    users[login]=await createUser(db,{loginId:login,name:login,role,phone:'919999999999',password:'Test-password-123!'});
    const token=randomBytes(32).toString('hex');cookies[login]='brds_session='+token;
    await db.query('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)',[digest(token),users[login].id,time,time+86400000]);
  }
  const definition=structuredClone(timed?timedSource:source);
  await importExam(db,definition,Object.values(users).filter(u=>u.role==='student').map(u=>u.id));
  const app=createApp(db,{env:{},now:()=>time,otp:{send:async()=>{throw new Error('not used');}}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>app.close());
  const base='http://127.0.0.1:'+app.server.address().port;
  async function api(path,body,login='student1'){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookies[login]||''},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return{status:response.status,body:await response.json()};
  }
  async function start(login='student1'){const r=await api('/api/exams/'+definition.id+'/start',{},login);assert.equal(r.status,200);return r.body;}
  async function socket(login){
    const ws=new WebSocket(base.replace('http:','ws:')+'/session-ws',{origin:base,headers:{Cookie:cookies[login]}});
    const messages=[];ws.on('message',data=>{messages.push(JSON.parse(data));});await once(ws,'open');return{ws,messages};
  }
  return{db,app,api,start,socket,users,cookies,definition,advance:ms=>{time+=ms;},now:()=>time};
}
const edit=(q,value,version=0,review=false)=>({questionId:q,value,review,expectedVersion:version,mutationId:randomUUID()});
function nextMessage(ws,predicate,timeout=3000){
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',onMessage);reject(new Error('Expected live message was not received'));},timeout);function onMessage(raw){const data=JSON.parse(raw);if(predicate(data)){clearTimeout(timer);ws.off('message',onMessage);resolve(data);}}ws.on('message',onMessage);});
}
test('exam import requires explicit marks/totals and consistent timed sections',()=>{
  assert.equal(validateExam(source).questions.length,8);
  for(const change of [
    e=>{delete e.questions[0].marks;},e=>{e.maxMarks=999;},
    e=>{e.totalQuestions=7;},e=>{e.questions[0].options[1].id='a';},
    e=>{e.questions[4].answer={min:10,max:1};},e=>{e.sections[0].durationSeconds=10;},
    e=>{e.questions[0].image='https://third-party.invalid/image.png';},
  ]){const value=structuredClone(source);change(value);assert.throws(()=>validateExam(value));}
});
test('only assigned students can start; simultaneous starts share one attempt; keys stay private',async t=>{
  const f=await fixture(t);
  const results=await Promise.all([f.start(),f.start()]);
  assert.equal(results[0].id,results[1].id);
  assert.equal((await f.db.query('SELECT * FROM attempts')).rowCount,1);
  assert.ok(results[0].exam.questions.every(q=>!Object.hasOwn(q,'answer')));
  assert.ok(!(await f.api('/api/exams')).body.exams.some(exam=>Object.hasOwn(exam,'questions')));
  assert.equal((await f.api('/api/exams/'+f.definition.id+'/start',{},'teacher')).status,403);
  await f.db.query('DELETE FROM exam_assignments WHERE user_id=$1',[f.users.student2.id]);
  assert.equal((await f.api('/api/exams/'+f.definition.id+'/start',{},'student2')).status,404);
  assert.equal((await f.api('/api/attempts/'+results[0].id,undefined,'student2')).status,404);
});
test('answer changes, visit and review persist; retries are idempotent; stale writes conflict',async t=>{
  const f=await fixture(t),attempt=await f.start(),path='/api/attempts/'+attempt.id;
  const payload=edit('q1','a',0,true);
  const saved=await f.api(path+'/answers',payload);assert.equal(saved.status,200);
  assert.deepEqual(saved.body.answers.q1,{value:'a',visited:true,review:true});
  const replay=await f.api(path+'/answers',payload);assert.equal(replay.body.version,1);
  assert.equal((await f.api(path+'/answers',edit('q1','b',0))).status,409);
  const clear=await f.api(path+'/answers',edit('q1',null,1,false));assert.equal(clear.status,200);
  assert.deepEqual((await f.api(path)).body.answers.q1,{value:null,visited:true,review:false});
});
test('concurrent edits cannot silently overwrite each other',async t=>{
  const f=await fixture(t),attempt=await f.start(),path='/api/attempts/'+attempt.id;
  const results=await Promise.all([f.api(path+'/answers',edit('q1','a')),f.api(path+'/answers',edit('q1','b'))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.api(path)).body.version,1);
});
test('MCQ MSQ NAT validation and immediate scoring include negative marks and unanswered questions',async t=>{
  const f=await fixture(t),attempt=await f.start(),path='/api/attempts/'+attempt.id;
  for(const payload of [edit('q1','unknown'),edit('q2',['a','a']),edit('q5','Infinity'),edit('q5','1e3'),edit('missing','a')])assert.equal((await f.api(path+'/answers',payload)).status,400);
  let version=0;
  for(const [q,value]of[['q1','a'],['q2',['d','b','a']],['q5','81'],['q3','a']]){
    const r=await f.api(path+'/answers',edit(q,value,version));assert.equal(r.status,200);version=r.body.version;
  }
  const submitted=await f.api(path+'/submit',{expectedVersion:version});
  assert.equal(submitted.status,200);assert.equal(submitted.body.result.score,11);
  assert.deepEqual(submitted.body.result.sections.map(s=>s.score),[7,4]);
  assert.equal(submitted.body.status,'submitted');
  assert.equal((await f.api(path+'/answers',edit('q1','b',version))).body.code,'EXAM_ENDED');
  const replay=await f.api(path+'/submit',{expectedVersion:0});assert.equal(replay.body.submittedAt,submitted.body.submittedAt);
});
test('MSQ partial selections are incorrect and NAT accepted endpoints are inclusive',async t=>{
  const f=await fixture(t),attempt=await f.start(),path='/api/attempts/'+attempt.id;
  assert.equal((await f.api(path+'/answers',edit('q2',['a']))).status,200);
  assert.equal((await f.api(path+'/answers',edit('q6','18.85',1))).status,200);
  const result=(await f.api(path+'/submit',{expectedVersion:2})).body.result;
  assert.equal(result.score,3);assert.equal(result.sections[0].incorrect,1);assert.equal(result.sections[1].correct,1);
});
test('timed sections close server-side and time-up rejects edits and auto-submits',async t=>{
  const f=await fixture(t,{timed:true}),attempt=await f.start(),path='/api/attempts/'+attempt.id;
  assert.equal(attempt.activeSection.id,'visual');
  assert.equal((await f.api(path+'/answers',edit('q5','81'))).body.code,'SECTION_CLOSED');
  f.advance(61000);
  assert.equal((await f.api(path)).body.activeSection.id,'quant');
  assert.equal((await f.api(path+'/answers',edit('q1','a'))).body.code,'SECTION_CLOSED');
  assert.equal((await f.api(path+'/answers',edit('q5','81'))).status,200);
  f.advance(60000);
  const expired=(await f.api(path)).body;assert.equal(expired.status,'submitted');assert.equal(expired.result.score,4);
  assert.equal(expired.result.reason,'time_expired');assert.equal(expired.submittedAt,attempt.deadline);
  assert.equal((await f.api(path+'/answers',edit('q5','82',1))).status,409);
});
test('server deadline worker submits an abandoned attempt without any client request',async t=>{
  const f=await fixture(t,{timed:true}),attempt=await f.start();f.advance(121000);
  await new Promise(resolve=>setTimeout(resolve,650));
  const row=(await f.db.query('SELECT status,result_json FROM attempts WHERE id=$1',[attempt.id])).rows[0];
  assert.equal(row.status,'submitted');assert.equal(JSON.parse(row.result_json).reason,'time_expired');
});
test('saved answers and original deadline survive closing and reopening the database',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'brds-exam-resume-')),path=join(folder,'exam.sqlite');
  let db;
  try{
    db=await openDatabase({SQLITE_PATH:path});await migrate(db);
    const user=await createUser(db,{loginId:'resume-test',name:'Resume Test',role:'student',phone:'919999999999',password:'Resume-test-123!'});
    await importExam(db,source,[user.id]);let time=Date.now();
    const engine=createExamEngine(db,{now:()=>time}),attempt=await engine.start(source.id,user.id);
    await engine.answer(attempt.id,user.id,edit('q1','a',0,true));await db.close();db=null;
    time+=120000;db=await openDatabase({SQLITE_PATH:path});await migrate(db);
    const restored=await createExamEngine(db,{now:()=>time}).get(attempt.id,user.id);
    assert.equal(restored.deadline,attempt.deadline);assert.equal(restored.answers.q1.value,'a');assert.equal(restored.answers.q1.review,true);
    assert.equal(restored.deadline-restored.serverNow,source.durationSeconds*1000-120000);
  }finally{if(db)await db.close();await rm(folder,{recursive:true,force:true});}
});
test('flags persist, repeated signals are deduplicated, and teacher routes are read-only',async t=>{
  const f=await fixture(t),attempt=await f.start(),path='/api/attempts/'+attempt.id;
  const flag={eventId:randomUUID(),type:'tab_hidden'};
  assert.equal((await f.api(path+'/flags',flag)).status,200);await f.api(path+'/flags',flag);
  assert.equal((await f.api(path+'/flags',{eventId:randomUUID(),type:'unknown'})).status,400);
  assert.equal((await f.api(path+'/flags',flag,'student2')).status,404);
  const snapshot=await f.api('/api/monitor',undefined,'teacher');assert.equal(snapshot.status,200);
  assert.equal(snapshot.body.students.find(s=>s.id===f.users.student1.id).attempts[0].flagCount,1);
  assert.equal(snapshot.body.flags[0].type,'tab_hidden');
  assert.equal((await f.api('/api/monitor')).status,403);
  assert.equal((await f.api(path+'/submit',{expectedVersion:0},'teacher')).status,403);
  assert.equal((await f.api(path+'/force-submit',{},'teacher')).status,403);
});
test('five live students push progress and flags to teacher within one second without polling',async t=>{
  const f=await fixture(t,{students:5});
  const teacher=await f.socket('teacher'),students=[];
  for(let i=1;i<=5;i++)students.push(await f.socket('student'+i));
  const attempts=await Promise.all(Array.from({length:5},(_,i)=>f.start('student'+(i+1))));
  const target=nextMessage(teacher.ws,message=>message.type==='roster'&&message.students.length===5&&message.students.every(s=>s.connected&&s.attempts[0]?.answered===1)&&message.flags.length===1);
  const before=performance.now();
  await Promise.all(attempts.map((attempt,i)=>f.api('/api/attempts/'+attempt.id+'/answers',edit('q1','a'), 'student'+(i+1))));
  await f.api('/api/attempts/'+attempts[0].id+'/flags',{eventId:randomUUID(),type:'fullscreen_exit'});
  const snapshot=await target;const elapsed=performance.now()-before;
  t.diagnostic('Five-client progress/flag delivery: '+Math.round(elapsed)+' ms');
  assert.ok(elapsed<1000,'Live update exceeded one second: '+elapsed);
  assert.ok(!JSON.stringify(snapshot).includes('password_hash'));assert.ok(!JSON.stringify(snapshot).includes('exam_json'));
  assert.ok(students.every(s=>s.messages.every(message=>message.type!=='roster')));
  const disconnected=nextMessage(teacher.ws,message=>message.type==='roster'&&message.students.find(s=>s.loginId==='student1')?.connected===false);
  students[0].ws.close();await disconnected;
  for(const client of [teacher,...students])client.ws.terminate();
});
test('two connections for one student stay online until both close; reconnect pushes fresh snapshot',async t=>{
  const f=await fixture(t),teacher=await f.socket('teacher'),one=await f.socket('student1'),two=await f.socket('student1');
  const stillOnline=nextMessage(teacher.ws,m=>m.type==='roster'&&m.students.find(s=>s.loginId==='student1')?.connected);
  one.ws.close();await stillOnline;
  const offline=nextMessage(teacher.ws,m=>m.type==='roster'&&!m.students.find(s=>s.loginId==='student1')?.connected);
  two.ws.close();await offline;
  const online=nextMessage(teacher.ws,m=>m.type==='roster'&&m.students.find(s=>s.loginId==='student1')?.connected);
  const reconnected=await f.socket('student1');await online;
  reconnected.ws.terminate();teacher.ws.terminate();
});
test('production refuses development fixtures',async()=>{
  const db=await openDatabase({SQLITE_PATH:':memory:'});
  try{assert.throws(()=>createApp(db,{env:{NODE_ENV:'production',APP_ORIGIN:'https://example.com'},development:true}),/Development fixtures/);}
  finally{await db.close();}
});
