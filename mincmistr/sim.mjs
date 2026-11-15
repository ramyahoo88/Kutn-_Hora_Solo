// Automa vs opponent policies on matched seeds, both seats, rotating starters (2 players).
import {createGame,transition,plotCount} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {createMemory,automaAction,DEFAULT} from './automa.mjs';
import {checkPolicy} from './policies.mjs';

export function playGame({seed,setup,side,starter,automaSeat,opponent,config=DEFAULT,playerCount=2}) {
  if (typeof opponent!=='function') checkPolicy(opponent);
  let s=createGame({seed,setup,side,starter,playerCount});
  const mems=new Map();
  for (let seat=0;seat<playerCount;seat++) if (seat===automaSeat || (Array.isArray(automaSeat)&&automaSeat.includes(seat))) mems.set(seat,createMemory(s,seat,config));
  let steps=0;
  while (s.phase!=='end') {
    if (++steps>800) throw Error(`stall ${seed}`);
    const mem=mems.get(s.actor);
    const ec=config.privilege?.extraCard;
    if (mem && ec && s.phase==='action' && !s.pending.length && s.turn>=2*playerCount && s.left===1 && ec.includes(s.round)) {
      let h=s.players[s.actor].hand, c=0; while (h) { c+=h&1; h>>=1; }
      if (c===2) s.left=2;
    }
    const a=mem ? automaAction(s,mem) : (typeof opponent==='function'?opponent(s):botAction(s,opponent));
    if (!a) throw Error(`no action ${seed} r${s.round} t${s.turn} actor ${s.actor} pending ${JSON.stringify(s.pending[0])}`);
    const actor=s.actor, phase=s.phase, pend=s.pending[0]?.kind;
    s=transition(s,a);
    if (mem && config.privilege) applyPrivilege(s,actor,a,phase,pend,config.privilege);
  }
  return {state:s,mems};
}

// Difficulty privileges, applied as rule exceptions after the automa's action resolves.
export function applyPrivilege(s, seat, a, phase, pend, priv) {
  const p=s.players[seat];
  if (priv.income && a.kind==='income') p.coins+=priv.income;
  if (priv.freePlots && a.kind==='plot') p.coins+=a.cost;
  if (priv.freeMines && (a.kind==='place-mine')) p.coins+=a.cost;
  if (priv.freeRefill && a.kind==='mine' && a.refill) p.coins+=a.cost;
  if (priv.taxRelief && phase==='tax' && a.kind==='tax') p.coins+=Math.floor(a.cost*priv.taxRelief);
  if (priv.freeSeat && a.kind==='income' && a.color) p.coins+=10;
  if (priv.rightsDiscount && a.kind==='rights') p.coins+=Math.min(a.cost,priv.rightsDiscount);
}
export function evaluate({games=24,group='mx',opponent='standard',config=DEFAULT,quiet=false}={}) {
  const rows=[];
  for (let i=0;i<games;i++) for (const seat of [0,1]) {
    const opts={seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2,automaSeat:seat,opponent,config};
    const {state,mems}=playGame(opts);
    const sc=state.result.scores, mem=mems.get(seat), p=state.players[seat];
    rows.push({win:state.result.winner===seat,draw:state.result.winner===null,margin:sc[seat].total-sc[1-seat].total,vp:sc[seat].total,opp:sc[1-seat].total,
      parts:sc[seat],oppParts:sc[1-seat],rep:p.rep,coins:p.coins,oppCoins:state.players[1-seat].coins,held:p.held.length,plots:plotCount(state,seat),houses:p.houses.reduce((a,b)=>a+b,0),
      stats:mem.stats,mines:state.mine.filter(c=>c?.owner===seat).length,council:state.council});
  }
  const n=rows.length, avg=k=>rows.reduce((t,r)=>t+(typeof k==='function'?k(r):r[k]),0)/n;
  const sd=Math.sqrt(rows.reduce((t,r)=>t+(r.margin-avg('margin'))**2,0)/(n-1));
  const out={games:n,wins:rows.filter(r=>r.win).length,draws:rows.filter(r=>r.draw).length,margin:+avg('margin').toFixed(2),se:+(sd/Math.sqrt(n)).toFixed(2),
    vp:+avg('vp').toFixed(1),oppVP:+avg('opp').toFixed(1),
    parts:Object.fromEntries(['earned','town','mines','income','reputation','extras'].map(k=>[k,+avg(r=>r.parts[k]).toFixed(1)])),
    oppParts:Object.fromEntries(['earned','town','mines','income','reputation','extras'].map(k=>[k,+avg(r=>r.oppParts[k]).toFixed(1)])),
    rep:+avg('rep').toFixed(1),coinsLeft:+avg('coins').toFixed(1),oppCoinsLeft:+avg('oppCoins').toFixed(1),heldLeft:+avg('held').toFixed(2),plotsLeft:+avg('plots').toFixed(2),
    buildings:+avg('houses').toFixed(1),mines:+avg('mines').toFixed(1),skips:+avg(r=>r.stats.skips).toFixed(2),jokers:+avg(r=>r.stats.jokers).toFixed(2),
    checksPerCard:+(avg(r=>r.stats.checks)/avg(r=>r.stats.cards)).toFixed(2)};
  if (!quiet) console.log(JSON.stringify(out));
  return {out,rows};
}

if (import.meta.url===`file://${process.argv[1]}`) {
  const games=Number(process.argv[2]??12), opponent=process.argv[3]??'standard';
  evaluate({games,opponent,group:process.argv[4]??'mx'});
}
