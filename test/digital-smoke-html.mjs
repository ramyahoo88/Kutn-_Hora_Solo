import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function digitalSmokeHtml() {
  const directory=mkdtempSync(join(tmpdir(),'kutna-digital-smoke-'));
  const output=join(directory,'index.html');
  try {
    execFileSync(process.execPath,[fileURLToPath(new URL('../build.mjs',import.meta.url)),output,'--digital']);
    return readFileSync(output);
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
}
