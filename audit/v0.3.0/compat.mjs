// Saves written by earlier engines at every position of bot games must load in this build unchanged
// (guild rows included) and keep playing to a valid end.
// Usage, from the repository root:
//   git worktree add ../kh-v022 def9312 && git worktree add ../kh-v023 f1ff79c
//   cd audit/v0.3.0 && node compat.mjs ../../../kh-v022/src ../../../kh-v023/src
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const url=dir=>pathToFileURL(resolve(dir)).href;
const [dir020,dir021]=process.argv.slice(2);
if (!dir020||!dir021) throw Error('Pass the src folders of v0.2.2 and v0.2.3.');
const OLD={'0.2.2':dir020,'0.2.3':dir021};
const NEW=process.argv[4]??'../../src';
const nw={...await import(`${url(NEW)}/engine.mjs`),...await import(`${url(NEW)}/save.mjs`),...await import(`${url(NEW)}/bot.mjs`)};
let loaded=0, changed=0, rowsKept=0, continued=0, problems=[];
for (const [ver,dir] of Object.entries(OLD)) {
  const old={...await import(`${url(dir)}/engine.mjs`),...await import(`${url(dir)}/save.mjs`),...await import(`${url(dir)}/bot.mjs`)};
  for (let g=0; g<6; g++) {
    let s=old.createGame({seed:`compat-${ver}-${g}`,setup:1+g,side:g%2,starter:g%2,difficulty:g%3?'standard':'quick'});
    let step=0;
    while (true) {
      const text=old.writeSave(s);
      try {
        const r=nw.readSave(text); loaded++;
        const a=JSON.parse(text).state, bb=JSON.parse(nw.writeSave(r)).state;
        if (a.phase==='end') { delete a.result; delete bb.result; } delete a.schema; delete bb.schema;
        if (JSON.stringify(a)!==JSON.stringify(bb)) changed++;
        if (JSON.stringify(r.players.map(p=>p.guilds))===JSON.stringify(s.players.map(p=>p.guilds))) rowsKept++;
        if (step%25===0 && r.phase!=='end') {
          let t=r, n=0; while (t.phase!=='end' && n++<300) { t=nw.transition(t,nw.botAction(t,'quick')); nw.checkGame(t); }
          if (t.phase==='end') continued++; else problems.push(`${ver}/${g}/${step}: no end`);
        }
      } catch(e) { problems.push(`${ver}/${g}/${step}: ${e.message}`); }
      if (s.phase==='end') break;
      s=old.transition(s,old.botAction(s,'quick')); step++;
    }
  }
}
console.log({loaded,changedOnRoundTrip:changed,rowsKept,continuedToEnd:continued,problems:problems.slice(0,5),problemCount:problems.length});
