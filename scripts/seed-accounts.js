import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';

const database = await openDatabase();
try {
  await migrate(database);
  console.log(`Connected to ${database.kind} database.`);

  const defaultPassword = process.env.INITIAL_USER_PASSWORD || 'BRDS-cbt-pass-2026!';
  const defaultPhone = process.env.INITIAL_USER_PHONE || '919876543210';

  const accounts = [
    { loginId: 'admin', name: 'BRDS Administrator', role: 'admin', phone: defaultPhone, password: defaultPassword },
    { loginId: 'teacher', name: 'BRDS Faculty Teacher', role: 'teacher', phone: defaultPhone, password: defaultPassword }
  ];

  for (let i = 1; i <= 10; i++) {
    accounts.push({
      loginId: `student${i}`,
      name: `BRDS Student ${i}`,
      role: 'student',
      phone: defaultPhone,
      password: defaultPassword
    });
  }

  let createdCount = 0;
  for (const acc of accounts) {
    const exists = (await database.query('SELECT id FROM users WHERE login_id=$1', [acc.loginId])).rows[0];
    if (!exists) {
      await createUser(database, acc);
      console.log(`✅ Created ${acc.role.toUpperCase()} account: ${acc.loginId}`);
      createdCount++;
    } else {
      console.log(`ℹ️ Account already exists: ${acc.loginId}`);
    }
  }

  console.log(`\n🎉 Seed finished. ${createdCount} new account(s) created.`);
  console.log(`Default Password for seeded accounts: ${defaultPassword}`);
  console.log(`Default Phone for OTP testing: ${defaultPhone}`);
} catch (error) {
  console.error('Account seeding failed:', error.message || error);
  process.exitCode = 1;
} finally {
  await database.close();
}
