// Random-legal-move fuzzer: every step must keep checkGame valid, save round-trip, and terminate.
import {createGame,legalActions,transition,actionKey,scoreBreakdown,finalResult} from '../../src/engine.mjs';
import {checkGame,readSave,writeSave} from '../../src/save.mjs';

const games=Number(process.argv[2]??400);
let rng=12345;
const rand=n=>{rng=(Math.imul(rng,1103515245)+12345)>>>0; return rng%n;};
const stats={games:0,steps:0,maxPending:0,deckReshuffles:0,techMax:0,popMax:0,oreMax:0,tax25:0,repFloorHits:0,draws:0,errors:[],
  pendingKinds:{},endBarbara:{},emptyDeckDraw:0};
for (let g=0; g<games; g++) {
  let s=createGame({seed:`fuzz-${g}`,setup:1+g%9,side:g%2,starter:(g>>1)%2,difficulty:'quick'});
  let steps=0;
  try {
    while (s.phase!=='end') {
      if (++steps>400) throw Error('stall');
      const acts=legalActions(s);
      if (!acts.length) throw Error('no legal actions');
      // Bias away from skip so the game actually develops.
      const nonSkip=acts.filter(a=>a.kind!=='skip');
      const pool=nonSkip.length && rand(10)<9 ? nonSkip : acts;
      const a=pool[rand(pool.length)];
      const before=s;
      s=transition(s,a);
      checkGame(s);
      if (steps%7===0) { const r=readSave(writeSave(s)); if (JSON.stringify(r)!==JSON.stringify(s)) throw Error('save mismatch'); }
      stats.maxPending=Math.max(stats.maxPending,s.pending.length);
      for (const it of s.pending) stats.pendingKinds[it.kind]=(stats.pendingKinds[it.kind]??0)+1;
      if (s.mineMixed && !before.mineMixed) stats.deckReshuffles++;
      stats.techMax=Math.max(stats.techMax,s.technology);
      stats.popMax=Math.max(stats.popMax,s.pop); stats.oreMax=Math.max(stats.oreMax,s.ore);
      if (s.tax===25) stats.tax25++;
      if (a.kind==='mine' && before.mineDeck.length+before.mineDiscard.length===0) stats.emptyDeckDraw++;
    }
    stats.steps+=steps; stats.games++;
    stats.endBarbara[s.barbara]=(stats.endBarbara[s.barbara]??0)+1;
    if (s.result.winner===null) stats.draws++;
    for (const seat of [0,1]) {
      const b=scoreBreakdown(s,seat);
      if (JSON.stringify(b)!==JSON.stringify(s.result.scores[seat])) throw Error('result mismatch');
    }
  } catch(e) { stats.errors.push(`fuzz-${g}: ${e.message}`); }
}
console.log(JSON.stringify(stats,null,1));
