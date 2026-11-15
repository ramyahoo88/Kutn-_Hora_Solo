import test from 'node:test';
import assert from 'node:assert/strict';
import {MINCMISTR_PLANS} from '../src/data.mjs';
import {cardsThisTurn,createGame,createPlanDeck,drawPlan,legalActions,seatAtTurn,transition,validPlanDeck} from '../src/engine.mjs';
import {botAction} from '../src/bot.mjs';
import {playMincmistr} from '../src/mincmistr.mjs';
import {checkGame,readSave,writeSave} from '../src/save.mjs';

const digital=(options={})=>createGame({difficulty:'mincmistr',starter:1,...options});
const fromPlan=entry=>/^Plan \d+ ·/.test(entry.text);

test('the shared Plan deck draws every card before shuffling the discards',()=>{
  const deck=createPlanDeck('paper-deck',1);
  const firstOrder=[...deck.draw];
  const count=MINCMISTR_PLANS.length;
  assert.deepEqual(Array.from({length:count},()=>drawPlan(deck)),firstOrder);
  assert.deepEqual(deck.draw,[]);
  assert.deepEqual(deck.discard,firstOrder);

  const restored=JSON.parse(JSON.stringify(deck));
  const next=drawPlan(deck);
  assert.equal(drawPlan(restored),next);
  assert.deepEqual(deck,restored);
  assert.deepEqual(deck.discard,[next]);
  assert.equal(deck.draw.length,count-1);
  assert.ok(validPlanDeck(deck));
  const secondOrder=[next,...Array.from({length:count-1},()=>drawPlan(deck))];
  assert.deepEqual(secondOrder.toSorted((a,b)=>a-b),MINCMISTR_PLANS.map((_,index)=>index));
});

test('last-turn card allowance follows the printed levels at every table size',()=>{
  for (const count of [2,3,4]) {
    const rounds=count===4?5:6;
    for (const [level,extra] of [['apprentice',0],['journeyman',0],['master',3],['grandmaster',rounds]]) {
      const game=digital({playerCount:count,mincmistr:{level}});
      for (let round=1;round<=rounds;round++) {
        game.round=round;
        for (let turn=0;turn<3*count;turn++) {
          const last=turn>=2*count;
          const double=seatAtTurn(game,turn)>0&&round>rounds-extra;
          assert.equal(cardsThisTurn(game,turn),!last||double?2:1);
        }
      }
    }
  }
  const tougher=digital({playerCount:3,mincmistr:{level:'master',tougher:true}});
  assert.equal(tougher.mincmistr.tougher,true);
  tougher.round=2;
  assert.equal(cardsThisTurn(tougher,6),1);
  tougher.round=3;
  assert.equal(cardsThisTurn(tougher,6),2);
  assert.equal(cardsThisTurn(tougher,8),1);
  const invalid=digital({playerCount:4,mincmistr:{level:'master',tougher:true}});
  assert.equal(invalid.mincmistr.tougher,false);
});

test('a Mine bonus keeps the Plan and replay after reload uses the same deck',()=>{
  const game=digital({seed:'mincmistr-mine'});
  const first=3; // Plan 4, Mine before Construct.
  const deck=game.mincmistr.decks[0];
  deck.draw=[first,...deck.draw.filter(id=>id!==first)];
  const before=writeSave(game);
  const mining=checkGame(playMincmistr(game));
  assert.equal(writeSave(game),before);
  assert.equal(mining.pending[0].kind,'mine-place');
  assert.deepEqual(mining.mincmistr.lastPlans,[first]);
  assert.equal(mining.log.filter(fromPlan).length,1);
  const saved=readSave(writeSave(mining));
  const placed=checkGame(playMincmistr(mining));
  assert.deepEqual(playMincmistr(saved),placed);
  assert.deepEqual(placed.mincmistr,mining.mincmistr);
  assert.equal(placed.log.filter(fromPlan).length,1);
});

test('shared and individual decks flip once for each rival card across successive turns',()=>{
  for (const shared of [true,false]) {
    const opening=digital({seed:'mincmistr-decks',playerCount:3,mincmistr:{shared}});
    let game=opening;
    while (game.actor!==0) game=checkGame(playMincmistr(game));
    const draws=opening.mincmistr.decks.map(deck=>deck.draw);
    assert.deepEqual(game.mincmistr.decks.map(deck=>deck.draw.length),shared?[11]:[13,13]);
    assert.deepEqual(game.mincmistr.lastPlans,shared?[draws[0][1],draws[0][3]]:[draws[0][1],draws[1][1]]);
    assert.equal(game.log.filter(fromPlan).length,4);
    const userMove=legalActions(game).find(action=>action.kind==='skip');
    assert.deepEqual(transition(game,userMove).mincmistr,game.mincmistr);
  }
});

test('Mincmistr saves reject corrupt decks, missing metadata and an unavailable level option',()=>{
  const opening=digital();
  const repeated=structuredClone(opening);
  const deck=repeated.mincmistr.decks[0];
  deck.draw[0]=deck.draw[1];
  assert.throws(()=>readSave(writeSave(repeated)),/Mincmistr settings or Plan deck/);
  const missing=structuredClone(opening);
  delete missing.mincmistr;
  assert.throws(()=>readSave(writeSave(missing)),/Mincmistr settings or Plan deck/);
  const invalid=structuredClone(opening);
  invalid.mincmistr.tougher=true;
  assert.throws(()=>readSave(writeSave(invalid)),/Mincmistr settings or Plan deck/);
});

test('complete Mincmistr games validate between cards, taxes and final scoring',()=>{
  for (const count of [2,3,4]) for (const level of ['apprentice','journeyman','master','grandmaster']) {
    let game=digital({seed:`mincmistr-complete-${count}-${level}`,playerCount:count,events:true,
      mincmistr:{level,shared:count!==4,tougher:count===3&&level==='master'}});
    const rounds=count===4?5:6;
    const extra=level==='master'?(count===3?4:3):level==='grandmaster'?rounds:0;
    let decisions=0;
    while(game.phase!=='end') {
      assert.ok(++decisions<=300);
      game=checkGame(game.actor===0?transition(game,botAction(game,'quick')):playMincmistr(game));
    }
    assert.equal(game.round,rounds);
    assert.equal(game.log.filter(fromPlan).length,(rounds*5+extra)*(count-1));
    for (const deck of game.mincmistr.decks) assert.equal(deck.draw.length+deck.discard.length,MINCMISTR_PLANS.length);
    assert.deepEqual(readSave(writeSave(game)),game);
  }
});
