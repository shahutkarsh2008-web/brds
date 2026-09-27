import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
import { importExam } from '../src/exams.js';
import { createApp } from '../src/app.js';
if(process.env.NODE_ENV==='production'||process.env.RENDER||process.env.DATABASE_URL)throw new Error('Demo cannot run in production or with a hosted database.');
const database=await openDatabase({SQLITE_PATH:'./data/development.sqlite'});await migrate(database);
const students=[];
for(const role of ['teacher','admin','student1','student2','student3','student4','student5']){
  let user=(await database.query('SELECT id FROM users WHERE login_id=$1',[role])).rows[0];
  if(!user)user=await createUser(database,{loginId:role,name:role.startsWith('student')?'Practice Student '+role.at(-1):'Practice '+role,role:role.startsWith('student')?'student':role,phone:'919999999999',password:'BRDS-local-demo-2026!'});
  if(role.startsWith('student'))students.push(user.id);
}
for(const file of ['design-foundations','timed-sections']){
  const exam=JSON.parse(await readFile(new URL('../fixtures/'+file+'.json',import.meta.url),'utf8'));
  if(!(await database.query('SELECT id FROM exams WHERE id=$1',[exam.id])).rowCount)await importExam(database,exam,students);
}
const sessions=new Set();
const app=createApp(database,{env:{},development:true,otp:{async send(){const id=randomUUID();sessions.add(id);return id;},async verify(id,code){return sessions.has(id)&&code==='123456';}}});
const port=Number(process.env.DEMO_PORT||3001);
app.server.listen(port,'127.0.0.1',()=>console.log('LOCAL DEMO ONLY: http://localhost:'+port+' | IDs: student1–student5, teacher, admin | Password: BRDS-local-demo-2026! | Simulated OTP: 123456'));
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await app.close();});
