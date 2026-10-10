import { readFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Uses the site's actual TypeScript config without depending on native TS
// execution, so this command also works on the supported Node 22.12 release.
const root = fileURLToPath(new URL('../', import.meta.url));
const configSource = await readFile(path.join(root, 'src/site.config.ts'), 'utf8');
const compiled = ts.transpileModule(configSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: 'site.config.ts',
}).outputText;
const { profile } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const temporary = path.join(root, 'artifacts/pdf-temp');
await mkdir(temporary, { recursive: true });
const localTools = path.join(root, 'artifacts/pdf-tools');
const env = {
  ...process.env,
  TEMP: temporary,
  TMP: temporary,
  TMPDIR: temporary,
  PYTHONDONTWRITEBYTECODE: '1',
  PYTHONNOUSERSITE: '1',
  PYTHONPATH: localTools,
};
const result = spawnSync(process.env.PYTHON ?? 'python', ['-B', path.join(root, 'scripts/generate-cv.py')], {
  cwd: root,
  env,
  input: JSON.stringify({ profile, root }),
  encoding: 'utf8',
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(`Could not start Python: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  console.error('Install the local tools first: python -m pip install --target artifacts/pdf-tools --cache-dir artifacts/pdf-cache reportlab pymupdf pypdf');
  process.exitCode = result.status ?? 1;
}
