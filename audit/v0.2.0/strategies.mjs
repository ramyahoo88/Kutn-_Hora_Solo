// Scripted human-style strategies (not built from the rival's evaluator) against the Standard rival.
// Matched seeds; each seed is played with the script in both seats.
import {createGame,legalActions,transition,plotCount,income,mineRow,cityPointsAt,TOWN_NEIGHBOURS} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
import {BUILDINGS,MINES} from '../../src/data.mjs';

const pairs=Number(process.argv[2]??12);
const names=(process.argv[3]??'greedy,miner,taxdodge,plotblock,pelican').split(',');
const group=process.argv[4]??'audit-strat';

const by=(f)=>(a,b)=>f(b)-f(a);
function pick(s,acts,order) {
  for (const test of order) { const xs=acts.filter(test.when); if (xs.length) return xs.sort(by(test.score??(()=>0)))[0]; }
  return acts.find(a=>a.kind==='skip')??acts[0];
}
const me=s=>s.players[s.actor];
const POL={
  // Build first; buy own-guild rights; plot near own buildings; income; mine.
  greedy:s=>{
    const acts=legalActions(s);
    if (s.phase==='tax') return acts.find(a=>a.kind==='tax'&&a.cost<=me(s).coins*0.5)??acts.at(-1);
    return pick(s,acts,[
      {when:a=>a.kind==='technology'||a.kind==='place-mine',score:a=>MINES[a.id].stars*2+MINES[a.id].ore+MINES[a.id].vp-a.cost/4},
      {when:a=>a.kind==='house'},{when:a=>a.kind==='right'||(a.kind==='rights'&&a.cost===0),score:a=>BUILDINGS[a.id].vp??0},
      {when:a=>a.kind==='build'&&!a.as,score:a=>(BUILDINGS[a.id].production??0)*3+cityGain(s,a)-a.cost/5},
      {when:a=>a.kind==='rights'&&!a.as&&!BUILDINGS[a.id].public&&me(s).held.length<2,score:a=>BUILDINGS[a.id].production-a.cost/2},
      {when:a=>a.kind==='plot'&&!a.as&&me(s).held.length>plotCount(s,s.actor),score:a=>-a.cost},
      {when:a=>a.kind==='income'&&!a.as,score:a=>a.color?(s.round>=3?1:-1):0},
      {when:a=>a.kind==='mine'&&!a.as,score:a=>-a.cost},
      {when:a=>a.kind==='barbara'&&!a.as},
    ]);
  },
  // Mine every chance (incl. Joker), contest rows by stars.
  miner:s=>{
    const acts=legalActions(s);
    if (s.phase==='tax') return acts.find(a=>a.kind==='tax'&&a.cost<=me(s).coins*0.4)??acts.at(-1);
    return pick(s,acts,[
      {when:a=>a.kind==='technology'||a.kind==='place-mine',score:a=>MINES[a.id].stars*3+MINES[a.id].ore*1.5+MINES[a.id].vp-a.cost/3},
      {when:a=>a.kind==='house'},{when:a=>a.kind==='right'},
      {when:a=>a.kind==='mine',score:a=>-a.cost-(a.as?3:0)},
      {when:a=>a.kind==='build'&&!a.as,score:a=>-a.cost},
      {when:a=>a.kind==='rights'&&!a.as&&!BUILDINGS[a.id].public&&me(s).held.length<1,score:a=>-a.cost},
      {when:a=>a.kind==='plot'&&!a.as&&me(s).held.length>plotCount(s,s.actor),score:a=>-a.cost},
      {when:a=>a.kind==='income'&&!a.as,score:a=>a.color==='yellow'?2:0},
    ]);
  },
  // Greedy, but never pays tax (always takes the reputation loss).
  taxdodge:s=>s.phase==='tax'?legalActions(s).at(-1):POL.greedy(s),
  // Greedy plus: claim plots touching the rival's buildings to raise their costs / block dots.
  plotblock:s=>{
    const acts=legalActions(s);
    if (s.phase!=='tax' && !s.pending.length && plotCount(s,s.actor)<2) {
      const rival=1-s.actor;
      const blocks=acts.filter(a=>a.kind==='plot'&&!a.as&&a.cost<=8&&TOWN_NEIGHBOURS[a.space].some(i=>s.city[i]?.owner===rival));
      if (blocks.length && s.turn<4) return blocks[0];
    }
    return POL.greedy(s);
  },
  // Public buildings and pelicans: chase St. Barbara + silver/green patricians.
  pelican:s=>{
    const acts=legalActions(s);
    if (s.phase==='tax') return acts.find(a=>a.kind==='tax'&&a.cost<=me(s).coins*0.5)??acts.at(-1);
    return pick(s,acts,[
      {when:a=>a.kind==='barbara'&&!a.as},
      {when:a=>a.kind==='right',score:a=>BUILDINGS[a.id].pelicans??0},
      {when:a=>a.kind==='build'&&!a.as,score:a=>(BUILDINGS[a.id].pelicans??0)*3+(BUILDINGS[a.id].production??0)-a.cost/6},
      {when:a=>a.kind==='rights'&&!a.as&&me(s).held.length<2,score:a=>(BUILDINGS[a.id].pelicans??0)*3+(BUILDINGS[a.id].production??0)-a.cost/3},
      {when:a=>a.kind==='plot'&&!a.as&&me(s).held.length>plotCount(s,s.actor),score:a=>-a.cost},
      {when:a=>a.kind==='income'&&!a.as,score:a=>a.color==='silver'?3:a.color==='green'?2:0},
      {when:a=>['house','patrician','technology','place-mine','mine','score-building','plot','income','build'].includes(a.kind),score:a=>-(a.cost??0)},
    ]);
  },
};
function cityGain(s,a){ const t=structuredClone(s); t.city[a.space]={id:a.id,owner:s.actor}; return cityPointsAt(t,a.space); }

const all={};
for (const name of names) {
  const rows=[];
  for (let i=0;i<pairs;i++) for (const seat of [0,1]) {
    let s=createGame({seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
    let n=0;
    while (s.phase!=='end') {
      if (++n>400) throw Error('stall '+name);
      const a=s.actor===seat?POL[name](s):botAction(s,'standard');
      s=transition(s,a);
    }
    const sc=s.result.scores;
    rows.push({scriptWin:s.result.winner===seat,margin:sc[seat].total-sc[1-seat].total,script:sc[seat].total,rival:sc[1-seat].total});
  }
  const w=rows.filter(r=>r.scriptWin).length;
  const avg=k=>(rows.reduce((t,r)=>t+r[k],0)/rows.length).toFixed(1);
  all[name]={games:rows.length,scriptWins:w,meanMargin:Number(avg('margin')),scriptVP:Number(avg('script')),rivalVP:Number(avg('rival'))};
  console.log(name,JSON.stringify(all[name]));
}
