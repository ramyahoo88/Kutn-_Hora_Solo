// Paired experiments on the latest engine. node exp/expsim.mjs <players> <levelSpec> <bot> <seeds> <groups,comma> <out>
// levelSpec: base level or extra:R.R.R, then optional +jf (Joker finish, always), +jfc (Joker finish on 2 extra cards), +ys (yellow set).
import {appendFileSync} from 'node:fs';
import {createGame,transition,createPlanDeck} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
import {checkPolicy} from '../policies.mjs';
import {createMincmistr,mincmistrAction,mincmistrCardsThisTurn} from './mincmistr_exp.mjs';
const [players,spec,bot,seeds,groups,out]=[Number(process.argv[2]),process.argv[3],checkPolicy(process.argv[4]),Number(process.argv[5]),process.argv[6].split(','),process.argv[7]];
const [baseSpec,...flagNames]=spec.split('+');
const flags={}; for (const f of flagNames) { if (f==='jf') flags.jokerFinish='all'; else if (f==='jfc') flags.jokerFinish='cards'; else if (f==='ys') flags.yellowSet=true; else if (f==='sd') flags.sharedDeck=true; else throw Error(`flag ${f}`); }
for (const group of groups) {
  const rows=[];
  for (let i=0;i<seeds;i++) for (let focus=0;focus<players;focus++) {
    let s=createGame({seed:`${group}-${i}`,playerCount:players,setup:1+i%9,side:i%2,starter:i%players});
    const mm=new Map();
    const shared=flags.sharedDeck?createPlanDeck(s.seed,'shared'):null;
    for (let k=0;k<players;k++) if (k!==focus) {
      // 'extra:R.R' = Journeyman with the double last turn in those rounds; 'apprentice@R.R' = any level with those rounds.
      const custom=baseSpec.startsWith('extra:'), [lvl,rounds]=baseSpec.split('@');
      const m=createMincmistr(s,k,custom?'journeyman':lvl,flags);
      if (custom) m.settings={...m.settings,extraCard:baseSpec.slice(6).split('.').map(Number)};
      if (rounds!==undefined) m.settings={...m.settings,extraCard:rounds?rounds.split('.').map(Number):[]};
      if (shared) m.sharedDeck=shared;
      mm.set(k,m);
    }
    let steps=0;
    while (s.phase!=='end') {
      if (++steps>6000) throw Error(`stall ${s.seed}`);
      const m=mm.get(s.actor);
      if (m) { const e=mincmistrCardsThisTurn(s,m); if (e) s.left=e; }
      s=transition(s,m?mincmistrAction(s,m):botAction(s,bot));
    }
    const tot=s.result.scores.map(x=>x.total);
    const tallies={}; for (const m of mm.values()) for (const [k,v] of Object.entries(m.stats.rules)) if (/finish|yellow/.test(k)) tallies[k]=(tallies[k]??0)+v;
    rows.push({focus,winner:s.result.winner,tot,tallies,town:s.result.scores.map(x=>x.town),coins:s.players.map(p=>p.coins)});
  }
  appendFileSync(out,JSON.stringify({players,spec,bot,group,rows})+'\n');
}
