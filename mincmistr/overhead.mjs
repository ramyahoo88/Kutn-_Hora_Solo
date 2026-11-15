// Count the work a person does for the Mincmistr per game: decisions with real comparisons.
import {createGame,transition,legalActions} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {BUILDINGS} from '../src/data.mjs';
import {createMincmistr,mincmistrAction} from './mincmistr.mjs';
const level=process.argv[2]??'journeyman', games=Number(process.argv[3]??12);
const T={}; const add=(k,v=1)=>T[k]=(T[k]??0)+v;
for (let i=0;i<games;i++) for (const seat of [0,1]) {
  let s=createGame({seed:`oh-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  const m=createMincmistr(s,seat,level);
  while (s.phase!=='end') {
    if (s.actor===seat) {
      const a=mincmistrAction(s,m);
      const opts=legalActions(s).filter(x=>x.kind===a.kind && x.card===a.card && !x.as);
      if (s.phase==='tax') add('tax decisions');
      else if (!s.pending.length) add('card plays');
      else add('bonus steps');
      if (a.kind==='plot') { add('plot choices'); add('plot options',new Set(opts.map(x=>x.space)).size); add('town-point checks',new Set(opts.map(x=>x.space)).size*s.players[seat].held.length); }
      if (a.kind==='build') { add('build choices'); add('build options',opts.length); }
      if (a.kind==='rights') { add('rights choices'); add('rights candidates',opts.filter(x=>!BUILDINGS[x.id].public).length); }
      if (a.kind==='place-mine'||a.kind==='technology') { add('mine placements'); }
      if (a.kind==='income') { add('income'); if (Object.values(s.patrons).some(v=>v>0)) add('income with patrician available (edge check)'); if (a.color) add('patrician seated'); }
      if (a.kind==='barbara') add('St. Barbara');
      s=transition(s,a);
    } else s=transition(s,botAction(s,'quick'));
  }
}
const g=2*games;
for (const [k,v] of Object.entries(T)) console.log(k.padEnd(46),(v/g).toFixed(1));
