import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {WebSocket} from 'ws';
import {openDatabase} from '../src/database.js';
import {migrate} from '../src/schema.js';
import {createUser,digest} from '../src/auth.js';
import {importExam} from '../src/exams.js';
import {createApp} from '../src/app.js';

const html=await readFile(new URL('../public/exam.html',import.meta.url),'utf8');
const script=await readFile(new URL('../public/exam.js',import.meta.url),'utf8');
const exam=JSON.parse(await readFile(new URL('../fixtures/design-foundations.json',import.meta.url),'utf8'));
async function until(check){
  const end=Date.now()+4000;
  while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,10));}
  assert.fail('Expected client state was not reached');
}
async function setup(t){
  const db=await openDatabase({SQLITE_PATH:':memory:'});await migrate(db);
  const user=await createUser(db,{loginId:'ui-student',name:'UI Student',role:'student',phone:'919999999999',password:'Test-password-123!'});
  const token=randomBytes(32).toString('hex'),cookie='brds_session='+token;
  await db.query('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)',[digest(token),user.id,Date.now(),Date.now()+86400000]);
  await importExam(db,exam,[user.id]);
  const app=createApp(db,{env:{}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base='http://127.0.0.1:'+app.server.address().port;
  const attempt=await app.engine.start(exam.id,user.id),windows=[];
  t.after(async()=>{for(const w of windows){w.dispatchEvent(new w.Event('pagehide'));w.close();}await app.close();});
  const key='brds-attempt:'+user.id+':'+attempt.id;
  function page(saved){
    const dom=new JSDOM(html,{url:base+'/exam?id='+attempt.id,runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window;windows.push(w);let offline=false;
    w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;
    Object.defineProperty(w.navigator,'onLine',{get:()=>!offline});
    w.fetch=(path,options={})=>{
      if(offline)return Promise.reject(new Error('Simulated disconnection'));
      return fetch(new URL(path,base),{...options,headers:{...options.headers,Cookie:cookie,Origin:base}});
    };
    w.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:base,headers:{Cookie:cookie}});}};
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    if(saved)w.localStorage.setItem(key,saved);
    w.eval(script);
    return {w,$:s=>w.document.querySelector(s),offline(value){offline=value;w.dispatchEvent(new w.Event(value?'offline':'online'));}};
  }
  return {page,key,get:()=>app.engine.get(attempt.id,user.id)};
}
test('exam client preserves offline edits across tab recreation and submits recovered answers',async t=>{
  const f=await setup(t),p=f.page();
  await until(()=>p.$('input[type=radio]')&&p.$('#save-status').textContent.startsWith('All changes saved'));
  p.offline(true);p.$('input[value=a]').click();
  await until(()=>p.$('#error').textContent.includes('Connection interrupted'));
  const saved=p.w.localStorage.getItem(f.key);assert.equal(JSON.parse(saved).updates[0].value,'a');
  assert.equal((await f.get()).answers[exam.questions[0].id].value,null);
  p.w.dispatchEvent(new p.w.Event('pagehide'));p.w.close();
  const resumed=f.page(saved);
  await until(async()=> (await f.get()).answers[exam.questions[0].id]?.value==='a');
  await until(()=>resumed.$('#save-status').textContent.startsWith('All changes saved'));
  assert.equal(resumed.$('input[value=a]').checked,true);
  assert.notEqual(resumed.$('#timer').textContent,'--:--');
  resumed.$('#review').click();
  await until(async()=> (await f.get()).answers[exam.questions[0].id]?.review===true);
  await until(()=>resumed.$('#save-status').textContent.startsWith('All changes saved'));
  resumed.$('#submit').click();await until(()=>resumed.$('#submit-dialog').open);
  resumed.$('#confirm-submit').click();await until(()=>!resumed.$('#result').hidden);
  assert.equal(resumed.$('#score').textContent,'4');
  assert.equal((await f.get()).status,'submitted');
});
test('numeric incomplete entry blocks navigation, valid input autosaves and clear removes it',async t=>{
  const f=await setup(t),p=f.page();
  await until(()=>p.$('#palette').children.length===8);
  p.$('#palette').children[4].click();await until(()=>p.$('#numeric-answer'));
  const input=p.$('#numeric-answer');input.value='-';input.dispatchEvent(new p.w.Event('input'));
  p.$('#next').click();assert.match(p.$('#question-number').textContent,/QUESTION 5 /);
  await new Promise(r=>setTimeout(r,100));
  assert.match(p.$('#save-status').textContent,/Numeric entry incomplete/);
  input.value='81';input.dispatchEvent(new p.w.Event('input'));
  await until(async()=> (await f.get()).answers[exam.questions[4].id]?.value==='81');
  p.$('#next').click();assert.match(p.$('#question-number').textContent,/QUESTION 6 /);
  p.$('#previous').click();assert.equal(p.$('#numeric-answer').value,'81');
  p.$('#clear').click();await until(async()=> (await f.get()).answers[exam.questions[4].id]?.value===null);
  assert.equal(p.$('#numeric-answer').value,'');
});
