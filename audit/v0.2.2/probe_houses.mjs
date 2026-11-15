// Finding: third house row pays printed reputation 1, 3, 4, then 8 VP (rulebook p.6 player board, p.12 diagram).
import assert from 'node:assert/strict';
import {createGame,legalActions,transition,actionKey} from '../../src/engine.mjs';
import {HOUSE_EFFECTS} from '../../src/data.mjs';

console.log('row 3 table in app:',JSON.stringify(HOUSE_EFFECTS[2]));
// Card 1, your seat: Metallurgists, Miners, Innkeepers. Row 3 = Innkeepers (beer).
let observed=[];
for (let built=0; built<4; built++) {
  const g=createGame({seed:'house-row-3'});
  const p=g.players[0];
  p.houses[2]=built;              // houses already removed from row 3
  p.coins=200;
  p.held=['tavern'];
  g.city[14]={plot:0};
  const a=legalActions(g).find(x=>x.kind==='build'&&x.id==='tavern'&&x.space===14&&!x.as);
  const next=transition(g,a);
  observed.push({house:built+1,rep:next.players[0].rep-p.rep,vp:next.players[0].vp-p.vp});
}
console.log('observed per house',JSON.stringify(observed));
const printed=[{rep:1,vp:0},{rep:3,vp:0},{rep:4,vp:0},{rep:0,vp:8}];
try {
  observed.forEach((o,i)=>assert.deepEqual({rep:o.rep,vp:o.vp},printed[i],`house ${i+1}`));
  console.log('PASS');
} catch(e) {console.log('FAIL:',e.message);}
