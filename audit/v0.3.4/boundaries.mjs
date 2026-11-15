import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createGame,legalActions,transition,mineRow,mineSpaces,plotSpaces,finalResult} from '../../src/engine.mjs';
import {readSave,writeSave,checkGame} from '../../src/save.mjs';
const results={mineRanks:0,checks:[]};
// Independent oracle from printed mine tables and competition ranking, including zero-star players.
for(const n of [2,3,4])for(let vector=0;vector<4**n;vector++)for(let rock=0;rock<=2;rock++){
 const stars=Array.from({length:n},(_,i)=>Math.floor(vector/4**i)%4),total=stars.reduce((a,b)=>a+b,rock);
 const table=n===2?(total<4?[2,0]:total<7?[4,1]:[6,2]):total<6?[2,1,0]:total<10?[3,2,1]:[5,3,2];
 const expected=stars.map(v=>v===0?0:(table[stars.filter(x=>x>v).length]??0));
 const g=createGame({playerCount:n});g.mine.fill(null);stars.forEach((v,i)=>g.mine[i]={owner:i,stars:v});g.mine[n]={rock:true,stars:rock};
 assert.deepEqual(mineRow(g,0).vp,expected);results.mineRanks++;
}
for(const n of [2,3,4]){
 let g=createGame({seed:`boundary-${n}`,playerCount:n});
 assert.ok(plotSpaces(g,0).every(x=>x.cost===5));
 assert.deepEqual(mineSpaces(g).map(x=>x.space),n===2?[1,3]:[1,5]);
 // Plot markers and edge villages do not count as a neighbouring building.
 const first=plotSpaces(g,0)[0].space;g.city[first]={plot:1};assert.ok(plotSpaces(g,0).every(x=>x.cost===5));
 // Once every physical marker is used, even the free plot effect has no legal target.
 const places=plotSpaces(g,0).slice(0,3);for(const p of places)g.city[p.space]={plot:0};assert.deepEqual(plotSpaces(g,0,true),[]);
 // No figures left: Mine cannot recruit an invented miner.
 g.players[0].pool=0;g.players[0].reserve=0;assert.ok(!legalActions(g).some(a=>a.kind==='mine'));
 results.checks.push(`supply and board ${n}p`);
}
{
 const g=createGame({seed:'boundary-recycle',starter:0});g.technology=4;
 g.mineDiscard=g.mineDeck.splice(1);
 const next=transition(g,legalActions(g).find(a=>a.kind==='mine'&&a.card===0&&a.refill===0));
 checkGame(next);assert.equal(next.pending[0].drawn.length,5);assert.equal(new Set(next.pending[0].drawn).size,5);assert.equal(next.mineMixed,true);
 assert.equal(next.pending[0].drawn.length+next.mineDeck.length+next.mineDiscard.length,27);
 results.checks.push('mid-draw reshuffle, no duplicate or missing mine');
}
{
 const g=readSave(readFileSync(new URL('../../test/fixtures/Ius_Regale_Short_Stack.json',import.meta.url),'utf8'));
 g.tax=25;g.ore=30;
 const next=transition(g,legalActions(g).find(a=>a.kind==='skip'));
 assert.equal(next.ore,30);assert.equal(next.tax,25);assert.equal(next.mineDeck.length,0);
 results.checks.push('ore cap at Ius event boundary');
}
{
 const g=createGame({playerCount:4});for(const p of g.players){p.coins=50;p.vp=10;}
 assert.deepEqual(finalResult(g).winners,[0,1,2,3]);g.players[2].coins++;
 assert.deepEqual(finalResult(g).winners,[2]);g.players[1].vp++;
 assert.deepEqual(finalResult(g).winners,[1]);results.checks.push('four-way exact tie, cash tiebreak, VP precedence');
}
{
 let g=createGame({seed:'boundary-track-caps'});g.events=['abbey','code','fever','groschen','king'];
 const advance=()=>{const choices=legalActions(g);g=transition(g,choices.find(a=>a.kind==='skip')??choices.find(a=>a.kind==='penalty')??choices[0]);checkGame(g);};
 while(g.round<4)advance();g.tax=25;g.ore=30;g.pop=40;g.barbara=6;
 while(g.round<5)advance();assert.equal(g.tax,25);assert.equal(g.ore,30);assert.equal(g.barbara,7);
 while(g.round<6)advance();assert.equal(g.pop,40);assert.equal(g.tax,25);
 results.checks.push('Groschen +3 ore and cathedral tax capped; King +3 population capped');
}
for(const f of ['v0.1.0_III-3.json','v0.1.0_Completed_Game.json','v0.2.3_Mine_Pending.json']){
 const raw=readFileSync(new URL('./fixtures/'+f,import.meta.url),'utf8');const g=readSave(raw);checkGame(g);assert.deepEqual(readSave(writeSave(g)),g);
 if(g.phase==='end')assert.deepEqual(g.result,finalResult(g));
 else assert.ok(legalActions(g).length);
 results.checks.push('legacy fixture '+f);
}
writeFileSync(new URL('./results/boundaries.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
