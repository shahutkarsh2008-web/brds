import {fork} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {isDeepStrictEqual} from 'node:util';

const args=process.argv.slice(2),options={students:90,seconds:3600,interval:3000,injectDrop:false};
for(let i=0;i<args.length;i++){
  if(args[i]==='--inject-drop'){options.injectDrop=true;continue;}
  const key={'--students':'students','--seconds':'seconds','--interval-ms':'interval'}[args[i]];
  if(!key)throw new Error('Use --students 1..90 --seconds 5..5400 --interval-ms 100..60000 [--inject-drop]');
  options[key]=Number(args[++i]);
}
for(const [key,min,max] of [['students',1,90],['seconds',5,5400],['interval',100,60000]])if(!Number.isInteger(options[key])||options[key]<min||options[key]>max)throw new Error('Invalid '+key);
if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL||process.env.RENDER)throw new Error('Load fixture refuses production or hosted database environments.');
await mkdir('tmp/load-tests',{recursive:true});await mkdir('reports/load-tests',{recursive:true});
const run=await mkdtemp(resolve('tmp/load-tests/run-')),name=new Date().toISOString().replace(/[:.]/g,'-');
const reportFile=resolve('reports/load-tests/'+name+'.json');
const report={startedAt:new Date().toISOString(),status:'running',scope:'isolated localhost Node child server + file-backed SQLite; not hosted PostgreSQL',config:options,elapsedSeconds:0,rounds:0,successfulWrites:0,readbacks:0,liveReads:0,teacherSnapshots:0,unexpectedDrops:0,errors:[],errorCount:0,missedCadences:0,peakServerRssMB:0,peakServerHeapMB:0,peakServerCpuPercent:0,peakServerEventLoopDelayMs:0,maxTeacherCatchupMs:0,latency:{},database:join(run,'load.sqlite')};
const timings={write:[],read:[]},sockets=[],clients=[];let expectedClose=false,child,base,teacherSnapshot,ready,verified;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function failure(message){report.errorCount++;if(report.errors.length<30)report.errors.push(String(message));}
function percentile(values,p){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*100)/100;}
async function save(){
  for(const [key,values] of Object.entries(timings))report.latency[key]={count:values.length,p50Ms:percentile(values,.5),p95Ms:percentile(values,.95),p99Ms:percentile(values,.99),maxMs:values.length?Math.round(values.reduce((max,n)=>Math.max(max,n),0)*100)/100:0};
  await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
}
async function api(client,path,body){
  const start=performance.now();const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,Cookie:client.cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const value=await response.json();timings[body===undefined?'read':'write'].push(performance.now()-start);
  if(!response.ok)throw new Error('HTTP '+response.status+' '+(value.code||value.error));
  return value;
}
async function liveRead(client){
  if(expectedClose)return;
  if(client.reading){client.again=true;return;}
  client.reading=true;
  try{await api(client,'/api/attempts/'+client.attempt.id);report.liveReads++;}
  catch(error){failure('live read: '+(error.message+(error.cause?.code?' ['+error.cause.code+']':'')));}
  finally{client.reading=false;if(client.again&&!expectedClose){client.again=false;await liveRead(client);}}
}
async function connect(client,isTeacher=false){
  const ws=new WebSocket(base.replace('http:','ws:')+'/session-ws',{origin:base,headers:{Cookie:client.cookie}});
  sockets.push(ws);
  ws.on('close',(code)=>{if(!expectedClose){report.unexpectedDrops++;failure('Unexpected socket close '+code);}});
  ws.on('error',error=>{if(!expectedClose)failure('WebSocket: '+(error.message+(error.cause?.code?' ['+error.cause.code+']':'')));});
  ws.on('message',raw=>{
    try{const message=JSON.parse(raw);
      if(message.type==='roster'&&isTeacher){teacherSnapshot=message;report.teacherSnapshots++;}
      if(message.type==='attempt_changed'&&!isTeacher&&client.attempt)void liveRead(client);
    }catch(error){failure('Socket payload: '+(error.message+(error.cause?.code?' ['+error.cause.code+']':'')));}
  });
  await new Promise((ok,no)=>{const timer=setTimeout(()=>no(new Error('Socket open timeout')),15000);ws.once('open',()=>{clearTimeout(timer);ok();});ws.once('error',error=>{clearTimeout(timer);no(error);});});
}
function waitFor(type,timeout=120000){
  return new Promise((ok,no)=>{const timer=setTimeout(()=>{child.off('message',handler);no(new Error(type+' timeout'));},timeout);
    function handler(message){if(message.type===type){clearTimeout(timer);child.off('message',handler);ok(message);}else if(message.type==='fatal'){clearTimeout(timer);child.off('message',handler);no(new Error(message.message));}}
    child.on('message',handler);
  });
}
async function teacherCatchup(){
  const start=performance.now();
  while(performance.now()-start<5000){
    const attempts=new Map(teacherSnapshot?.students.flatMap(s=>s.attempts).map(a=>[a.id,a.version])||[]);
    if(clients.every(c=>(attempts.get(c.attempt.id)??-1)>=c.version)){report.maxTeacherCatchupMs=Math.max(report.maxTeacherCatchupMs,Math.round(performance.now()-start));return;}
    await sleep(20);
  }failure('Teacher roster did not catch up within five seconds');
}
let interrupted=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{interrupted=true;failure('Run interrupted: '+signal);});
try{
  child=fork(new URL('./load-server.js',import.meta.url),[],{stdio:['ignore','inherit','inherit','ipc']});
  child.on('message',message=>{if(message.type==='metrics'){
    report.peakServerRssMB=Math.max(report.peakServerRssMB,Math.round(message.rss/1048576));
    report.peakServerHeapMB=Math.max(report.peakServerHeapMB,Math.round(message.heap/1048576));
    report.peakServerCpuPercent=Math.max(report.peakServerCpuPercent,Math.round(message.cpuPercent));
    report.peakServerEventLoopDelayMs=Math.max(report.peakServerEventLoopDelayMs,Math.round(message.eventLoopMaxMs));
  }});
  const pending=waitFor('ready');child.send({type:'start',students:options.students,seconds:options.seconds,database:report.database});ready=await pending;base=ready.base;
  const [teacher,...students]=ready.users;
  for(const user of students){const attempt=await api(user,'/api/exams/'+ready.exam.id+'/start',{});clients.push({...user,attempt,version:attempt.version,expected:{},writes:0,reading:false,again:false});}
  await connect(teacher,true);await Promise.all(clients.map(c=>connect(c)));
  await teacherCatchup();
  const started=performance.now(),end=started+options.seconds*1000;let next=started,lastSave=started;
  console.log('Load started: '+options.students+' students + teacher; '+options.seconds+' seconds. Report: '+reportFile);
  await save();
  while(performance.now()<end&&!interrupted){
    const round=report.rounds;
    await Promise.all(clients.map(async(client,i)=>{
      try{
        const q=ready.exam.questions[(round+i)%ready.exam.questions.length];
        const value=q.type==='NAT'?String(round%1000):q.type==='MSQ'?[q.options[round%q.options.length].id]:q.options[round%q.options.length].id;
        const expected={value,visited:true,review:round%7===0};
        const saved=await api(client,'/api/attempts/'+client.attempt.id+'/answers',{mutationId:randomUUID(),questionId:q.id,value,review:expected.review,expectedVersion:client.version});
        if(saved.version!==client.version+1||!isDeepStrictEqual(saved.answers[q.id],expected))throw new Error('Save acknowledgment mismatch');
        client.version=saved.version;client.expected[q.id]=expected;client.writes++;report.successfulWrites++;
        const read=await api(client,'/api/attempts/'+client.attempt.id);
        if(read.version!==client.version||!isDeepStrictEqual(read.answers,client.expected))throw new Error('Answer readback mismatch');
        report.readbacks++;
      }catch(error){failure('student '+i+': '+(error.message+(error.cause?.code?' ['+error.cause.code+']':'')));}
    }));
    report.rounds++;report.elapsedSeconds=Math.round((performance.now()-started)/1000);
    if(options.injectDrop&&report.rounds===1)sockets[1].terminate();
    if(report.rounds===1||performance.now()-lastSave>=30000){
      await teacherCatchup();await save();lastSave=performance.now();
      console.log(JSON.stringify({seconds:report.elapsedSeconds,writes:report.successfulWrites,errors:report.errorCount,drops:report.unexpectedDrops,rssMB:report.peakServerRssMB}));
    }
    next+=options.interval;if(performance.now()>next)report.missedCadences++;
    await sleep(Math.max(0,Math.min(next,end)-performance.now()));
  }
  report.elapsedSeconds=Math.round((performance.now()-started)/1000);
  await teacherCatchup();
  await Promise.all(clients.map(async client=>{
    try{const result=await api(client,'/api/attempts/'+client.attempt.id+'/submit',{expectedVersion:client.version});if(result.status!=='submitted')throw new Error('Not submitted');client.version=result.version;}
    catch(error){failure('final submission: '+(error.message+(error.cause?.code?' ['+error.cause.code+']':'')));}
  }));
  await teacherCatchup();expectedClose=true;
  for(const ws of sockets)ws.close();
  const drainEnd=Date.now()+20000;while(clients.some(c=>c.reading)&&Date.now()<drainEnd)await sleep(20);
  if(clients.some(c=>c.reading))failure('Live reads did not drain');
  const persisted=waitFor('verified');child.send({type:'verify'});verified=await persisted;
  for(const client of clients){
    const row=verified.attempts.find(a=>a.id===client.attempt.id);
    if(!row||row.status!=='submitted'||row.version!==client.version||!isDeepStrictEqual(row.answers,client.expected))failure('Persisted attempt mismatch after database reopen');
  }
  if(verified.mutations!==report.successfulWrites)failure('Persisted mutation count differs from acknowledged writes');
  report.persistedMutations=verified.mutations;report.verifiedAttempts=verified.attempts.length;
  report.acceptanceDurationMet=options.students>=70&&report.elapsedSeconds>=3600;
  report.status=report.errorCount?'failed':'passed';
}catch(error){failure((error.message+(error.cause?.code?' ['+error.cause.code+']':'')));report.status='failed';}
finally{
  expectedClose=true;for(const ws of sockets)ws.terminate();if(child?.connected)child.kill();
  report.finishedAt=new Date().toISOString();await save();
  console.log('FINAL '+JSON.stringify({status:report.status,elapsedSeconds:report.elapsedSeconds,writes:report.successfulWrites,drops:report.unexpectedDrops,errors:report.errorCount,report:reportFile}));
  if(report.status!=='passed')process.exitCode=1;
}
