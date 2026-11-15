import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,legalActions,transition,actionKey} from '../../src/engine.mjs';
import {readSave,writeSave,checkGame} from '../../src/save.mjs';
import {botAction} from '../../src/bot.mjs';

const results=[];
for (const file of ['v0.1.0_III-3.json','v0.1.0_Completed_Game.json']) {
  const raw=fs.readFileSync(new URL(`./fixtures/${file}`,import.meta.url),'utf8');
  const old=JSON.parse(raw).state;
  let game=readSave(raw);
  assert.equal(old.schema,1);
  assert.equal(game.schema,2);
  assert.equal(game.setupVersion,1);
  for (const key of ['mineDeck','mineDiscard','market','events','red','rng']) assert.deepEqual(game[key],old[key]);
  assert.deepEqual(game.players.map(p=>p.guilds),old.players.map(p=>p.guilds));
  if (file.includes('III-3')) {
    assert.equal(old.mine.find(m=>m?.id==='m3-3').stars,0);
    assert.equal(game.mine.find(m=>m?.id==='m3-3').stars,2);
  } else assert.deepEqual(game.result.scores.map(s=>s.total),[50,42]);
  let steps=0;
  while(game.phase!=='end') {
    assert.ok(++steps<240);
    const before=writeSave(game);
    const action=botAction(game,'quick');
    assert.equal(writeSave(game),before,'Planning must not mutate the saved position');
    assert.ok(legalActions(game).some(a=>actionKey(a)===actionKey(action)));
    game=transition(game,action);
    checkGame(game);
    assert.deepEqual(readSave(writeSave(game)),game);
  }
  results.push({file,steps,deckOrderPreserved:true,gameFinished:true,result:game.result});
}

// A fully reachable adversarial game: spend every card without an effect,
// always accept the tax penalty. This must still reach final scoring.
let game=createGame({seed:'astra-v022-tax-floor'}),steps=0,cards=0;
let floorFixture=false;
while(game.phase!=='end') {
  assert.ok(++steps<100);
  if(game.phase==='tax'&&game.round===6&&game.actor===0) {
    assert.equal(game.players[0].rep,-5);
    fs.writeFileSync(new URL('./fixtures/Tax_At_Reputation_Floor.json',import.meta.url),writeSave(game));
    const after=transition(game,{kind:'penalty'});
    assert.equal(after.players[0].rep,-5);
    assert.equal(after.players[0].vp-game.players[0].vp,-6);
    floorFixture=true;
  }
  const action=legalActions(game).find(a=>a.kind===(game.phase==='tax'?'penalty':'skip'));
  if(game.phase==='action') cards++;
  assert.ok(action);
  game=transition(game,action);checkGame(game);
}
assert.equal(cards,60);assert.ok(floorFixture);assert.equal(game.round,6);
results.push({name:'Every action voluntarily wasted; tax floor overflow',steps,cards,result:game.result});
fs.writeFileSync(new URL('./evidence/recovery-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
