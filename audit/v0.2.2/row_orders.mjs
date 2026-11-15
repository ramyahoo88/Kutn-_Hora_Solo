// Does the rival's random house-row order change its strength? Matched seeds; seat 0 = Standard
// with printed rows (stand-in for a human), seat 1 = Standard rival with each of its six orders.
import {createGame,transition} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
import {GUILD_SETUPS,GUILDS} from '../../src/data.mjs';
const n=Number(process.argv[2]??24), group=process.argv[3]??'row-order';
const perms=a=>a.flatMap(x=>a.filter(y=>y!==x).map(y=>[x,y,a.find(z=>z!==x&&z!==y)]));
const byRank=[[],[],[],[],[],[]]; let seededMargins=[], bestGap=[];
const byRepGuild={};
for (let i=0;i<n;i++) {
  const setup=1+i%9, side=i%2, starter=(i>>1)%2;
  const seed=`${group}-${i}`;
  const base=createGame({seed,setup,side,starter});
  const seeded=base.players[1].guilds.join('/');
  const rows=perms(GUILD_SETUPS[setup][1-side]).map(order=>{
    let s=createGame({seed,setup,side,starter,orders:[GUILD_SETUPS[setup][side],order]});
    while (s.phase!=='end') s=transition(s,botAction(s,'standard'));
    const m=s.result.scores[1].total-s.result.scores[0].total;
    (byRepGuild[order[2]]??=[]).push(m);
    return {order:order.join('/'),m};
  });
  rows.sort((a,b)=>b.m-a.m);
  rows.forEach((r,k)=>byRank[k].push(r.m));
  const sm=rows.find(r=>r.order===seeded).m;
  seededMargins.push(sm); bestGap.push(rows[0].m-sm);
}
const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2);
console.log('rival margin by rank of its six orders (best..worst):',byRank.map(avg).join(' | '));
console.log('seeded order mean margin',avg(seededMargins),'| mean gap to best order',avg(bestGap),'| seeds',n);
console.log('mean rival margin by guild in the reputation row:',Object.fromEntries(Object.entries(byRepGuild).map(([k,v])=>[GUILDS[k],`${avg(v)} (n=${v.length})`])));
