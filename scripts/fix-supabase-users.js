import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/database.js';
import { hashPassword } from '../src/passwords.js';

const database = await openDatabase();
try {
  console.log(`Connecting to ${database.kind} database...`);

  const password = 'Abc123@def';
  const passwordHash = await hashPassword(password);
  const phone = '919981084008';

  const userList = [
    { loginId: 'utkarsh', name: 'Utkarsh', role: 'student' },
    { loginId: 'admin', name: 'BRDS Administrator', role: 'admin' },
    { loginId: 'teacher', name: 'BRDS Teacher', role: 'teacher' },
    { loginId: 'student1', name: 'Student One', role: 'student' }
  ];

  for (const u of userList) {
    // Delete any broken/conflicting rows first
    await database.query('DELETE FROM users WHERE login_id=$1', [u.loginId]);
    
    // Insert clean row
    await database.query(
      `INSERT INTO users(id, login_id, name, password_hash, phone, role, active, created_at)
       VALUES($1, $2, $3, $4, $5, $6, 1, $7)`,
      [randomUUID(), u.loginId, u.name, passwordHash, phone, u.role, Date.now()]
    );
    console.log(`✅ Successfully provisioned [${u.loginId}] (${u.role}) -> Password: ${password} | Phone: ${phone}`);
  }

  // Verify selecting users back from DB
  const check = (await database.query('SELECT login_id, role, phone FROM users ORDER BY login_id')).rows;
  console.log('\nVerified Database Users:', check);

} catch (err) {
  console.error('User fix error:', err);
  process.exitCode = 1;
} finally {
  await database.close();
}
