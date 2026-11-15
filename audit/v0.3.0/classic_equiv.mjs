// Does this build's 'classic' policy reproduce v0.2.3's Standard decision for decision (2 players)?
// Usage, from this folder:
//   git worktree add ../../../kh-v023 f1ff79c
//   node classic_equiv.mjs ../../../kh-v023/src [games=9]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const url=dir=>pathToFileURL(resolve(dir)).href;
const oldDir=process.argv[2];
if (!oldDir) throw Error('Pass the v0.2.3 src folder.');
const A={...await import(`${url(oldDir)}/engine.mjs`),...await import(`${url(oldDir)}/bot.mjs`)};
const B={...await import('../../src/engine.mjs'),...await import('../../src/bot.mjs')};
let decisions=0, mismatches=[], games=0, scoreMatch=0;
for (let i=0;i<Number(process.argv[3]??9);i++) {
  const opts={seed:`equiv-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2};
  let a=A.createGame(opts), b=B.createGame(opts);
  while (a.phase!=='end') {
    const x=A.botAction(a,'standard'), y=B.botAction(b,'classic');
    decisions++;
    if (A.actionKey(x)!==B.actionKey(y)) { mismatches.push({seed:opts.seed,round:a.round,turn:a.turn,x,y}); break; }
    a=A.transition(a,x); b=B.transition(b,y);
  }
  games++;
  if (a.phase==='end'&&b.phase==='end'&&JSON.stringify(a.result.scores)===JSON.stringify(b.result.scores)) scoreMatch++;
}
console.log({games,decisions,mismatches:mismatches.length,first:mismatches[0],identicalFinalScores:scoreMatch});
