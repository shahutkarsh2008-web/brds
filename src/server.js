import { openDatabase } from './database.js';
import { createApp } from './app.js';
import { migrate } from './schema.js';
import { bootstrapAdmin } from '../scripts/bootstrap-admin.js';

try {
  const database = await openDatabase();
  await migrate(database);
  await bootstrapAdmin(database);
  const app = createApp(database);
  app.server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
    console.log(`BRDS Phase 4 running on port ${app.server.address().port} (${database.kind})`);
  });
  app.server.on('error', async error => {
    console.error(`Server failed: ${error.code || 'unknown'}`);
    await database.close(); process.exit(1);
  });
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
    await app.close(); clearTimeout(timeout);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch { console.error('Startup failed. Check database configuration and connectivity.'); process.exitCode = 1; }
