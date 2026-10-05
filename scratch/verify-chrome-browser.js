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
import { fileURLToPath } from 'node:url';
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
  let app = null;
  let chromeProcess = null;
  let ws = null;
  let targetWs = null;
  let profileDir = null;
  const profileRoot = resolve(tmpdir());
  try {
  const setup = await setupTestApp();
  app = setup.app;
  const { port, token } = setup;
  const base = `http://127.0.0.1:${port}`;
  console.log(`Test App Server listening on ${base}`);

  const debugPort = 9222 + Math.floor(Math.random() * 1000);
  profileDir = await mkdtemp(join(profileRoot, 'brds-phase5-cdp-'));
  chromeProcess = spawn(CHROME_PATH, [
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
    throw new Error(`Failed to connect to Chrome DevTools Protocol on port ${debugPort}`);
  }

  console.log('Connected to Real Chrome via DevTools Protocol:', versionInfo.Browser);

  ws = new WebSocket(versionInfo.webSocketDebuggerUrl);
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
  targetWs = new WebSocket(targetWsUrl);
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
  await sendTargetCDP('DOM.enable');
  await sendTargetCDP('Runtime.enable');
  await sendTargetCDP('Log.enable');

  const browserErrors = [];
  const failedResponses = [];
  targetWs.on('message', data => {
    let event;
    try { event = JSON.parse(data); } catch { return; }
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params.exceptionDetails;
      browserErrors.push({ type: 'exception', text: details.text, url: details.url || details.exception?.description || '' });
    } else if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
      browserErrors.push({ type: 'console', text: event.params.entry.text, url: event.params.entry.url || '' });
    } else if (event.method === 'Network.responseReceived' && event.params.response.status >= 500) {
      failedResponses.push({ status: event.params.response.status, url: event.params.response.url });
    }
  });

  // Set session cookie for authenticated dashboard rendering
  const cookieResult = await sendTargetCDP('Network.setCookie', {
    name: 'brds_session',
    value: token,
    url: base,
    path: '/',
    httpOnly: true
  });
  if (!cookieResult.success) throw new Error('CDP rejected the isolated dashboard session cookie.');

  const screenshotDir = new URL('../reports/phase5-browser-verification/', import.meta.url);
  await mkdir(screenshotDir, { recursive: true });

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900, label: 'Desktop (1440px)' },
    { name: 'tablet-1024', width: 1024, height: 768, label: 'Tablet (1024px)' },
    { name: 'tablet-portrait-768', width: 768, height: 1024, label: 'Tablet Portrait (768px)' },
    { name: 'mobile-narrow-360', width: 360, height: 800, label: 'Narrow Mobile (360px)' }
  ];
  const viewportsToRun = process.env.PHASE5_QUICK === '1' ? [viewports[0]] : viewports;

  const routes = [
    { id: 'overview', nav: 'Overview', title: 'Overview Dashboard' },
    { id: 'library', nav: 'Library', title: 'Papers Library' },
    { id: 'practice', nav: 'Practice', title: 'Practice Set Builder' },
    { id: 'mocks', nav: 'Mocks', title: 'Mock Exams & Practice Papers' },
    { id: 'analytics', nav: 'Analytics', title: 'Performance Analytics & Marks Leakage' },
    { id: 'gk', nav: 'GK Sprint', title: 'GK Sprint' },
    { id: 'sketches', nav: 'Sketches', title: 'Sketch Studio' },
    { id: 'bookmarks', nav: 'Bookmarks', title: 'Bookmarks & Revision' },
    { id: 'guides', nav: 'Guides', title: 'Guides & Quick Quizzes' },
    { id: 'settings', nav: 'Settings', title: 'Settings' }
  ];

  const verificationEvidence = [];

  for (const vp of viewportsToRun) {
    console.log(`\nTesting Real Chrome Viewport: ${vp.label} (${vp.width}x${vp.height})`);

    await sendTargetCDP('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width <= 768
    });

    for (const route of routes) {
      const interactionChecks = [];
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

      if (route.id === 'sketches' && vp.width === 1440) {
        await sendTargetCDP('Runtime.evaluate', { expression: `(() => { const title = document.querySelector('#sketch-title'); title.value = 'CDP saved sketch'; title.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`, returnByValue: true });
        const documentNode = await sendTargetCDP('DOM.getDocument', { depth: -1 });
        const fileInput = await sendTargetCDP('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#sketch-file' });
        const sampleImage = fileURLToPath(new URL('../reports/phase13-browser-verification/overview-desktop-1440.png', import.meta.url));
        await sendTargetCDP('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [sampleImage] });
        let previewReady = false;
        for (let attempt = 0; attempt < 40; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('.sketch-upload-preview')?.getAttribute('src')?.startsWith('data:image/png;base64,') === true`, returnByValue: true });
          if (result.result.value) { previewReady = true; break; }
        }
        if (!previewReady) throw new Error('Sketch upload did not produce a browser preview.');
        await sendTargetCDP('Runtime.evaluate', { expression: `([...document.querySelectorAll('button')].find(button => button.textContent.includes('Save to my gallery'))).click()`, returnByValue: true });
        let sketchSaved = false;
        for (let attempt = 0; attempt < 40; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('.sketch-gallery-item')?.textContent.includes('CDP saved sketch') === true`, returnByValue: true });
          if (result.result.value) { sketchSaved = true; break; }
        }
        if (!sketchSaved) throw new Error('Sketch save did not appear in the authenticated gallery after the API roundtrip.');
        interactionChecks.push('PNG upload, preview, authenticated save, and gallery reload');
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
      const screenshotPath = new URL(`../reports/phase5-browser-verification/${route.id}-${vp.name}.png`, import.meta.url);
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

      verificationEvidence.push({
        viewport: vp.label,
        width: vp.width,
        route: route.id,
        routeTitle: route.title,
        metrics,
        interactions: interactionChecks,
        screenshotSaved: `reports/phase5-browser-verification/${route.id}-${vp.name}.png`
      });

      console.log(`  ✓ Route '${route.id}' at ${vp.width}px: scrollWidth=${metrics.scrollWidth}px, clientWidth=${metrics.clientWidth}px, overflow=${metrics.hasHorizontalOverflow}`);
    }
  }

  // Exercise real keyboard focus and persistent appearance preference.
  await sendTargetCDP('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sendTargetCDP('Page.navigate', { url: `${base}/dashboard.html` });
  let dashboardReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `!!document.querySelector('.app-sidebar .nav-icon-btn') && !!document.querySelector('.app-main')`, returnByValue: true });
    if (result.result.value) { dashboardReady = true; break; }
  }
  if (!dashboardReady) throw new Error('Dashboard did not load for keyboard/theme acceptance checks.');
  await sendTargetCDP('Runtime.evaluate', { expression: `document.activeElement.blur()`, returnByValue: true });
  await sendTargetCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sendTargetCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const focusState = await sendTargetCDP('Runtime.evaluate', {
    expression: `(() => { const node = document.activeElement; const css = getComputedStyle(node); return { tag: node.tagName, label: node.getAttribute('aria-label') || node.innerText?.trim() || node.getAttribute('title') || '', focusVisible: node.matches(':focus-visible'), outlineStyle: css.outlineStyle, outlineWidth: css.outlineWidth, outlineColor: css.outlineColor }; })()`,
    returnByValue: true
  });
  const keyboardFocus = focusState.result.value;
  if (!keyboardFocus.focusVisible || keyboardFocus.outlineStyle === 'none' || parseFloat(keyboardFocus.outlineWidth) < 2) {
    throw new Error(`Keyboard tab focus is not visibly indicated: ${JSON.stringify(keyboardFocus)}`);
  }

  const clickNav = async label => sendTargetCDP('Runtime.evaluate', {
    expression: `(() => { const button = [...document.querySelectorAll('.nav-icon-btn')].find(item => item.querySelector('.tooltip')?.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw new Error('Missing navigation control ${label}'); button.click(); return true; })()`,
    returnByValue: true
  });
  await clickNav('Settings');
  await new Promise(resolve => setTimeout(resolve, 200));
  await sendTargetCDP('Runtime.evaluate', { expression: `(() => { const theme = document.querySelector('#settings-theme'); theme.value = 'light'; theme.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.btn-primary').click(); return true; })()`, returnByValue: true });
  let lightSaved = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.body.classList.contains('light-mode') && document.body.innerText.includes('Preferences saved to your account.')`, returnByValue: true });
    if (result.result.value) { lightSaved = true; break; }
  }
  if (!lightSaved) throw new Error('Light appearance preference did not save.');
  await sendTargetCDP('Page.navigate', { url: `${base}/dashboard.html` });
  let themeRestored = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.body.classList.contains('light-mode') && !!document.querySelector('.app-main')`, returnByValue: true });
    if (result.result.value) { themeRestored = true; break; }
  }
  if (!themeRestored) throw new Error('Saved light appearance did not restore after a full reload.');
  await clickNav('Settings');
  await new Promise(resolve => setTimeout(resolve, 200));
  await sendTargetCDP('Runtime.evaluate', { expression: `(() => { const theme = document.querySelector('#settings-theme'); theme.value = 'dark'; theme.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.btn-primary').click(); return true; })()`, returnByValue: true });
  let darkSaved = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `!document.body.classList.contains('light-mode') && document.body.innerText.includes('Preferences saved to your account.')`, returnByValue: true });
    if (result.result.value) { darkSaved = true; break; }
  }
  if (!darkSaved) throw new Error('Dark appearance preference did not save after the persistence test.');

  // Run Library → Exam → Result → Analytics with the isolated assigned paper.
  await clickNav('Library');
  let paperReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `!![...document.querySelectorAll('.mock-card')].find(card => card.textContent.includes('UCEED 2026 Grand Mock Exam'))`, returnByValue: true });
    if (result.result.value) { paperReady = true; break; }
  }
  if (!paperReady) throw new Error('Assigned fixture paper was not available in the Library.');
  await sendTargetCDP('Runtime.evaluate', { expression: `([...document.querySelectorAll('.mock-card')].find(card => card.textContent.includes('UCEED 2026 Grand Mock Exam')).querySelector('button')).click()`, returnByValue: true });
  await sendTargetCDP('Runtime.evaluate', { expression: `([...document.querySelectorAll('.mock-card .btn-primary')].find(button => button.textContent.includes('Start Timed Exam'))).click()`, returnByValue: true });
  let examReady = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `location.pathname === '/exam.html' && !!document.querySelector('#exam-content:not([hidden]) input')`, returnByValue: true });
    if (result.result.value) { examReady = true; break; }
  }
  if (!examReady) throw new Error('Library launch did not open the live exam room.');
  await sendTargetCDP('Runtime.evaluate', { expression: `(() => { document.querySelectorAll('#answer-input input[type=checkbox]').forEach(input => input.click()); document.querySelector('#next').click(); return true; })()`, returnByValue: true });
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('#prompt')?.textContent.includes('light direction')`, returnByValue: true });
    if (result.result.value) break;
    if (attempt === 39) throw new Error('Exam did not advance to question two.');
  }
  await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('#answer-input input[value="a"]').click()`, returnByValue: true });
  let answerSaved = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('#save-status')?.textContent.startsWith('All changes saved')`, returnByValue: true });
    if (result.result.value) { answerSaved = true; break; }
  }
  if (!answerSaved) throw new Error('Exam answer did not finish saving before submission.');
  await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('#submit').click()`, returnByValue: true });
  let submitDialogReady = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('#submit-dialog')?.open === true`, returnByValue: true });
    if (result.result.value) { submitDialogReady = true; break; }
  }
  if (!submitDialogReady) {
    const debug = await sendTargetCDP('Runtime.evaluate', { expression: `({ href: location.href, prompt: document.querySelector('#prompt')?.textContent, submitDisabled: document.querySelector('#submit')?.disabled, saveStatus: document.querySelector('#save-status')?.textContent, error: document.querySelector('#error')?.textContent, body: document.body.innerText.slice(0, 900) })`, returnByValue: true });
    throw new Error(`Exam submit confirmation did not open: ${JSON.stringify(debug.result.value)}`);
  }
  await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('#confirm-submit').click()`, returnByValue: true });
  let resultReady = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `!!document.querySelector('#result:not([hidden])') && document.querySelector('#score')?.textContent !== ''`, returnByValue: true });
    if (result.result.value) { resultReady = true; break; }
  }
  if (!resultReady) {
    const debug = await sendTargetCDP('Runtime.evaluate', { expression: `({ href: location.href, status: document.querySelector('#save-status')?.textContent, error: document.querySelector('#error')?.textContent, dialogOpen: document.querySelector('#submit-dialog')?.open, body: document.body.innerText.slice(0, 1200) })`, returnByValue: true });
    throw new Error(`Exam submission did not display a score result: ${JSON.stringify(debug.result.value)}`);
  }
  const scoreState = await sendTargetCDP('Runtime.evaluate', { expression: `({ score: document.querySelector('#score').textContent, resultTitle: document.querySelector('#result h2').textContent })`, returnByValue: true });
  await sendTargetCDP('Page.navigate', { url: `${base}/dashboard.html` });
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `!!document.querySelector('.app-main')`, returnByValue: true });
    if (result.result.value) break;
  }
  await clickNav('Analytics');
  let analyticsReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await sendTargetCDP('Runtime.evaluate', { expression: `document.querySelector('.header-title-text')?.textContent.trim() === 'Performance Analytics & Marks Leakage' && document.body.innerText.includes('UCEED 2026 Grand Mock Exam')`, returnByValue: true });
    if (result.result.value) { analyticsReady = true; break; }
  }
  if (!analyticsReady) throw new Error('Submitted attempt did not flow into the Analytics timeline.');
  verificationEvidence.push({ acceptance: 'Library → Exam → Result → Analytics', result: scoreState.result.value, completed: analyticsReady });

  const contrastExpression = `(() => { const rgb = value => { if (value.startsWith('#')) { const hex = value.slice(1); const full = hex.length === 3 ? [...hex].map(c => c+c).join('') : hex; return [0,2,4].map(i => parseInt(full.slice(i,i+2),16)/255); } return value.match(/[0-9.]+/g).slice(0,3).map(Number).map(channel => channel/255); }; const lum = value => { const [r,g,b] = rgb(value).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126*r + .7152*g + .0722*b; }; const vars = getComputedStyle(document.body); const bg = vars.getPropertyValue('--bg-canvas').trim(); const ratios = Object.fromEntries(['--text-primary','--text-secondary','--text-muted'].map(key => { const fg = vars.getPropertyValue(key).trim(); const a = lum(fg), b = lum(bg); return [key, { foreground: fg, ratio: Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2)) }]; })); return { background: bg, ratios }; })()`;
  const darkContrastResult = await sendTargetCDP('Runtime.evaluate', { expression: contrastExpression, returnByValue: true });
  await sendTargetCDP('Runtime.evaluate', { expression: `document.body.classList.add('light-mode')`, returnByValue: true });
  const lightContrastResult = await sendTargetCDP('Runtime.evaluate', { expression: contrastExpression, returnByValue: true });
  await sendTargetCDP('Runtime.evaluate', { expression: `document.body.classList.remove('light-mode')`, returnByValue: true });
  const themeContrast = { dark: darkContrastResult.result.value, light: lightContrastResult.result.value };
  for (const [theme, result] of Object.entries(themeContrast)) {
    for (const [token, measurement] of Object.entries(result.ratios)) {
      if (measurement.ratio < 4.5) throw new Error(`${theme} theme ${token} contrast is ${measurement.ratio}:1 (needs 4.5:1 for normal text): ${JSON.stringify(result)}`);
    }
  }

  if (browserErrors.length || failedResponses.length) {
    throw new Error(`Browser errors or server failures: ${JSON.stringify({ browserErrors, failedResponses })}`);
  }
  const browserSummary = await sendTargetCDP('Runtime.evaluate', {
    expression: `(() => { const nav = performance.getEntriesByType('navigation')[0]; return { loadEventEndMs: nav?.loadEventEnd || null, domContentLoadedMs: nav?.domContentLoadedEventEnd || null, transferBytes: performance.getEntriesByType('resource').reduce((sum, item) => sum + (item.transferSize || 0), 0), keyboardFocus: ${JSON.stringify(keyboardFocus)}, themeContrast: ${JSON.stringify(themeContrast)}, consoleErrors: 0, server5xxResponses: 0 }; })()`,
    returnByValue: true
  });

  console.log('\n==================================================');
  console.log('REAL BROWSER (CHROME DEVTOOLS PROTOCOL) VERIFICATION COMPLETED');
  console.log(`Total Scenarios Tested: ${verificationEvidence.length}`);
  console.log('==================================================\n');

  await writeFile(
    new URL('../reports/phase5-browser-evidence.json', import.meta.url),
    JSON.stringify({ scenarios: verificationEvidence, browserSummary: browserSummary.result.value, networkFailures: failedResponses, browserErrors }, null, 2)
  );

  } finally {
    targetWs?.close();
    ws?.close();
    await stopBrowser(chromeProcess);
    if (app) {
      try { await app.close(); } catch {}
    }
    if (profileDir && profileDir.startsWith(profileRoot) && profileDir.includes('brds-phase5-cdp-')) {
      let cleanupError;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
          cleanupError = null;
          break;
        } catch (error) {
          cleanupError = error;
          if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (cleanupError && existsSync(profileDir)) throw cleanupError;
    }
  }
}

runChromeVerification().catch(err => {
  console.error('Real Chrome Verification Failed:', err);
  process.exit(1);
});
