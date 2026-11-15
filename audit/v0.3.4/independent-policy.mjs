import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,transition,legalActions,applyKnownAction,copyState,scoreBreakdown,patricianBase,income,taxCost,mineRow,plotCount,actionKey,rulesFor} from '../../src/engine.mjs';
import {MINES,BUILDINGS,REP_SCORE} from '../../src/data.mjs';
import {botAction,publicPlanningState} from '../../src/bot.mjs';
import {checkGame,writeSave} from '../../src/save.mjs';
// Independent short-horizon policies. Shares the legal engine and visibility filter,
// but does not call the rival evaluator or use its policy multipliers.
function value(g,s,policy){
 const p=g.players[s],b=scoreBreakdown(g,s),others=g.players.map((_,i)=>i).filter(i=>i!==s),o=others.map(i=>scoreBreakdown(g,i)).sort((a,b)=>b.total-a.total)[0],base=patricianBase(g,s);
 const end=rulesFor(g).rounds,remaining=end-g.round,rounds=end+1-Math.max(end-2,g.round),gross=income(g,s);
 let v=b.total-o.total*0.65;
 v+=Math.min(gross,28)*remaining*0.19;
 v+=Math.min(p.coins,35)*(.10+remaining*.025)-Math.max(0,10-p.coins)*.25;
 v+=Object.keys(base).reduce((n,c)=>n+base[c]*g.council[c]*(rounds-1),0);
 v+=p.held.reduce((n,id)=>{const t=BUILDINGS[id];return n+(remaining?(.3+t.production*.2||.8):0)},0);
 if(remaining && p.held.length && plotCount(g,s))v+=2;
 v+=Math.min(p.pelicans,3)*.9*Number(remaining>0)+(p.rep>=3?remaining*.3:0);
 if(policy==='industry')v+=Math.min(gross,40)*remaining*.25+(p.held.length&&plotCount(g,s)?2:0);
 if(policy==='mining')v+=b.mines*.65+[0,1,2,3].reduce((n,r)=>n+Math.min(1,mineRow(g,r).count[s])*.7*remaining,0);
 if(policy==='council')v+=Object.keys(base).reduce((n,c)=>n+base[c]*(g.council[c]*rounds*.6+Math.min(1,g.patrons[c])*.5),0)+Math.min(p.pelicans,4)*1.2+p.usedPelicans*.3;
 if(policy==='blockade')v-=o.total*.65+Math.max(...others.map(i=>income(g,i)))*remaining*.3;
 v-=Math.max(0,plotCount(g,s)-p.held.length-1)*1.1;
 return v;
}
export function independent(g,policy){
 const seat=g.actor,root=publicPlanningState(g,3),opts=legalActions(g);
 if(g.phase==='tax'){
  const pay=opts.find(a=>a.kind==='tax'),lose=opts.find(a=>a.kind==='penalty');if(!pay)return lose;
  if(g.round===rulesFor(g).rounds){const p=g.players[seat];const benefit=(REP_SCORE[p.rep]??0)-(REP_SCORE[Math.max(-5,p.rep-lose.loss)]??0)+2*Math.max(0,lose.loss-5-p.rep);return benefit>0?pay:lose;}
  return opts.map(a=>({a,v:value(transition(g,a),seat,policy)})).sort((a,b)=>b.v-a.v)[0].a;
 }
 let beam=[{g:root,first:null,spent:0}],done=[];
 // Two basic actions, or one remaining action, then all resulting bonuses.
 const target=Math.min(g.left,2);
 for(let depth=0;depth<14&&beam.length;depth++){
  const next=[];
  for(const node of beam){
   if(node.spent>=target&&!node.g.pending.length&&node.first){done.push({...node,v:value(node.g,seat,policy)});continue;}
   for(const a of legalActions(node.g)){
    const c=copyState(node.g,false),pending=c.pending.length;applyKnownAction(c,a,true);
    next.push({g:c,first:node.first??a,spent:node.spent+Number(!pending),v:value(c,seat,policy)-(a.kind==='skip'?.05:0)});
   }
  }
  beam=next.sort((a,b)=>b.v-a.v).slice(0,6);
 }
 const chosen=(done.sort((a,b)=>b.v-a.v)[0]??beam.sort((a,b)=>b.v-a.v)[0])?.first;
 return opts.find(a=>actionKey(a)===actionKey(chosen??{}))??opts[0];
}
