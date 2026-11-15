// Multi-player tests. node mincmistr/multisim.mjs <mode> <players> <level> <bot> <seeds> <groups,comma> <out>
//  mode 'solo': one bot (stand-in for you) vs players-1 Mincmistrs; the bot's seat rotates through every seat.
//  mode 'table': one Mincmistr vs players-1 bots; the Mincmistr's seat rotates through every seat.
import {appendFileSync} from 'node:fs';
import {createGame,transition} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {createMincmistr,mincmistrAction,mincmistrCardsThisTurn} from './mincmistr.mjs';
const [mode,players,level,bot,seeds,groups,out]=[process.argv[2],Number(process.argv[3]),process.argv[4],process.argv[5],Number(process.argv[6]),process.argv[7].split(','),process.argv[8]];
for (const group of groups) {
  const rows=[];
  for (let i=0;i<seeds;i++) for (let focus=0;focus<players;focus++) {
    let s=createGame({seed:`${group}-${i}`,playerCount:players,setup:1+i%9,side:i%2,starter:i%players});
    const mm=new Map();
    for (let k=0;k<players;k++) if ((mode==='solo')===(k!==focus)) mm.set(k,createMincmistr(s,k,level));
    let steps=0;
    while (s.phase!=='end') {
      if (++steps>5000) throw Error(`stall ${s.seed}`);
      const m=mm.get(s.actor);
      if (m) { const e=mincmistrCardsThisTurn(s,m); if (e) s.left=e; }
      s=transition(s,m?mincmistrAction(s,m):botAction(s,bot));
    }
    const tot=s.result.scores.map(x=>x.total);
    rows.push({focus,starter:i%players,winner:s.result.winner,tot});
  }
  appendFileSync(out,JSON.stringify({mode,players,level,bot,group,rows})+'\n');
}
