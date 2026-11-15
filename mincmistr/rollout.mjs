// Value of the Standard rival's suggestion at each Mincmistr card play, measured by paired rollouts.
// node rollout.mjs <group> <from> <to> <out>
import {appendFileSync} from 'node:fs';
import {createGame,transition,actionKey,plotCount} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {createMincmistr,mincmistrAction} from './mincmistr.mjs';
const [group,from,to,out]=[process.argv[2],Number(process.argv[3]),Number(process.argv[4]),process.argv[5]];
const kindOf=a=>a.as?`J-${a.as}`:a.kind==='income'&&a.color?'income+seat':a.kind;
function finish(s, m, seat) {
  while (s.phase!=='end') s=transition(s,s.actor===seat?mincmistrAction(s,m):botAction(s,'standard'));
  const sc=s.result.scores; return sc[seat].total-sc[1-seat].total;
}
for (let i=from;i<to;i++) for (const seat of [0,1]) {
  let s=createGame({seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  const m=createMincmistr(s,seat,'journeyman');
  while (s.phase!=='end') {
    if (s.actor===seat && s.phase==='action' && !s.pending.length) {
      const m0=structuredClone(m);
      const a=mincmistrAction(s,m);
      const b=botAction(s,'standard');
      if (actionKey(a)!==actionKey(b)) {
        const rule=Object.keys(m.stats.rules).find(k=>m.stats.rules[k]!==(m0.stats.rules[k]??0));
        const mA=structuredClone(m), mB=structuredClone(m);
        const vA=finish(transition(s,a),mA,seat), vB=finish(transition(s,b),mB,seat);
        const p=s.players[seat];
        appendFileSync(out,JSON.stringify({g:`${group}-${i}`,seat,round:s.round,rule,ka:kindOf(a),kb:kindOf(b),coins:p.coins,held:p.held.length,plots:plotCount(s,seat),pel:p.pelicans,pool:p.pool,d:vB-vA})+'\n');
      }
      s=transition(s,a);
    } else s=transition(s,s.actor===seat?mincmistrAction(s,m):botAction(s,'standard'));
  }
}
