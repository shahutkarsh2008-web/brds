import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createUser } from '../src/auth.js';
// Use a local ignored JSON file; never put passwords in command-line arguments.
import { readFile } from 'node:fs/promises';
const file = process.argv[2];
if (!file) { console.error('Usage: npm run user:create -- path/to/private-account.json'); process.exit(1); }
const database = await openDatabase();
try {
  await migrate(database);
  const input = JSON.parse(await readFile(file, 'utf8'));
  const user = await createUser(database, input);
  console.log(`Created ${user.role} account: ${user.loginId}`);
} catch (error) { console.error(error.status ? error.message : 'Account creation failed. Check input and database configuration.'); process.exitCode = 1; }
finally { await database.close(); }
