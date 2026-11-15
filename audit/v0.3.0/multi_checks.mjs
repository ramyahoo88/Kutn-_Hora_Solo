// v0.3.0 at 2/3/4 players: fuzz with checkGame + save round trips, preview vs commit,
// and the rival's information boundary. Usage: node multi_checks.mjs <srcDir> [games]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const src=pathToFileURL(resolve(process.argv[2]??'../../src')).href;
const E=await import(`${src}/engine.mjs`), S=await import(`${src}/save.mjs`), B=await import(`${src}/bot.mjs`), D=await import(`${src}/data.mjs`);
const N=Number(process.argv[3]??120);
let rng=777; const rand=n=>{rng=(Math.imul(rng,1103515245)+12345)>>>0; return rng%n;};
const out={fuzz:{},preview:{compared:0,mismatch:0},leak:{checked:0,differ:0,examples:[]}};
const view=s=>JSON.stringify([s.players.map(p=>[p.coins,p.vp,p.rep,p.production,p.pelicans,p.houses,p.held]),s.pop,s.ore,s.tax,s.arms,s.barbara,s.patrons,s.city,s.mine]);
for (const count of [2,3,4]) {
  const f=out.fuzz[count]={games:0,steps:0,errors:[],redSeenAfter:new Set(),councilRounds:new Set(),rounds:new Set(),sharedWinner:0,taxOrderOk:0,taxOrderBad:0};
  for (let g=0; g<N; g++) {
    let s=E.createGame({playerCount:count,seed:`multi-${count}-${g}`,setup:1+g%9,side:g%count,starter:(g>>1)%count,events:count>2&&g%2===1});
    let steps=0, lastRedCheck=false;
    try {
      while (s.phase!=='end') {
        if (++steps>700) throw Error('stall');
        const acts=E.legalActions(s); if (!acts.length) throw Error('no actions');
        const non=acts.filter(a=>a.kind!=='skip');
        const pool=non.length&&rand(10)<9?non:acts;
        const a=pool[rand(pool.length)];
        // Preview vs commit on a sample of positions
        if (s.phase==='action' && rand(6)===0) for (const x of acts) {
          const plan=E.copyState(s,false); E.applyKnownAction(plan,x,true);
          const real=E.transition(s,x);
          if (real.round!==s.round||real.phase!==s.phase) continue;
          out.preview.compared++; if (view(plan)!==view(real)) out.preview.mismatch++;
        }
        const before=s;
        if (s.phase==='tax') { const expect=E.seatAtTurn(s,s.taxIndex); if (s.actor===expect) f.taxOrderOk++; else f.taxOrderBad++; }
        s=E.transition(s,a);
        S.checkGame(s);
        if (steps%9===0) { const r=S.readSave(S.writeSave(s)); if (JSON.stringify(r)!==JSON.stringify(s)) throw Error('save mismatch'); }
        if (s.round!==before.round) {
          const reds=s.market.flat().filter(st=>D.BUILDINGS[st.tiles[0]]?.group==='red').length;
          if (reds && !lastRedCheck) { f.redSeenAfter.add(before.round); lastRedCheck=true; }
          const council=s.log?.filter(l=>l.round===before.round&&/town council/.test(l.text)).length;
          if (council) f.councilRounds.add(before.round);
        }
      }
      f.games++; f.steps+=steps; f.rounds.add(s.round);
      if (s.result.winner===null) f.sharedWinner++;
      const t=E.finalResult(s); if (JSON.stringify(t.scores)!==JSON.stringify(s.result.scores)) throw Error('result mismatch');
    } catch(e) { f.errors.push(`${count}/${g}@${steps}: ${e.message}`); }
  }
  for (const k of ['redSeenAfter','councilRounds','rounds']) f[k]=[...f[k]].sort();
}
// Rival information boundary at 3 and 4 players
const rot=a=>a.length>1?[...a.slice(1),a[0]]:a;
for (const count of [3,4]) for (let g=0; g<4; g++) {
  let s=E.createGame({playerCount:count,seed:`leak-${count}-${g}`,setup:1+g,starter:g%count,events:g%2===1});
  let steps=0;
  while (s.phase!=='end' && steps++<500) {
    const a=B.botAction(s,'standard');
    if (s.actor!==0 && s.phase==='action' && E.legalActions(s).length>1 && rand(3)===0) {
      const r=structuredClone(s);
      r.rng^=0x9e37; r.red=[...r.red].reverse();
      r.events=[...r.events.slice(0,r.round),...r.events.slice(r.round).reverse()];
      if (r.mineMixed) { const all=rot([...r.mineDeck,...r.mineDiscard]); const k=r.mineDeck.length; r.mineDeck=all.slice(0,k); r.mineDiscard=all.slice(k); }
      else r.mineDeck=[1,2,3].flatMap(t=>r.mineDeck.filter(id=>D.MINES[id].tier===t).reverse());
      for (const row of r.market) for (const st of row) { const [top,...rest]=st.tiles; const m=rest.at(-1); st.tiles=[top,...rest.slice(0,-1).reverse(),...(m?[m]:[])]; }
      const b=B.botAction(r,'standard');
      out.leak.checked++;
      if (E.actionKey(a)!==E.actionKey(b)) { out.leak.differ++; if (out.leak.examples.length<2) out.leak.examples.push({count,seed:s.seed,round:s.round,turn:s.turn,a,b}); }
    }
    s=E.transition(s,a);
  }
}
console.log(JSON.stringify(out,null,1));
