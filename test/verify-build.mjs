import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'kutna-verify-'));
const python = process.env.PYTHON ?? 'python3';
const node = process.execPath;
const run = (program, ...args) => execFileSync(program, args, {cwd: root, stdio: 'inherit'});

async function compare(shipped, rebuilt) {
  const [expected, actual] = await Promise.all([readFile(join(root, shipped)), readFile(rebuilt)]);
  assert.ok(expected.equals(actual), shipped + ' differs from the rebuild. See the build instructions in mincmistr/README.md.');
  console.log('Matches ' + shipped);
}

async function regenerate(shipped, program, ...args) {
  const path = join(temp, basename(shipped));
  run(program, ...args, path);
  await compare(shipped, path);
  return path;
}

try {
  await compare('mincmistr/Mincmistr_Rules.md', join(root, 'mincmistr/print/rules.md'));
  await regenerate('mincmistr/print/cards.json', node, 'mincmistr/print/export_cards.mjs');
  await regenerate('mincmistr/print/app-reference.html', python, 'mincmistr/print/build.py', '--app-reference');
  const pdf = await regenerate('mincmistr/Mincmistr_Print_and_Play.pdf', python, 'mincmistr/print/build.py', '--pdf');
  await regenerate('src/assets/mincmistr-plans.webp', python, 'mincmistr/print/export_app_plans.py', pdf);
  await regenerate('Kutna_Hora_Solo.html', node, 'build.mjs');
} finally {
  await rm(temp, {recursive: true, force: true});
}
