import { openDatabase } from '../src/database.js';
import { hashPassword } from '../src/passwords.js';

const database = await openDatabase();
try {
  console.log(`Connected to ${database.kind} database.`);

  const newPassword = 'BRDS-real-2026!';
  const newHash = await hashPassword(newPassword);

  const phone = '919981084008';

  const accounts = [
    { loginId: 'admin', name: 'BRDS Administrator', role: 'admin' },
    { loginId: 'teacher', name: 'BRDS Teacher', role: 'teacher' },
    { loginId: 'student1', name: 'Student One', role: 'student' },
    { loginId: 'utkarsh', name: 'Utkarsh', role: 'student' }
  ];

  for (const acc of accounts) {
    const existing = (await database.query('SELECT id FROM users WHERE login_id=$1', [acc.loginId])).rows[0];
    if (existing) {
      await database.query('UPDATE users SET password_hash=$1, phone=$2, active=1 WHERE login_id=$3', [newHash, phone, acc.loginId]);
      console.log(`✅ Updated password & phone for [${acc.loginId}] -> Password: ${newPassword} | Phone: ${phone}`);
    } else {
      await database.query('INSERT INTO users(id,login_id,name,password_hash,phone,role,active,created_at) VALUES($1,$2,$3,$4,$5,$6,1,$7)',
        [import('node:crypto').then(m => m.randomUUID()), acc.loginId, acc.name, newHash, phone, acc.role, Date.now()]);
      console.log(`✅ Created user [${acc.loginId}] -> Password: ${newPassword} | Phone: ${phone}`);
    }
  }

  console.log('\n🎉 ALL PASSWORDS RESET SUCCESSFULLY TO: BRDS-real-2026!');
} catch (err) {
  console.error('Password reset failed:', err.message || err);
  process.exitCode = 1;
} finally {
  await database.close();
}
