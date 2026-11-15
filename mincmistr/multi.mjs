// Mechanical robustness: 3- and 4-player games with Mincmistrs in several seats.
import {createGame,transition} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {checkPolicy} from './policies.mjs';
import {createMincmistr,mincmistrAction,mincmistrCardsThisTurn} from './mincmistr.mjs';
const count=Number(process.argv[2]), games=Number(process.argv[3]??6), level=process.argv[4]??'journeyman', opp=checkPolicy(process.argv[5]??'quick');
let tot=[], wins=0, stalls=0;
for (let i=0;i<games;i++) {
  let s=createGame({seed:`mp${count}-${i}`,playerCount:count,setup:1+i%9,side:i%count,starter:i%count});
  const ms=new Map(); for (let k=1;k<count;k++) ms.set(k,createMincmistr(s,k,level)); // seat 0 = bot standing in for the human
  let steps=0;
  while (s.phase!=='end') {
    if (++steps>3000) { stalls++; break; }
    const m=ms.get(s.actor);
    if (m) { const e=mincmistrCardsThisTurn(s,m); if (e) s.left=e; }
    const a=m?mincmistrAction(s,m):botAction(s,opp);
    if (!a) throw Error(`no action seed ${s.seed} actor ${s.actor} pending ${JSON.stringify(s.pending[0])}`);
    s=transition(s,a);
  }
  if (s.result) { tot.push(s.result.scores.map(x=>x.total)); if (s.result.winner===0) wins++; }
}
const avg=k=>(tot.reduce((t,r)=>t+r[k],0)/tot.length).toFixed(1);
console.log(`${count}p ${level} x${count-1} vs ${opp}: games ${tot.length} stalls ${stalls} | ${opp} avg ${avg(0)} | Mincmistr avgs ${[...Array(count-1)].map((_,k)=>avg(k+1)).join(', ')} | ${opp} wins ${wins}`);
