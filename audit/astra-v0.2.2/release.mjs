import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('./evidence/reviewed-tree.json',import.meta.url)));
for(const file of manifest.files) {
  const bytes=fs.readFileSync(path.join(root,file.path));
  const sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(sha,file.sha,file.path);
}
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'kutna-astra-release-'));
try {
  const rebuilt=path.join(temporary,'rebuilt.html');
  execFileSync(process.execPath,[path.join(root,'build.mjs'),rebuilt]);
  const expected=fs.readFileSync(path.join(root,'Kutna_Hora_Solo.html'));
  const actual=fs.readFileSync(rebuilt);
  assert.ok(actual.equals(expected),'Rebuild differs byte for byte');
  const evidence={commit:manifest.commit,node:process.version,filesMatched:manifest.files.length,bytes:actual.length,
    sha256:createHash('sha256').update(actual).digest('hex'),byteIdentical:true};
  fs.writeFileSync(new URL('./evidence/release-results.json',import.meta.url),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
