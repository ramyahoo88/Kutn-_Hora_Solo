import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,transition,legalActions,mineRow,scoreBreakdown,taxCost,patricianBase,income,price,copyState} from '../../src/engine.mjs';
import {botAction,publicPlanningState} from '../../src/bot.mjs';
import {MINES,ROCK_LAYOUTS,BUILDINGS,CITY,CARDS,GUILD_SETUPS} from '../../src/data.mjs';
import {PRICES,BUILD_DEMAND,CITY_BUILDS} from '../../src/prices.mjs';
import {readSave,writeSave,checkGame} from '../../src/save.mjs';
import {priceOracle,thresholdOracle} from './companion-oracle.mjs';
const out=new URL('./evidence/',import.meta.url);
const put=(name,data)=>fs.writeFileSync(new URL(name,out),typeof data==='string'?data:JSON.stringify(data,null,2));
const tests=[];
function test(name,fn){try{const detail=fn();tests.push({name,passed:true,detail});}catch(e){tests.push({name,passed:false,error:e.message});}}
function pendingMine(id='m3-3'){
  let g=createGame({seed:'audit-mine-III-3',mineLayout:0});
  ROCK_LAYOUTS[0].forEach((space,i)=>g.mine[space].stars=[2,1,1,0][i]);
  g.mineDeck=g.mineDeck.filter(x=>x!==id);g.mineDeck.unshift(id);g.mineMixed=true;
  return transition(g,legalActions(g).find(a=>a.kind==='mine'&&a.card===1&&!a.refill));
}
test('Regression: printed III-3 has two stars and scores its row',()=>{
 const g=pendingMine();checkGame(g);const placed=transition(g,legalActions(g).find(a=>a.kind==='place-mine'&&a.space===1));checkGame(placed);
 assert.equal(MINES['m3-3'].stars,2);assert.equal(mineRow(placed,0).vp[0],4);
 const nearby=pendingMine('m3-2');assert.equal(mineRow(transition(nearby,legalActions(nearby).find(a=>a.kind==='place-mine'&&a.space===1)),0).vp[0],4);
});
test('Independent mine award table: 0/3/4/6/7 stars and ties',()=>{
 const g=createGame();g.mine=Array(20).fill(null);
 const cases=[{stars:[0,0],rock:0,vp:[0,0]},{stars:[1,1],rock:1,vp:[2,2]},{stars:[2,1],rock:1,vp:[4,1]},{stars:[3,3],rock:0,vp:[4,4]},{stars:[4,1],rock:2,vp:[6,2]},{stars:[0,5],rock:2,vp:[0,6]}];
 for(const c of cases){g.mine[0]={id:'m1-1',owner:0,stars:c.stars[0]};g.mine[1]={id:'m1-3',owner:1,stars:c.stars[1]};g.mine[2]={rock:true,stars:c.rock};assert.deepEqual(mineRow(g,0).vp,c.vp);}return {cases:cases.length};
});
test('All nine two-player guild sets agree with CGE companion setup array',()=>{
 const keys={b:'wood',e:'silver',m:'ore',g:'food',s:'permit',i:'beer'};
 const printed=[['emi','bsg'],['egm','bis'],['mbe','gis'],['smb','ieg'],['sgm','bei'],['ism','ebg'],['gmb','sie'],['bim','sge'],['gmi','esb']];
 printed.forEach((pair,i)=>assert.deepEqual(GUILD_SETUPS[i+1],pair.map(s=>[...s].map(k=>keys[k]))));
 return {setups:9,source:'CGE companion main.2dea7b0b.js, ca[setup][2]'};
});
test('All economy table cells and construction thresholds against CGE companion',()=>{
 let cells=0;for(const key of Object.keys(PRICES)){const other=key==='permit'?'paper':key;for(let level=0;level<PRICES[key].length;level++)for(let arm=0;arm<5;arm++){assert.equal(PRICES[key][level][arm],priceOracle[other][level][arm],`${key}/${level}/${arm}`);cells++;}}
 for(const key of Object.keys(BUILD_DEMAND)){const other=key==='permit'?'paper':key;assert.deepEqual(BUILD_DEMAND[key],thresholdOracle[other].map(x=>x[0]));assert.deepEqual(CITY_BUILDS[key],thresholdOracle[other].map(x=>x[1]).filter(Number.isFinite));}return {cells};
});
test('King doubles all taxes, Land Rush suppresses plot tax, tax cap',()=>{
 const g=createGame();g.tax=25;g.events[0]='king';for(const n of [0,1,2,3]){g.city.fill(null);[2,3,7].slice(0,n).forEach(i=>g.city[i]={plot:0});assert.equal(taxCost(g,0),2*(25+[0,0,3,8][n]));}g.events[0]='rush';assert.equal(taxCost(g,0),0);
});
test('Tax penalties overflow reputation floor; final tie uses cash then shared draw',()=>{
 function end(coins){let g=createGame();g.round=6;g.phase='tax';g.taxIndex=1;g.actor=0;g.tax=1;g.players[0].rep=0;g.players[1].rep=0;g.players.forEach(p=>p.coins=coins);return transition(g,legalActions(g).find(a=>a.kind==='tax'));}
 const e=end(2);assert.equal(e.phase,'end');assert.equal(e.result.winner,1);
 let g=createGame();g.round=6;g.phase='tax';g.taxIndex=1;g.actor=0;g.tax=0;g.events[5]=undefined;g.players.forEach(p=>p.coins=5);g=transition(g,legalActions(g).find(a=>a.kind==='tax'));assert.equal(g.result.winner,null);
 let p=createGame();p.round=6;p.phase='tax';p.taxIndex=0;p.actor=0;p.tax=25;p.players[0].coins=0;p.players[0].rep=-5;p=transition(p,{kind:'penalty'});assert.equal(p.players[0].vp,-6);assert.equal(p.players[0].rep,-5);
});
test('Nine miners exhaust legally; regular draw recycles discard',()=>{
 let g=createGame();g.players[0].pool=0;g.players[0].reserve=0;assert.equal(legalActions(g).filter(a=>a.kind==='mine').length,0);
 g=createGame();g.mineDiscard=g.mineDeck;g.mineDeck=[];const id=g.mineDiscard[0];g=transition(g,legalActions(g).find(a=>a.kind==='mine'));assert.equal(g.pending[0].drawn.length,1);assert.equal(g.mineMixed,true);assert.equal(g.mineDeck.length,26);checkGame(g);
});
test('Regression: setup shuffle spans rock orders and first-tier permutations',()=>{
 const groups=[];for(const prefix of ['astra-v022-variety','astra-v022-variety-confirm']){const mines={},events={},rocks={},permutations=new Set();for(let i=0;i<10000;i++){const g=createGame({seed:`${prefix}-${i}`});const keys=[g.mineDeck[0],g.events[0],g.mine.filter(x=>x?.rock).map(x=>x.stars).join('')];[mines,events,rocks].forEach((obj,j)=>obj[keys[j]]=(obj[keys[j]]||0)+1);permutations.add(g.mineDeck.slice(0,6).join(','));}groups.push({prefix,n:10000,mines,events,rocks,tierOnePermutations:permutations.size});assert.equal(Object.keys(rocks).length,12);assert.equal(permutations.size,720);}put('shuffle-counts.json',groups);return groups;
});
test('Regression: malformed phase/card state is rejected',()=>{
 const g=createGame({seed:'astra-v022-dead-save'});g.players[0].hand=0;g.phase='action';g.left=2;
 assert.throws(()=>checkGame(g));assert.throws(()=>readSave(JSON.stringify({kind:'kutna-hora-solo',version:2,state:g})));
});
put('core-results.json',tests);console.log(JSON.stringify(tests,null,2));
if(tests.some(t=>!t.passed))process.exitCode=1;
