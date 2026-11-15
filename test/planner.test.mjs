import test from 'node:test';
import assert from 'node:assert/strict';
import {botAction,nextOwnTurn,publicPlanningState} from '../src/bot.mjs';
import {BUILDINGS,MINES} from '../src/data.mjs';
import {actionKey,createGame,legalActions,price,rulesFor,transition} from '../src/engine.mjs';
import {checkGame,readSave,writeSave} from '../src/save.mjs';

function grantRights(game, seat, id) {
  for (const stack of game.market.flat()) stack.tiles=stack.tiles.filter(tile=>tile!==id);
  game.market=game.market.map(row=>row.filter(stack=>stack.tiles.length));
  game.players[seat].held.push(id);
}

test('an intervening build changes which follow-up cards the rival can afford',()=>{
  const game=createGame({seed:'reply-price',setup:1,starter:0});
  game.left=0; // Position just after the seat's second card, before finishing its turn.
  game.players[0].hand&=~((1<<0)|(1<<4));
  game.city[2]={plot:0};
  game.city[3]={plot:1};
  grantRights(game,0,'tavern');
  grantRights(game,1,'bakery');
  game.players[0].coins=BUILDINGS.tavern.wood*price(game,'wood');
  assert.ok(legalActions(game).some(a=>a.kind==='build'&&a.id==='tavern'));

  const after=nextOwnTurn(publicPlanningState(game),0);
  assert.equal(after.actor,0);
  assert.equal(after.turn,2);
  assert.equal(after.city[3].id,'bakery');
  assert.ok(price(after,'wood')>price(game,'wood'));
  assert.ok(!legalActions(after).some(a=>a.kind==='build'&&a.id==='tavern'));
  assert.equal(game.city[3].plot,1);
});

test('closing search finds the best actual last-card score in a no-draw position',()=>{
  const game=createGame({seed:'closing-score',setup:1,starter:1,playerCount:2});
  Object.assign(game,{round:6,turn:5,actor:0,left:1,tax:2});
  game.players[0].hand=(1<<2)|(1<<3);
  game.players[1].hand=1;
  for(const [row,id] of game.red.entries()) game.market[row].push({group:id,tiles:[id]});
  grantRights(game,0,'smelter');
  game.city[2]={plot:0};
  game.players[0].houses[0]=3; // The last house gives VP without a further choice.
  game.players[0].coins=30;
  checkGame(game);

  const margin=action=>{
    let result=transition(game,action);
    while (result.phase==='tax') result=transition(result,botAction(result,'standard'));
    assert.equal(result.phase,'end');
    const [a,b]=result.result.scores;
    return a.total-b.total;
  };
  const choice=botAction(game,'closing');
  assert.equal(choice.kind,'build');
  assert.equal(margin(choice),Math.max(...legalActions(game).map(margin)));
});

test('Planner is reproducible after loading and ignores the actual concealed tile and event orders',()=>{
  for(const playerCount of [2,3,4]) {
    const game=createGame({seed:'sampled-orders',playerCount,starter:1,difficulty:'planner',events:true});
    const different=structuredClone(game);
    different.rng=(game.rng^0x126ac109)>>>0;
    different.mineDeck=[1,2,3].flatMap(tier=>game.mineDeck.filter(id=>MINES[id].tier===tier).reverse());
    for(const stack of different.market.flat()) stack.tiles=[stack.tiles[0],...stack.tiles.slice(1).reverse()];
    different.red.reverse();
    const split=rulesFor(game).redRound;
    different.events=[game.events[0],...game.events.slice(1,split).reverse(),...game.events.slice(split).reverse()];
    checkGame(different);
    const original=writeSave(game);
    const move=actionKey(botAction(game));
    assert.equal(actionKey(botAction(different)),move);
    assert.equal(readSave(original).difficulty,'planner');
    assert.equal(actionKey(botAction(readSave(original))),move);
    assert.equal(writeSave(game),original);
  }
});
