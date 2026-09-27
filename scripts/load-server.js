import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {openDatabase} from '../src/database.js';
import {migrate} from '../src/schema.js';
import {createUser,digest} from '../src/auth.js';
import {importExam} from '../src/exams.js';
import {createApp} from '../src/app.js';

if(!process.send||process.env.NODE_ENV==='production'||process.env.DATABASE_URL||process.env.RENDER)throw new Error('Isolated load-test child only.');
let app,db,timer,delay,dbPath;
process.on('message',async message=>{
  try{
    if(message.type==='start'){
      dbPath=message.database;db=await openDatabase({SQLITE_PATH:dbPath});await migrate(db);
      const students=[],users=[];
      for(let i=0;i<=message.students;i++){
        const user=await createUser(db,{loginId:i?'load-student-'+i:'load-teacher',name:i?'Load Student '+i:'Load Teacher',role:i?'student':'teacher',phone:'919999999999',password:randomBytes(24).toString('hex')});
        const token=randomBytes(32).toString('hex');
        await db.query('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)',[digest(token),user.id,Date.now(),Date.now()+(message.seconds+7200)*1000]);
        users.push({id:user.id,cookie:'brds_session='+token});if(i)students.push(user.id);
      }
      const exam=JSON.parse(await readFile(new URL('../fixtures/design-foundations.json',import.meta.url),'utf8'));
      exam.durationSeconds=message.seconds+3600;
      await importExam(db,exam,students);
      app=createApp(db,{env:{}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
      delay=monitorEventLoopDelay({resolution:20});delay.enable();
      let cpu=process.cpuUsage(),at=performance.now();
      timer=setInterval(()=>{
        const current=performance.now(),used=process.cpuUsage(cpu);
        process.send({type:'metrics',rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,cpuPercent:(used.user+used.system)/((current-at)*10),eventLoopMaxMs:delay.max/1e6});
        cpu=process.cpuUsage();at=current;delay.reset();
      },5000);timer.unref();
      process.send({type:'ready',base:'http://127.0.0.1:'+app.server.address().port,users,exam});
    }else if(message.type==='verify'){
      clearInterval(timer);delay.disable();await app.close();
      db=await openDatabase({SQLITE_PATH:dbPath});await migrate(db);
      const attempts=(await db.query('SELECT id,answers_json,version,status FROM attempts')).rows;
      const mutations=Number((await db.query('SELECT COUNT(*) AS count FROM answer_mutations')).rows[0].count);
      await db.close();
      process.send({type:'verified',attempts:attempts.map(a=>({...a,answers:JSON.parse(a.answers_json),answers_json:undefined})),mutations},()=>process.exit(0));
    }
  }catch(error){process.send({type:'fatal',message:error.message});process.exitCode=1;clearInterval(timer);if(app)await app.close().catch(()=>{});process.disconnect();}
});
