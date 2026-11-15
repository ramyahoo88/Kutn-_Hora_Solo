import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,transition,legalActions,patricianBase,scoreBreakdown,price,income,marketOffer,plotCount} from '../../src/engine.mjs';
import {BUILDINGS,EVENTS,MINES} from '../../src/data.mjs';
const tests=[];function test(name,fn){try{tests.push({name,passed:true,detail:fn()});}catch(e){tests.push({name,passed:false,error:e.message});}}
const play=(g,kind,more={})=>transition(g,legalActions(g).find(a=>a.kind===kind&&Object.entries(more).every(([k,v])=>a[k]===v))??{kind,...more});
function atEnd(id){const g=createGame({seed:'event-edge'});g.round=EVENTS[id].set==='A'?1:4;g.events[g.round-1]=id;g.tax=1;g.actor=1;g.turn=5;g.left=1;g.players[1].hand=4;return g;}
function grant(g,id){for(const row of g.market)for(let i=row.length-1;i>=0;i--){const s=row[i];s.tiles=s.tiles.filter(x=>x!==id);if(!s.tiles.length)row.splice(i,1);}g.players[0].held.push(id);}
for(const id of Object.keys(EVENTS))test('Event '+id+' resolves its printed end effect',()=>{
 const g=atEnd(id);g.barbara=8;g.players.forEach(p=>{p.pool=0;p.reserve=8;});const before=structuredClone(g);const n=play(g,'skip',{card:2});
 assert.equal(n.pop,(EVENTS[id].pop??0));assert.equal(n.ore,(EVENTS[id].ore??0));
 if(id==='abbey')for(const row of before.market)for(const s of row)if(!BUILDINGS[s.tiles[0]].public){const after=n.market.flat().find(x=>x.group===s.group);assert.equal(after.tiles[0],s.tiles[1]);assert.equal(after.tiles.at(-1),s.tiles[0]);}
 if(id==='fever')n.players.forEach(p=>{assert.equal(p.pool,2);assert.equal(p.reserve,6);});
 if(id==='rush'){assert.equal(n.phase,'action');assert.equal(n.round,2);}
 if(id==='siege')for(const group of ['green','civicSilver','yellow'])assert.ok(n.marketDiscard.includes(before.market.flat().find(x=>x.group===group).tiles[0]));
 if(id==='code'){assert.equal(n.mineDeck.length,22);assert.deepEqual(n.mineDiscard,before.mineDeck.slice(0,5));}
 if(id==='cathedral')n.players.forEach(p=>assert.equal(p.pelicans,1));
 if(id==='michal')for(const row of before.market)assert.ok(n.marketDiscard.includes(row[0].tiles[0]));
 if(id==='groschen'){assert.equal(n.barbara,9);assert.equal(n.tax,2);}
 if(id==='king')assert.equal(legalActions(n).find(x=>x.kind==='tax').cost,2);
 if(id==='abbot')for(let r=0;r<3;r++)assert.equal(n.market[r].at(-1).group,before.market[r][0].group);
 return {phase:n.phase,round:n.round,pop:n.pop,ore:n.ore};
});
test('Cathedral completion and reputation ceiling/floor',()=>{
 let g=createGame();g.barbara=11;g.players[0].pelicans=2;g=play(g,'barbara',{card:5});assert.equal(g.players[0].vp,5);assert.equal(g.barbara,12);
 g.players[0].rep=9;g=play(g,'barbara',{as:'barbara'});assert.equal(g.players[0].vp,9);assert.equal(g.players[0].rep,9);assert.equal(g.barbara,12);
});
test('Barbara 8 current interpretation, both bypassing and ordinary free builds',()=>{
 const outcomes=[];for(const id of ['tavern','pump']){let g=createGame();g.barbara=8;g.players[0].pelicans=1;grant(g,id);g.city[2]={plot:0};const before=g.tax;g=play(g,'barbara',{card:5});assert.equal(g.barbara,8);g=play(g,'build',{id,space:2});assert.equal(g.barbara,9);assert.equal(g.tax-before,id==='tavern'?1:0);assert.equal(g.players[0].vp,1);outcomes.push({id,next:g.barbara,taxDelta:g.tax-before});}return outcomes;
});
test('Technology takes reserve first, pool fallback, and allows discard',()=>{
 for(const supply of [{reserve:1,pool:1,expected:[0,1]},{reserve:0,pool:1,expected:[0,0]}]){let g=createGame();g.pending=[{kind:'technology',id:'t1'}];g.players[0].reserve=supply.reserve;g.players[0].pool=supply.pool;g=play(g,'technology',{space:1});assert.deepEqual([g.players[0].reserve,g.players[0].pool],supply.expected);}
 let g=createGame();g.pending=[{kind:'technology',id:'t1'}];g=play(g,'skip');assert.equal(g.pending.length,0);assert.equal(g.players[0].reserve,8);
});
test('Barbara 9 resolves two draws without using another action card',()=>{
 let g=createGame();g.barbara=9;g.players[0].pelicans=1;g=play(g,'barbara',{card:5});assert.equal(g.left,1);assert.equal(g.pending.length,2);
 for(let i=0;i<2;i++){g=play(g,'mine');const a=legalActions(g).find(x=>x.kind==='place-mine');g=transition(g,a);}
 assert.equal(g.pending.length,0);assert.equal(g.left,1);assert.equal(g.players[0].reserve,6);assert.equal(g.players[0].pool,1);
});
test('Houses exhausted blocks construction but not unrelated guilds',()=>{
 const g=createGame();grant(g,'smelter');grant(g,'pump');g.city[2]={plot:0};g.players[0].coins=100;g.players[0].houses[0]=4;
 assert.ok(!legalActions(g).some(x=>x.kind==='build'&&x.id==='smelter'));assert.ok(legalActions(g).some(x=>x.kind==='build'&&x.id==='pump'));
});
test('Patrician supply exhaustion and maximum yellow/red/silver scoring',()=>{
 let g=createGame();g.patrons.silver=0;assert.ok(!legalActions(g).some(x=>x.kind==='income'&&x.color==='silver'));
 g.bank.green=0;g.pending=[{kind:'patrician'}];assert.ok(!legalActions(g).some(x=>x.color==='green'));
 g.players[0].houses=[4,4,4];g.players[0].usedPelicans=5;g.mine=Array(20).fill(null);for(let r=0;r<4;r++)for(let c=0;c<3;c++)g.mine[r*5+c]={id:'m1-1',owner:0,stars:1};
 const b=patricianBase(g,0);assert.deepEqual(b,{green:0,silver:6,yellow:4,red:12});
});
test('No free reputation/VP from repeating exhausted card or stale action',()=>{
 const g=createGame();const a=legalActions(g).find(x=>x.kind==='plot'&&x.card===1);const n=transition(g,a);assert.throws(()=>transition(n,a),/no longer available/);assert.equal(n.players[0].coins,g.players[0].coins-a.cost);
});
test('Holding limit: three rights and three plots',()=>{
 const g=createGame();for(const id of ['pump','tavern','smelter'])grant(g,id);for(const i of [2,3,7])g.city[i]={plot:0};assert.ok(!legalActions(g).some(x=>x.kind==='rights'));assert.ok(!legalActions(g).some(x=>x.kind==='plot'));
});
test('Tracks at maximum remain bounded after a mining effect',()=>{
 let g=createGame();g.pop=40;g.ore=30;g.arms={wood:4,food:4,beer:4,ore:0,silver:4,permit:4};g.pending=[{kind:'mine-place',drawn:['m1-2'],free:true}];g.mineDeck=g.mineDeck.filter(x=>x!=='m1-2');g=play(g,'place-mine',{space:1});assert.equal(g.pop,40);assert.equal(g.ore,30);assert.ok(Number.isFinite(income(g,0)));
});
test('Documented Ius ruling: discard the remaining stack without recycling',()=>{
 let g=atEnd('code');g.mineDiscard=g.mineDeck.slice(1);g.mineDeck=g.mineDeck.slice(0,1);g=play(g,'skip',{card:2});assert.equal(g.mineDeck.length,0);assert.equal(g.mineDiscard.length,27);return {cardsDiscardedByEvent:1,expected:'Project interpretation: discard only the available stack, then replenish on a later draw.'};
});
fs.writeFileSync(new URL('./evidence/boundary-results.json',import.meta.url),JSON.stringify(tests,null,2));console.log(JSON.stringify(tests,null,2));if(tests.some(t=>!t.passed))process.exitCode=1;
