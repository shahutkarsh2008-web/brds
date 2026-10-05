import { spawn } from 'node:child_process';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { createUser, digest } from '../src/auth.js';
import { importExam } from '../src/exams.js';
import { once } from 'node:events';
import { writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

import { existsSync } from 'node:fs';

const BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

const CHROME_PATH = BROWSER_PATHS.find(p => existsSync(p)) || 'msedge';


async function setupTestApp() {
  const db = await openDatabase({ SQLITE_PATH: ':memory:' });
  await migrate(db);

  const student = await createUser(db, {
    loginId: 'browser_student',
    name: 'Browser Verification Student',
    role: 'student',
    password: 'Password12345!',
    phone: '919876543299'
  });

  const token = 'c'.repeat(64);
  await db.query(
    'INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)',
    [digest(token), student.id, Date.now(), Date.now() + 86400000]
  );

  const sampleExam = {
    id: 'browser-uceed-2026',
    title: 'UCEED 2026 Grand Mock Exam',
    durationSeconds: 7200,
    totalQuestions: 2,
    maxMarks: 6,
    sections: [{ id: 'part-a', title: 'Part A' }],
    questions: [
      { id: 'bq1', sectionId: 'part-a', type: 'MSQ', prompt: 'Select rotated 3D models', options: [{ id: 'a', text: 'Model A' }, { id: 'b', text: 'Model B' }], answer: ['a', 'b'], marks: { correct: 3, incorrect: -1, unanswered: 0 }, topic: 'Spatial Reasoning' },
      { id: 'bq2', sectionId: 'part-a', type: 'MCQ', prompt: 'Select light direction', options: [{ id: 'a', text: 'Top Left' }, { id: 'b', text: 'Bottom Right' }], answer: 'a', marks: { correct: 3, incorrect: -1, unanswered: 0 }, topic: 'Observation & Design' }
    ]
  };

  await importExam(db, sampleExam, [student.id]);

  const app = createApp(db, { env: { NODE_ENV: 'development' } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const port = app.server.address().port;

  return { app, db, port, token };
}

async function runChromeVerification() {
  const { app, db, port, token } = await setupTestApp();
  const base = `http://127.0.0.1:${port}`;
  console.log(`Test App Server listening on ${base}`);

  const debugPort = 9222 + Math.floor(Math.random() * 1000);
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  await new Promise(resolve => setTimeout(resolve, 1500));

  let versionInfo;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (res.ok) {
        versionInfo = await res.json();
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (!versionInfo || !versionInfo.webSocketDebuggerUrl) {
    chromeProcess.kill();
    app.close();
    await db.close();
    throw new Error(`Failed to connect to Chrome DevTools Protocol on port ${debugPort}`);
  }

  console.log('Connected to Real Chrome via DevTools Protocol:', versionInfo.Browser);

  const ws = new WebSocket(versionInfo.webSocketDebuggerUrl);
  await once(ws, 'open');

  let msgId = 1;
  const sendCDP = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (data) => {
      const parsed = JSON.parse(data);
      if (parsed.id === id) {
        ws.off('message', handler);
        if (parsed.error) reject(new Error(parsed.error.message));
        else resolve(parsed.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const { targetId } = await sendCDP('Target.createTarget', { url: 'about:blank' });
  const targetWsUrl = `ws://127.0.0.1:${debugPort}/devtools/page/${targetId}`;
  const targetWs = new WebSocket(targetWsUrl);
  await once(targetWs, 'open');

  let targetMsgId = 1;
  const sendTargetCDP = (method, params = {}) => new Promise((resolve, reject) => {
    const id = targetMsgId++;
    const handler = (data) => {
      const parsed = JSON.parse(data);
      if (parsed.id === id) {
        targetWs.off('message', handler);
        if (parsed.error) reject(new Error(parsed.error.message));
        else resolve(parsed.result);
      }
    };
    targetWs.on('message', handler);
    targetWs.send(JSON.stringify({ id, method, params }));
  });

  await sendTargetCDP('Page.enable');
  await sendTargetCDP('Network.enable');

  // Set session cookie for authenticated dashboard rendering
  await sendTargetCDP('Network.setCookie', {
    name: 'brds_session',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true
  });

  await mkdir(new URL('../reports/screenshots/', import.meta.url), { recursive: true });

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900, label: 'Desktop (1440px)' },
    { name: 'tablet-1024', width: 1024, height: 768, label: 'Tablet (1024px)' },
    { name: 'tablet-portrait-768', width: 768, height: 1024, label: 'Tablet Portrait (768px)' },
    { name: 'mobile-narrow-360', width: 360, height: 800, label: 'Narrow Mobile (360px)' }
  ];

  const routes = [
    { id: 'overview', url: `${base}/dashboard.html#overview`, title: 'Overview Dashboard' },
    { id: 'library', url: `${base}/dashboard.html#papers`, title: 'Papers Library' },
    { id: 'practice', url: `${base}/dashboard.html#practice`, title: 'Practice Builder' },
    { id: 'mocks', url: `${base}/dashboard.html#mocks`, title: 'Mocks Workspace' },
    { id: 'analytics', url: `${base}/dashboard.html#analytics`, title: 'Analytics View' }
  ];

  const verificationEvidence = [];

  for (const vp of viewports) {
    console.log(`\nTesting Real Chrome Viewport: ${vp.label} (${vp.width}x${vp.height})`);

    await sendTargetCDP('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width <= 768
    });

    for (const route of routes) {
      await sendTargetCDP('Page.navigate', { url: route.url });
      await new Promise(resolve => setTimeout(resolve, 600));

      const evaluation = await sendTargetCDP('Runtime.evaluate', {
        expression: `
          (() => {
            const body = document.body;
            const doc = document.documentElement;
            const viewportWidth = window.innerWidth;
            const scrollWidth = Math.max(body.scrollWidth, doc.scrollWidth);
            const clientWidth = doc.clientWidth;
            const hasHorizontalOverflow = scrollWidth > (viewportWidth + 1);
            
            const header = document.querySelector('.top-header-bar');
            const sidebar = document.querySelector('.app-sidebar');
            const main = document.querySelector('.app-main');
            const cards = Array.from(document.querySelectorAll('.card, .mock-card, .leakage-card, .swot-card'));
            
            return {
              viewportWidth,
              clientWidth,
              scrollWidth,
              hasHorizontalOverflow,
              headerRendered: !!header,
              sidebarRendered: !!sidebar,
              mainRendered: !!main,
              cardCount: cards.length,
              pageTitle: document.title || 'BRDS CBT'
            };
          })()
        `,
        returnByValue: true
      });

      const metrics = evaluation.result.value;

      const screenshot = await sendTargetCDP('Page.captureScreenshot', { format: 'png' });
      const screenshotPath = new URL(`../reports/screenshots/${route.id}-${vp.name}.png`, import.meta.url);
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

      verificationEvidence.push({
        viewport: vp.label,
        width: vp.width,
        route: route.id,
        routeTitle: route.title,
        metrics,
        screenshotSaved: `reports/screenshots/${route.id}-${vp.name}.png`
      });

      console.log(`  ✓ Route '${route.id}' at ${vp.width}px: scrollWidth=${metrics.scrollWidth}px, clientWidth=${metrics.clientWidth}px, overflow=${metrics.hasHorizontalOverflow}`);
    }
  }

  // Cleanup
  targetWs.close();
  ws.close();
  chromeProcess.kill();
  app.close();

  console.log('\n==================================================');
  console.log('REAL BROWSER (CHROME DEVTOOLS PROTOCOL) VERIFICATION COMPLETED');
  console.log(`Total Scenarios Tested: ${verificationEvidence.length}`);
  console.log('==================================================\n');

  await writeFile(
    new URL('../reports/real-browser-evidence.json', import.meta.url),
    JSON.stringify(verificationEvidence, null, 2)
  );

  process.exit(0);
}

runChromeVerification().catch(err => {
  console.error('Real Chrome Verification Failed:', err);
  process.exit(1);
});
