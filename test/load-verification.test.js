import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptPath = join(__dirname, '..', 'scripts', 'load-runner.js');

test('Phase 5: Load runner executes high-concurrency simulation with 0 lost writes', async () => {
  const child = fork(scriptPath, ['--students', '5', '--seconds', '5', '--interval-ms', '500'], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  let output = '';
  child.stdout.on('data', data => { output += data.toString(); });
  child.stderr.on('data', data => { output += data.toString(); });

  const exitCode = await new Promise(resolve => {
    child.on('exit', code => resolve(code));
  });

  assert.equal(exitCode, 0, `Load runner failed with code ${exitCode}. Output:\n${output}`);
  assert.match(output, /FINAL \{"status":"passed"/, 'Expected load test report status to be passed');
  assert.match(output, /"errors":0/, 'Expected 0 errors during load execution');
  assert.match(output, /"drops":0/, 'Expected 0 unexpected socket drops');
});
