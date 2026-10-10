import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep browser profiles and Playwright's transform cache inside the repository.
const temporary = fileURLToPath(new URL('../artifacts/tmp/', import.meta.url));
await mkdir(temporary, { recursive:true });
const runner = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)),
  'test', ...process.argv.slice(2),
], { stdio:'inherit', env:{ ...process.env, TEMP:temporary, TMP:temporary, TMPDIR:temporary } });
runner.on('error', error => { console.error(error.message); process.exitCode = 1; });
runner.on('exit', code => { process.exitCode = code ?? 1; });
