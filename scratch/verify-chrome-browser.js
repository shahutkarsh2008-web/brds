import { spawn } from 'node:child_process';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { createUser, digest } from '../src/auth.js';
import { importExam } from '../src/exams.js';
import { once } from 'node:events';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import WebSocket from 'ws';

import { existsSync } from 'node:fs';

const BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

const CHROME_PATH = BROWSER_PATHS.find(p => existsSync(p)) || 'msedge';

async function stopBrowser(processHandle) {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  const exited = once(processHandle, 'exit');
  processHandle.kill();
  await exited;
}


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
  const profileRoot = resolve(tmpdir());
  const profileDir = await mkdtemp(join(profileRoot, 'brds-phase13-cdp-'));
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions'
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
    await stopBrowser(chromeProcess);
    await app.close();
    await rm(profileDir, { recursive: true, force: true });
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
  const targetListResponse = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const targetList = await targetListResponse.json();
  const targetInfo = targetList.find(item => item.id === targetId);
  if (!targetInfo?.webSocketDebuggerUrl) throw new Error(`No CDP page target found for ${targetId}`);
  const targetWsUrl = targetInfo.webSocketDebuggerUrl;
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
  const cookieResult = await sendTargetCDP('Network.setCookie', {
    name: 'brds_session',
    value: token,
    url: base,
    path: '/',
    httpOnly: true
  });
  if (!cookieResult.success) throw new Error('CDP rejected the isolated dashboard session cookie.');

  const screenshotDir = new URL('../reports/phase13-browser-verification/', import.meta.url);
  await mkdir(screenshotDir, { recursive: true });

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900, label: 'Desktop (1440px)' },
    { name: 'tablet-1024', width: 1024, height: 768, label: 'Tablet (1024px)' },
    { name: 'tablet-portrait-768', width: 768, height: 1024, label: 'Tablet Portrait (768px)' },
    { name: 'mobile-narrow-360', width: 360, height: 800, label: 'Narrow Mobile (360px)' }
  ];

  const routes = [
    { id: 'overview', nav: 'Overview', title: 'Overview Dashboard' },
    { id: 'library', nav: 'Library', title: 'Papers Library' },
    { id: 'practice', nav: 'Practice', title: 'Practice Set Builder' },
    { id: 'mocks', nav: 'Mocks', title: 'Mock Exams & Practice Papers' },
    { id: 'analytics', nav: 'Analytics', title: 'Performance Analytics & Marks Leakage' }
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
      if (route.id === 'overview') {
        await sendTargetCDP('Page.navigate', { url: `${base}/dashboard.html` });
      } else {
        await sendTargetCDP('Runtime.evaluate', {
          expression: `(() => { const button = [...document.querySelectorAll('.nav-icon-btn')].find(item => item.querySelector('.tooltip')?.textContent.trim() === ${JSON.stringify(route.nav)}); if (!button) throw new Error('Missing navigation control: ${route.nav}'); button.click(); return true; })()`,
          returnByValue: true
        });
      }

      let renderState;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await sendTargetCDP('Runtime.evaluate', {
          expression: `({ ready: document.readyState, href: location.href, title: document.querySelector('.header-title-text')?.textContent.trim() || '', documentTitle: document.title, bodyText: document.body.innerText.slice(0, 200), hasMain: !!document.querySelector('.app-main'), hasSidebar: !!document.querySelector('.app-sidebar'), cardCount: document.querySelectorAll('.card, .mock-card, .leakage-card, .swot-card').length })`,
          returnByValue: true
        });
        renderState = result.result.value;
        if (renderState.ready === 'complete' && renderState.title && renderState.hasMain && renderState.hasSidebar) break;
      }
      if (!renderState?.title || !renderState.hasMain || !renderState.hasSidebar) {
        throw new Error(`Dashboard failed to render ${route.id}: ${JSON.stringify(renderState)}`);
      }
      if (renderState.title !== route.title) {
        throw new Error(`Navigation to ${route.id} rendered '${renderState.title}', expected '${route.title}'`);
      }

      const evaluation = await sendTargetCDP('Runtime.evaluate', {
        expression: `
          (() => {
            const body = document.body;
            const doc = document.documentElement;
            const viewportWidth = window.innerWidth;
            const scrollWidth = Math.max(body.scrollWidth, doc.scrollWidth);
            const clientWidth = doc.clientWidth;
            const hasHorizontalOverflow = scrollWidth > (clientWidth + 1);
            
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
      if (metrics.viewportWidth !== vp.width) {
        throw new Error(`Requested ${vp.width}px viewport but browser reports ${metrics.viewportWidth}px CSS viewport width (client width ${metrics.clientWidth}px).`);
      }
      if (!metrics.headerRendered || !metrics.sidebarRendered || !metrics.mainRendered || metrics.cardCount < 1) {
        throw new Error(`Incomplete ${route.id} render at ${vp.width}px: ${JSON.stringify(metrics)}`);
      }
      if (metrics.hasHorizontalOverflow) {
        throw new Error(`Horizontal overflow on ${route.id} at ${vp.width}px: ${JSON.stringify(metrics)}`);
      }

      const screenshot = await sendTargetCDP('Page.captureScreenshot', { format: 'png' });
      const screenshotPath = new URL(`../reports/phase13-browser-verification/${route.id}-${vp.name}.png`, import.meta.url);
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

      verificationEvidence.push({
        viewport: vp.label,
        width: vp.width,
        route: route.id,
        routeTitle: route.title,
        metrics,
        screenshotSaved: `reports/phase13-browser-verification/${route.id}-${vp.name}.png`
      });

      console.log(`  ✓ Route '${route.id}' at ${vp.width}px: scrollWidth=${metrics.scrollWidth}px, clientWidth=${metrics.clientWidth}px, overflow=${metrics.hasHorizontalOverflow}`);
    }
  }

  // Cleanup
  targetWs.close();
  ws.close();
  await stopBrowser(chromeProcess);
  await app.close();
  if (profileDir.startsWith(profileRoot) && profileDir.includes('brds-phase13-cdp-')) {
    await rm(profileDir, { recursive: true, force: true });
  }

  console.log('\n==================================================');
  console.log('REAL BROWSER (CHROME DEVTOOLS PROTOCOL) VERIFICATION COMPLETED');
  console.log(`Total Scenarios Tested: ${verificationEvidence.length}`);
  console.log('==================================================\n');

  await writeFile(
    new URL('../reports/phase13-browser-evidence.json', import.meta.url),
    JSON.stringify(verificationEvidence, null, 2)
  );

  process.exit(0);
}

runChromeVerification().catch(err => {
  console.error('Real Chrome Verification Failed:', err);
  process.exit(1);
});
