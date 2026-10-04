import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

test('Practice lists real topic counts, sends selected exact topic, and retries catalog errors', async () => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/dashboard', runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const calls = [];
  let failed = false;
  dom.window.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
    let payload = {};
    if (String(url).includes('/practice/topics')) {
      if (failed) return new Response(JSON.stringify({ error: 'Offline' }), { status: 503 });
      payload = { totalQuestions: 12, categories: [{ title: 'Practical & Scientific Knowledge', topics: [{ topic: 'Everyday objects and mechanisms', count: 12 }] }] };
    } else if (url === '/api/student/practice/count') payload = { count: 12 };
    else if (url === '/api/student/dashboard') payload = { kpis: {}, attempts: [], topics: [] };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  dom.window.eval(await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8'));
  const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  await tick();
  [...dom.window.document.querySelectorAll('.nav-icon-btn')][2].click();
  await tick();
  const chip = dom.window.document.querySelector('.topic-subchip');
  assert.match(chip.textContent, /Everyday objects and mechanisms \(12\)/);
  chip.click(); await tick();
  assert.ok(calls.some(call => call.body?.topics?.includes('Everyday objects and mechanisms')));
  assert.equal(dom.window.document.querySelector('.topic-subchip').ariaPressed, 'true');
  failed = true;
  await dom.window.eval('render()'); await tick();
  assert.match(dom.window.document.body.textContent, /Could not load question topics/);
  failed = false;
  [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Retry topics').click();
  await tick();
  assert.match(dom.window.document.body.textContent, /Everyday objects and mechanisms \(12\)/);
  dom.window.close();
});
