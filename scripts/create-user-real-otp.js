import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';

const phone = '919981084008';
const password = process.env.USER_PASSWORD || 'BRDS-real-2026!';

for (const dbPath of ['./data/brds.sqlite', './data/development.sqlite']) {
  try {
    const database = await openDatabase({ SQLITE_PATH: dbPath });
    await migrate(database);

    const accounts = [
      { loginId: 'admin', name: 'BRDS Admin (Real OTP)', role: 'admin', phone, password },
      { loginId: 'teacher', name: 'BRDS Teacher (Real OTP)', role: 'teacher', phone, password },
      { loginId: 'student1', name: 'BRDS Student 1 (Real OTP)', role: 'student', phone, password },
      { loginId: 'utkarsh', name: 'Utkarsh (Real OTP)', role: 'student', phone, password }
    ];

    for (const acc of accounts) {
      const existing = (await database.query('SELECT id FROM users WHERE login_id=$1', [acc.loginId])).rows[0];
      if (existing) {
        await database.query('UPDATE users SET phone=$1, password_hash=$2 WHERE login_id=$3', [phone, await import('../src/passwords.js').then(m => m.hashPassword(password)), acc.loginId]);
        console.log(`Updated existing account [${acc.loginId}] with phone ${phone} in ${dbPath}`);
      } else {
        await createUser(database, acc);
        console.log(`Created new account [${acc.loginId}] (${acc.role}) with phone ${phone} in ${dbPath}`);
      }
    }
    await database.close();
  } catch (err) {
    console.error(`Error configuring accounts in ${dbPath}:`, err.message);
  }
}
