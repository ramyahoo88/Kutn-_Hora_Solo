// Decision-by-decision equivalence: lab automa (base.json) vs clean mincmistr.mjs.
import {readFileSync} from 'node:fs';
import {createGame,transition,actionKey} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {createMemory,automaAction,DEFAULT} from './automa.mjs';
import {createMincmistr,mincmistrAction,mincmistrCardsThisTurn} from './mincmistr.mjs';
const base=JSON.parse(readFileSync(new URL('./base.json',import.meta.url)));
const level=process.argv[2]??'journeyman'; const n=Number(process.argv[3]??24); const group=process.argv[4]??'eq';
const levelCfg={apprentice:{plotTie:'arrow',buildTie:'arrow',minePlace:'spread'},journeyman:{},master:{privilege:{extraCard:[4,5,6]}},grandmaster:{privilege:{extraCard:[1,2,3,4,5,6]}}}[level];
const cfg={...DEFAULT,...base,...levelCfg};
let decisions=0, mismatches=0; const examples=[];
for (let i=0;i<n;i++) for (const seat of [0,1]) {
  let s=createGame({seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  const lab=createMemory(s,seat,cfg), clean=createMincmistr(s,seat,level);
  while (s.phase!=='end') {
    if (s.actor===seat) {
      const extra=mincmistrCardsThisTurn(s,clean);
      const ec=cfg.privilege?.extraCard; let labExtra=null;
      if (ec && s.phase==='action' && !s.pending.length && s.turn>=4 && s.left===1 && ec.includes(s.round)) { let h=s.players[seat].hand,c=0; while(h){c+=h&1;h>>=1;} if (c===2) labExtra=2; }
      if (extra!==labExtra) { mismatches++; examples.push({seed:s.seed,round:s.round,turn:s.turn,why:'extra',extra,labExtra}); }
      if (extra) s.left=extra;
      const a=automaAction(s,lab), b=mincmistrAction(s,clean);
      decisions++;
      if (actionKey(a)!==actionKey(b)) { mismatches++; if (examples.length<5) examples.push({seed:s.seed,round:s.round,turn:s.turn,pending:s.pending[0]?.kind,lab:a,clean:b}); }
      s=transition(s,a);
    } else s=transition(s,botAction(s,'standard'));
  }
}
console.log(level,'decisions',decisions,'mismatches',mismatches);
for (const e of examples) console.log(JSON.stringify(e));
