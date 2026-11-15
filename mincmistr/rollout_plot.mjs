// Targeted rollouts: same action kind (plot/build), different choice. Logs features of both choices.
import {appendFileSync} from 'node:fs';
import {createGame,transition,actionKey,cityPointsAt,rulesFor} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {createMincmistr,mincmistrAction} from './mincmistr.mjs';
const [group,from,to,out]=[process.argv[2],Number(process.argv[3]),Number(process.argv[4]),process.argv[5]];
function finish(s,m,seat){ while (s.phase!=='end') s=transition(s,s.actor===seat?mincmistrAction(s,m):botAction(s,'standard')); const sc=s.result.scores; return sc[seat].total-sc[1-seat].total; }
const pts=(s,space,id)=>{const city=structuredClone(s.city); city[space]={id,owner:0}; return cityPointsAt({...s,city},space);};
const pubN=(s,space)=>rulesFor(s).board.neighbours[space].filter(i=>s.city[i]?.id&&s.city[i].owner===null).length;
const anyN=(s,space)=>rulesFor(s).board.neighbours[space].filter(i=>s.city[i]?.id).length;
for (let i=from;i<to;i++) for (const seat of [0,1]) {
  let s=createGame({seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  const m=createMincmistr(s,seat,'journeyman');
  while (s.phase!=='end') {
    if (s.actor===seat && s.phase==='action' && !s.pending.length) {
      const a=mincmistrAction(s,m); const b=botAction(s,'standard');
      if ((a.kind==='plot'||a.kind==='build') && b.kind===a.kind && !b.as && actionKey(a)!==actionKey(b)) {
        const held=s.players[seat].held;
        const f=x=>({cost:x.cost,space:x.space,id:x.id,dots:x.kind==='plot'?Math.max(0,...held.map(h=>pts(s,x.space,h))):pts(s,x.space,x.id),pub:pubN(s,x.space),nb:anyN(s,x.space)});
        const vA=finish(transition(s,a),structuredClone(m),seat), vB=finish(transition(s,b),structuredClone(m),seat);
        appendFileSync(out,JSON.stringify({kind:a.kind,round:s.round,A:f(a),B:f(b),d:vB-vA})+'\n');
      }
      s=transition(s,a);
    } else s=transition(s,s.actor===seat?mincmistrAction(s,m):botAction(s,'standard'));
  }
}
