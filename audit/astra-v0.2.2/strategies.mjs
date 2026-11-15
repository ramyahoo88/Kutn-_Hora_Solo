import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,transition,legalActions,applyKnownAction,copyState,scoreBreakdown,patricianBase,income,taxCost,mineRow,plotCount,actionKey} from '../../src/engine.mjs';
import {MINES,BUILDINGS,REP_SCORE} from '../../src/data.mjs';
import {botAction,publicPlanningState} from '../../src/bot.mjs';
import {checkGame,writeSave} from '../../src/save.mjs';
// Independent short-horizon policies. Shares the legal engine and visibility filter,
// but does not call the rival evaluator or use its policy multipliers.
function value(g,s,policy){
 const p=g.players[s],q=g.players[1-s],b=scoreBreakdown(g,s),o=scoreBreakdown(g,1-s),base=patricianBase(g,s);
 const remaining=6-g.round, rounds=7-Math.max(4,g.round),gross=income(g,s);
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
 if(policy==='blockade')v-=o.total*.65+income(g,1-s)*remaining*.3;
 v-=Math.max(0,plotCount(g,s)-p.held.length-1)*1.1;
 return v;
}
function independent(g,policy){
 const seat=g.actor,root=publicPlanningState(g,3),opts=legalActions(g);
 if(g.phase==='tax'){
  const pay=opts.find(a=>a.kind==='tax'),lose=opts.find(a=>a.kind==='penalty');if(!pay)return lose;
  if(g.round===6){const p=g.players[seat];const benefit=(REP_SCORE[p.rep]??0)-(REP_SCORE[Math.max(-5,p.rep-lose.loss)]??0)+2*Math.max(0,lose.loss-5-p.rep);return benefit>0?pay:lose;}
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
const records=[],visibility=[];
let checkedStates=0, previewActions=0, boundaryPreviews=0; const previewRounds={};
const semantic = g => JSON.stringify([g.players,g.city,g.mine,g.market,g.marketDiscard,g.mineDeck,g.mineDiscard,g.technology,g.arms,g.pop,g.ore,g.tax,g.barbara,g.patrons,g.bank,g.council,g.pending]);
const policies=['industry','mining','council','blockade'];
for(const group of ['astra-v022-discovery','astra-v022-confirm'])for(const policy of policies)for(let seed=0;seed<9;seed++)for(const rivalSeat of [0,1]){
 let g=createGame({seed:`${group}-${seed}`,setup:seed%9+1,side:seed%2,starter:(seed>>1)%2});let steps=0;const spent={},actions=[{},{}],trace=[];let hiddenChecks=0;
 while(g.phase!=='end'){
  assert.ok(++steps<=240);const seat=g.actor;
  if(g.phase==='action'&&!g.pending.length){const k=`${g.round}/${seat}`;spent[k]=(spent[k]??0)+1;}
  if(policy==='industry'&&seed<2&&g.actor===rivalSeat&&g.phase==='action'){
   const alt=copyState(g);alt.rng=(alt.rng+65431)>>>0;alt.red.reverse();
   const seen=g.round;alt.events=[...g.events.slice(0,seen),...g.events.slice(seen).reverse()];
   alt.mineDeck=g.mineMixed?[...g.mineDeck].reverse():[1,2,3].flatMap(t=>g.mineDeck.filter(id=>MINES[id].tier===t).reverse());
   for(const row of alt.market)for(const stack of row)stack.tiles=[stack.tiles[0],...stack.tiles.slice(1).reverse()];
   assert.equal(actionKey(botAction(g)),actionKey(botAction(alt)));hiddenChecks++;
  }
  const action=seat===rivalSeat?botAction(g):independent(g,policy);
  actions[seat][action.kind]=(actions[seat][action.kind]??0)+1;
  trace.push({round:g.round,actor:seat,pending:g.pending[0]?.kind??null,action});
  // Check preview-equivalent semantic effects for every legal choice in four complete games.
  // Planning deliberately suppresses action/round advancement; boundary results are counted separately.
  if(policy==='industry'&&seed===0){
    for(const option of legalActions(g)){
      const planned=copyState(g);applyKnownAction(planned,option,true);
      const actual=transition(g,option);
      if(g.phase==='action' && actual.phase===g.phase && actual.round===g.round){
        assert.equal(semantic(planned),semantic(actual),`Preview ${g.seed} R${g.round} ${actionKey(option)}`);
        previewActions++;previewRounds[g.round]=(previewRounds[g.round]??0)+1;
      } else boundaryPreviews++;
    }
  }
  g=transition(g,action);checkGame(g);checkedStates++;
 }
 assert.equal(Object.keys(spent).length,12);assert.ok(Object.values(spent).every(v=>v===5));
 const row={group,policy,seed:g.seed,setup:g.setup,side:g.side,starter:Math.floor(seed/2)%2,rivalSeat,steps,winner:g.result.winner,rivalWin:g.result.winner===rivalSeat,draw:g.result.winner===null,margin:g.result.scores[rivalSeat].total-g.result.scores[1-rivalSeat].total,scores:g.result.scores.map(x=>x.total),actions};records.push(row);
 if(hiddenChecks)visibility.push({seed:g.seed,rivalSeat,hiddenChecks});
 if(group==='astra-v022-discovery'&&policy==='industry'&&seed===0&&rivalSeat===0){fs.writeFileSync(new URL('./evidence/representative-trace.json',import.meta.url),JSON.stringify({metadata:row,trace,result:g.result},null,2));fs.writeFileSync(new URL('./evidence/representative-final-save.json',import.meta.url),writeSave(g));}
}
const summary=[];for(const group of ['astra-v022-discovery','astra-v022-confirm'])for(const policy of policies){const set=records.filter(r=>r.group===group&&r.policy===policy);summary.push({group,policy,games:set.length,rivalWins:set.filter(r=>r.rivalWin).length,draws:set.filter(r=>r.draw).length,rivalLosses:set.filter(r=>!r.rivalWin&&!r.draw).length,averageMargin:set.reduce((n,r)=>n+r.margin,0)/set.length});}
const result={summary,records,visibility,checkedStates,previewActions,previewRounds,boundaryPreviews,limits:'Independent policy evaluation, shared transition engine and visibility filter; deterministic short-horizon synthetic opponents, not human strength or an independent rules engine. Seeds cover all nine guild sets, both guild sides and first-player positions; every matchup is seat-swapped. Rival row-order randomization is keyed to setup rather than the evaluated seat. No version-strength comparison is made.'};
fs.writeFileSync(new URL('./evidence/independent-strategies.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({summary,hiddenInfoChecks:visibility.reduce((n,x)=>n+x.hiddenChecks,0),checkedStates,previewActions,previewRounds,boundaryPreviews},null,2));
