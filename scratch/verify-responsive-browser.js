import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { once } from 'node:events';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';

async function verifyResponsiveLayouts() {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);
  const app = createApp(db, { env: { NODE_ENV: 'development' } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const port = app.server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${base}`);

  const jsSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../public/workspace-dark.css', import.meta.url), 'utf8');

  const widths = [
    { name: 'Desktop Large', width: 1440, height: 900 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait / Mobile Wide', width: 768, height: 1024 },
    { name: 'Narrow Mobile', width: 360, height: 800 }
  ];

  const results = [];

  for (const vp of widths) {
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM('<!doctype html><html><head><style></style></head><body><div id="app"></div></body></html>', {
      url: `${base}/dashboard.html`,
      runScripts: 'outside-only',
      virtualConsole
    });

    const styleEl = dom.window.document.querySelector('style');
    styleEl.textContent = cssSource;

    dom.window.innerWidth = vp.width;
    dom.window.innerHeight = vp.height;

    // Execute dashboard JS
    dom.window.eval(jsSource);
    await new Promise(r => setTimeout(r, 100));

    const body = dom.window.document.body;
    const appEl = dom.window.document.querySelector('#app');
    const headerEl = dom.window.document.querySelector('.top-header-bar');
    const riskTable = dom.window.document.querySelector('.risk-table');
    const cardGrid = dom.window.document.querySelector('.card-grid');

    const appText = appEl ? appEl.textContent : '';
    const hasOverflow = body.scrollWidth > vp.width;

    results.push({
      width: vp.width,
      name: vp.name,
      appRendered: Boolean(appEl && appEl.children.length > 0),
      hasHeader: Boolean(headerEl),
      textLength: appText.length,
      overflow: hasOverflow
    });

    dom.window.close();
  }

  await new Promise(resolve => app.server.close(resolve));
  await db.close();

  console.log('--- RESPONSIVE VERIFICATION RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
}

verifyResponsiveLayouts().catch(console.error);
