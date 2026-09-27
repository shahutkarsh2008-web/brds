import { readFile,access } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { importExam,validateExam } from '../src/exams.js';
const [file,...logins]=process.argv.slice(2);
if(!file||!logins.length){console.error('Usage: npm run exam:import -- fixtures/design-foundations.json student-id [student-id...]');process.exit(1);}
const database=await openDatabase();
try {
  await migrate(database);
  const exam=validateExam(JSON.parse(await readFile(resolve(file),'utf8')));
  for(const question of exam.questions)if(question.image)await access(join(process.cwd(),'public',question.image));
  const users=[];
  for(const login of logins){const user=(await database.query("SELECT id FROM users WHERE login_id=$1 AND role='student' AND active=1",[login.toLowerCase()])).rows[0];if(!user)throw new Error('Student not found: '+login);users.push(user.id);}
  console.log('Imported assigned exam: '+await importExam(database,exam,users));
}catch(error){console.error(error.status?error.message:'Import failed. Check JSON, student IDs, media files and database settings.');process.exitCode=1;}
finally{await database.close();}
