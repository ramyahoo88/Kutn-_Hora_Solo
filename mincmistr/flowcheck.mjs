// Independent check of rule 4 (card-play flow), written from the rulebook text, against mincmistr.mjs tallies.
import {createGame,transition,legalActions,plotCount} from '../src/engine.mjs';
import {CARDS} from '../src/data.mjs';
import {botAction} from '../src/bot.mjs';
import {createMincmistr,mincmistrAction,ROW} from './mincmistr.mjs';
const PRIZE=[6,7,8,9,11];
let plays=0, bad=0; const ex=[];
const has=(s,seat,kind)=>{ // a card in the row shows the action and it is legal now (rule 2)
  const card=ROW.find(c=>(s.players[seat].hand&(1<<c))&&CARDS[c].includes(kind));
  return card!==undefined && legalActions(s).some(a=>a.kind===kind&&!a.as&&a.card===card);
};
for (let i=0;i<20;i++) for (const seat of [0,1]) {
  let s=createGame({seed:`fc-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  const m=createMincmistr(s,seat,'journeyman');
  while (s.phase!=='end') {
    if (s.actor===seat && s.phase==='action' && !s.pending.length) {
      const before={...m.stats.rules}; const p=s.players[seat];
      const a=mincmistrAction(s,m);
      const fired=Object.keys(m.stats.rules).find(k=>m.stats.rules[k]!==(before[k]??0));
      // expected from the text
      let exp;
      if (p.coins<20 && has(s,seat,'income')) exp='cash';
      else if ((p.pelicans>=2 || (p.pelicans>=1 && PRIZE.includes(Math.min(s.barbara,12)))) && has(s,seat,'barbara')) exp='pelicans';
      else exp=fired.startsWith('goal:')||fired.startsWith('fallback')||fired==='discard'?fired:'?';
      // for goals: the fired goal must be on the card, and every earlier goal must have produced nothing
      plays++;
      if (exp!==fired) { bad++; if (ex.length<5) ex.push({seed:s.seed,round:s.round,coins:p.coins,pel:p.pelicans,tile:s.barbara,exp,fired}); }
      if (fired.startsWith('goal:') && !m.card.goals.includes(fired.slice(5))) { bad++; ex.push({why:'goal not on card',fired,card:m.card}); }
      if (fired==='goal:M' && a.kind!=='mine') bad++;
      if (fired==='cash' && a.kind!=='income') bad++;
      if (fired==='pelicans' && a.kind!=='barbara') bad++;
      if (a.as) { bad++; ex.push({why:'joker used'}); }
      s=transition(s,a);
    } else s=transition(s,s.actor===seat?mincmistrAction(s,m):botAction(s,'quick'));
  }
}
console.log('card plays',plays,'flow mismatches',bad); for (const e of ex) console.log(JSON.stringify(e));
