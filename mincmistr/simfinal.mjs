// Final evaluation with the clean rules module. node simfinal.mjs <level> <opp1,opp2> <games> <groups,comma> <outfile>
import {appendFileSync} from 'node:fs';
import {createGame,transition,plotCount} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {checkPolicy} from './policies.mjs';
import {createMincmistr,mincmistrAction,mincmistrCardsThisTurn} from './mincmistr.mjs';
export function play({seed,setup,side,starter,seat,level,opponent}) {
  let s=createGame({seed,setup,side,starter});
  const custom=level.startsWith('extra:');
  const m=createMincmistr(s,seat,custom?'journeyman':level);
  if (custom) m.settings={...m.settings,extraCard:level.slice(6).split('.').map(Number)};
  let decisions=0, ms=0;
  while (s.phase!=='end') {
    if (s.actor===seat) {
      const extra=mincmistrCardsThisTurn(s,m); if (extra) s.left=extra;
      const t0=performance.now(); const a=mincmistrAction(s,m); ms+=performance.now()-t0; decisions++;
      s=transition(s,a);
    } else s=transition(s,botAction(s,opponent));
  }
  return {s,m,decisions,ms};
}
if (import.meta.url===`file://${process.argv[1]}`) {
  const [level,opps,games,groups,out]=[process.argv[2],process.argv[3].split(',').map(checkPolicy),Number(process.argv[4]),process.argv[5].split(','),process.argv[6]];
  for (const opponent of opps) for (const group of groups) {
    const rows=[];
    for (let i=0;i<games;i++) for (const seat of [0,1]) {
      const {s,m}=play({seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2,seat,level,opponent});
      const sc=s.result.scores;
      rows.push({margin:sc[seat].total-sc[1-seat].total,win:s.result.winner===seat?1:0,draw:s.result.winner===null?1:0,vp:sc[seat].total,opp:sc[1-seat].total,
        parts:sc[seat],oppParts:sc[1-seat],starter:(i>>1)%2===seat?1:0,cards:m.stats.cards,checks:m.stats.checks,rules:m.stats.rules});
    }
    appendFileSync(out,JSON.stringify({level,opponent,group,rows})+'\n');
  }
}
