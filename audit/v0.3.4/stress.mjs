import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createGame,legalActions,transition,copyState,applyKnownAction,actionKey,rulesFor,finalResult} from '../../src/engine.mjs';
import {checkGame,readSave,writeSave} from '../../src/save.mjs';
import {botAction} from '../../src/bot.mjs';
import {playMincmistr} from '../../src/mincmistr.mjs';
import {MINES} from '../../src/data.mjs';
let rng=184034;const rand=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%n;};
const stats={games:0,steps:0,previews:0,previewBoundaryExcluded:0,hidden:{},maxPending:0,pendingKinds:{},reshuffles:0,maxTax:0,maxPop:0,maxOre:0,maxTechnology:0,results:[]};
const view=s=>JSON.stringify([s.players,s.pop,s.ore,s.tax,s.arms,s.barbara,s.patrons,s.council,s.bank,s.city,s.mine,s.pending,s.technology]);
function hidden(s){const t=structuredClone(s);t.rng=(t.rng^0x61fa0142)>>>0;
 t.mineDeck=t.mineMixed?t.mineDeck.reverse():[1,2,3].flatMap(k=>t.mineDeck.filter(id=>MINES[id].tier===k).reverse());
 for(const row of t.market)for(const stack of row)stack.tiles=[stack.tiles[0],...stack.tiles.slice(1,-1).reverse(),...(stack.tiles.length>1?[stack.tiles.at(-1)]:[])];
 const rr=rulesFor(t).redRound;if(t.round<=rr)t.red.reverse();
 t.events=[...t.events.slice(0,t.round),...t.events.slice(t.round,rr).reverse(),...t.events.slice(Math.max(t.round,rr)).reverse()];
 return t;}
for(const n of [2,3,4])for(let i=0;i<80;i++){
 const digital=i>=60,level=['apprentice','journeyman','master','grandmaster'][i%4];
 const seed=`astra034-stress-${n}-${i}`;
 let s=createGame({seed,playerCount:n,setup:1+i%9,side:i%n,starter:(i>>1)%n,events:i%2===0,difficulty:digital?'mincmistr':'standard',mincmistr:{level,shared:i%2===0,tougher:n===3&&level==='master'&&i%8===2}});
 let step=0;
 while(s.phase!=='end'){
  assert.ok(++step<450,seed);checkGame(s);
  assert.deepEqual(readSave(writeSave(s)),s);
  const before=writeSave(s),opts=legalActions(s);
  if(step%4===0)for(const a of opts){
   const preview=copyState(s,false);applyKnownAction(preview,a,true);const real=transition(s,a);
   if(real.round!==s.round||real.phase!==s.phase){stats.previewBoundaryExcluded++;continue;}
   assert.equal(view(preview),view(real),`${seed}: preview ${actionKey(a)}`);stats.previews++;
  }
  if(i<9&&step%17===0)for(const policy of ['quick','standard','planner']){
   const a=botAction(s,policy),b=botAction(hidden(s),policy);assert.equal(actionKey(a),actionKey(b),`${seed}: hidden ${policy}`);
   stats.hidden[policy]=(stats.hidden[policy]??0)+1;
  }
  let next;
  if(digital&&s.actor!==0)next=playMincmistr(s);
  else {const useful=opts.filter(a=>a.kind!=='skip');const pool=useful.length&&rand(10)<9?useful:opts;next=transition(s,pool[rand(pool.length)]);}
  assert.equal(writeSave(s),before,'input mutation');checkGame(next);
  if(!s.mineMixed&&next.mineMixed)stats.reshuffles++;
  s=next;stats.steps++;stats.maxPending=Math.max(stats.maxPending,s.pending.length);
  for(const p of s.pending)stats.pendingKinds[p.kind]=(stats.pendingKinds[p.kind]??0)+1;
  stats.maxTax=Math.max(stats.maxTax,s.tax);stats.maxPop=Math.max(stats.maxPop,s.pop);stats.maxOre=Math.max(stats.maxOre,s.ore);stats.maxTechnology=Math.max(stats.maxTechnology,s.technology);
 }
 assert.equal(s.round,n===4?5:6);assert.deepEqual(s.result,finalResult(s));
 stats.games++;stats.results.push({seed,players:n,digital,level,steps:step,scores:s.result.scores.map(p=>p.total),winners:s.result.winners});
}
writeFileSync(new URL('./results/stress.json',import.meta.url),JSON.stringify(stats,null,2));
console.log(JSON.stringify({...stats,results:undefined}));
