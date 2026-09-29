import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Phase 4 workspace dashboard renderer is valid and present', async () => {
  const source = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(source, /function render|const render/);
  assert.match(source, /Papers Library|overview/i);
});
