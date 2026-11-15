// Preview (planning copy) vs committed transition, for every legal action in random mid-game states.
import {createGame,legalActions,transition,copyState,applyKnownAction} from '../../src/engine.mjs';
let rng=99; const rand=n=>{rng=(Math.imul(rng,1103515245)+12345)>>>0; return rng%n;};
const view=s=>JSON.stringify([s.players.map(p=>[p.coins,p.vp,p.rep,p.production,p.pelicans,p.houses,p.held]),s.pop,s.ore,s.tax,s.arms,s.barbara,s.patrons,s.city,s.mine]);
let compared=0, roundEnd=0, mismatch=0;
for (let g=0; g<150; g++) {
  let s=createGame({seed:`pv-${g}`,setup:1+g%9});
  for (let step=0; step<200 && s.phase==='action'; step++) {
    const acts=legalActions(s);
    for (const a of acts) {
      const plan=copyState(s,false); applyKnownAction(plan,a,true);
      const real=transition(s,a);
      if (real.round!==s.round || real.phase!==s.phase) { roundEnd++; continue; }
      compared++; if (view(plan)!==view(real)) mismatch++;
    }
    const non=acts.filter(a=>a.kind!=='skip'); s=transition(s,(non.length?non:acts)[rand((non.length?non:acts).length)]);
  }
}
console.log({compared,mismatch,skippedRoundEnd:roundEnd});
