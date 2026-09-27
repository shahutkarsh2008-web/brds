import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';

const database = await openDatabase();
await migrate(database);

const app = createApp(database, {
  otp: {
    async send() { return 'preview-session'; },
    async verify() { return true; }
  }
});

const port = 3005;
app.server.listen(port, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`📱💻 DUAL DEVICE PREVIEW TEST SERVER READY!`);
  console.log(`==================================================`);
  console.log(`PC Monitor Access:    http://localhost:${port}/login`);
  console.log(`Mobile Viewport Access: http://localhost:${port}/login (Set Mobile mode in Browser F12)`);
  console.log(`Database Connection:  ${database.kind.toUpperCase()}`);
  console.log(`==================================================\n`);
});
