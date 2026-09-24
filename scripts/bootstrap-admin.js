import { createUser } from '../src/auth.js';
// First deployment only. Never overwrite an existing account or reset its password.
export async function bootstrapAdmin(database, env = process.env) {
  const keys = ['BOOTSTRAP_ADMIN_ID', 'BOOTSTRAP_ADMIN_NAME', 'BOOTSTRAP_ADMIN_PHONE', 'BOOTSTRAP_ADMIN_PASSWORD'];
  if (!keys.some(key => env[key])) return;
  if (!keys.every(key => env[key])) throw new Error('All bootstrap fields are required');
  const exists = await database.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (exists.rowCount) return;
  await createUser(database, { loginId: env.BOOTSTRAP_ADMIN_ID, name: env.BOOTSTRAP_ADMIN_NAME, phone: env.BOOTSTRAP_ADMIN_PHONE, password: env.BOOTSTRAP_ADMIN_PASSWORD, role: 'admin' });
  console.log('Initial admin account created. Remove BOOTSTRAP_ADMIN_* secrets after verification.');
}
