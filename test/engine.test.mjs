import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,GUILD_SETUPS,MINES,ROCK_LAYOUTS,ROCK_STARS} from '../src/data.mjs';
import {botAction,publicPlanningState} from '../src/bot.mjs';
import {
  actionKey,canBuildGuild,cityPointsAt,createGame,finalResult,income,legalActions,marketOffer,mineRow,mineSpaces,
  patricianPoints,plotSpaces,price,scoreBreakdown,taxCost,transition,
} from '../src/engine.mjs';
import {checkGame,readSave,writeSave} from '../src/save.mjs';

function play(state, requested) {
  assert.ok(legalActions(state).some(a=>actionKey(a)===actionKey(requested)),JSON.stringify(requested));
  return transition(state,requested);
}
const owned = (id,owner) => ({id,owner,stars:MINES[id].stars});

test('printed guild sets, opening prices, mine draw and rights rotation',()=>{
  let game=createGame({seed:'silver-1308'});
  assert.deepEqual(game.players[0].guilds,['silver','ore','beer']);
  assert.deepEqual([...game.players[1].guilds].sort(),['food','permit','wood']);
  assert.deepEqual(game.players.map(p=>p.coins),[40,41]);
  assert.deepEqual(['wood','food','beer','ore','silver','permit'].map(key=>price(game,key)),[2,3,5,3,4,4]);
  assert.deepEqual(mineSpaces(game),[{space:1,wood:2},{space:3,wood:2}]);
  game=play(game,{kind:'mine',refill:0,card:0});
  assert.deepEqual(game.pending[0].drawn,['m1-2']);
  const save=readSave(writeSave(game));
  assert.deepEqual(save,game);
  game=play(save,{kind:'place-mine',id:'m1-2',space:1});
  assert.equal(game.players[0].pool,0);
  assert.equal(game.players[0].coins,36);
  assert.equal(game.pop,1);
  assert.equal(game.ore,2);
  assert.equal(income(game,0),4);
  assert.deepEqual(mineSpaces(game),[{space:0,wood:4},{space:2,wood:4},{space:3,wood:2}]);
  const offer=marketOffer(game).find(x=>x.id==='horse-mill');
  assert.equal(offer.cost,1);
  game=play(game,{kind:'rights',id:'horse-mill',card:4});
  assert.equal(game.players[0].coins,35);
  assert.equal(game.actor,1);
  assert.equal(game.players[0].hand,46);
  assert.deepEqual(game.players[0].held,['horse-mill']);
  assert.equal(game.market[offer.row].at(-1).group,'ore');
  checkGame(game);
});

test('a red X blocks new guild construction while preserving the market price',()=>{
  const game=createGame({side:1});
  game.arms.wood=1;
  game.players[0].held=['sawmill'];
  game.players[0].production.wood=3;
  game.city[7]={plot:0};
  assert.equal(price(game,'wood'),1);
  assert.equal(income(game,0),3);
  assert.equal(canBuildGuild(game,'wood'),false);
  assert.equal(legalActions(game).some(a=>a.kind==='build'),false);
  game.pop=3;
  assert.ok(canBuildGuild(game,'wood'));
  assert.ok(legalActions(game).some(a=>a.kind==='build'&&a.cost===8));
});

test('demand thresholds discard a market tile and advance its arm',()=>{
  let game=createGame({seed:'silver-1308'});
  game.pop=17;
  game.arms.beer=1;
  const previous=marketOffer(game).find(tile=>tile.group==='wood');
  game=play(game,{kind:'mine',refill:0,card:0});
  game=play(game,{kind:'place-mine',id:'m1-2',space:1});
  assert.equal(game.pop,18);
  assert.equal(game.arms.wood,1);
  assert.equal(game.arms.beer,1);
  assert.equal(price(game,'wood'),4);
  assert.ok(game.marketDiscard.includes(previous.id));
  assert.equal(game.market[previous.row].at(-1).group,'wood');
  checkGame(game);
});

test('plot adjacency, reputation discount and Joker timing use the printed board',()=>{
  const game=createGame();
  game.city[8]={id:'furnace',owner:0};
  game.city[15]={id:'ore-market',owner:1};
  game.city[14]={plot:1};
  assert.deepEqual(plotSpaces(game,0),[{space:2,cost:6},{space:7,cost:6},{space:9,cost:7},{space:16,cost:7},{space:21,cost:7}]);
  game.players[0].rep=3;
  const moves=legalActions(game).filter(a=>a.kind==='plot'&&a.space===9);
  assert.equal(moves.find(a=>a.as==='plot').cost,7);
  assert.equal(moves.find(a=>!a.as).cost,1);
  assert.ok(plotSpaces(game,0,true).some(p=>p.space===26&&p.cost===0));
});

test('two-player mine thresholds, ties, rock stars and public dot matches',()=>{
  const game=createGame();
  game.mine.fill(null);
  game.mine[0]={rock:true,stars:2};
  game.mine[1]=owned('m1-1',0);
  game.mine[2]=owned('m1-5',1);
  assert.deepEqual(mineRow(game,0).vp,[4,4]);
  game.mine[3]=owned('m2-1',1);
  assert.deepEqual(mineRow(game,0).vp,[2,6]);
  game.mine[1]=owned('m1-2',0);
  assert.deepEqual(mineRow(game,0).vp,[0,4]);
  game.city[10]={id:'sawmill',owner:0};
  game.city[9]={id:'st-john',owner:null};
  game.city[16]={id:'limekiln',owner:0};
  assert.equal(cityPointsAt(game,10),5);
  assert.equal(cityPointsAt(game,16),1);
  game.council.green=2;
  assert.equal(patricianPoints(game,0),2);
  assert.equal(scoreBreakdown(game,0).town,6);
});

test('a tax decision includes both plot surcharges and the King multiplier',()=>{
  const game=createGame();
  game.round=4;
  game.events[3]='king';
  game.tax=8;
  for (const i of [7,8,9]) game.city[i]={plot:0};
  game.phase='tax';
  game.taxIndex=0;
  assert.equal(taxCost(game,0),32);
  assert.equal(taxCost(game,1),16);
  const next=play(game,{kind:'tax'});
  assert.equal(next.players[0].coins,8);
  assert.equal(next.actor,1);
});

test('St. Barbara tile 3 spends a pelican and removes a house without a house effect',()=>{
  const game=createGame();
  game.barbara=3;
  game.players[0].pelicans=1;
  const next=play(game,{kind:'barbara',card:5});
  assert.equal(next.players[0].rep,-1);
  assert.equal(next.players[0].usedPelicans,1);
  const funded=play(next,{kind:'house',id:'silver'});
  assert.equal(funded.players[0].production.silver,2);
  assert.deepEqual(funded.players[0].houses,[1,0,0]);
  assert.deepEqual(funded.players[0].held,[]);
  assert.equal(funded.barbara,4);
  checkGame(funded);
});

test('the rival’s first decision cannot depend on unrevealed faces or RNG',()=>{
  const game=createGame({seed:'information-boundary'});
  const replaced=structuredClone(game);
  replaced.rng^=0x5e22;
  replaced.red.reverse();
  [replaced.events[3],replaced.events[4]]=[replaced.events[4],replaced.events[3]];
  replaced.mineDeck=[1,2,3].flatMap(tier=>replaced.mineDeck.filter(id=>MINES[id].tier===tier).reverse());
  for(const row of replaced.market) for(const stack of row) stack.tiles=[stack.tiles[0],...stack.tiles.slice(1).reverse()];
  const visible=publicPlanningState(game);
  const other=publicPlanningState(replaced);
  assert.deepEqual(visible,other);
  assert.deepEqual(botAction(game),botAction(replaced));
});

test('one full match consumes five cards per player per round and rule-generated saves round trip',()=>{
  let game=createGame({seed:'opening-to-end',setup:6,starter:1});
  const spent={};
  let steps=0;
  while (game.phase!=='end') {
    assert.ok(++steps<180);
    if (game.phase==='action'&&!game.pending.length) {
      const key=`${game.round}/${game.actor}`;
      spent[key]=(spent[key]??0)+1;
    }
    const action=botAction(game,game.actor===0?'standard':'council');
    game=play(game,action);
    checkGame(game);
  }
  assert.equal(Object.keys(spent).length,12);
  assert.ok(Object.values(spent).every(n=>n===5));
  assert.equal(game.round,6);
  assert.deepEqual(legalActions(game),[]);
  for (const [seat,score] of game.result.scores.entries()) assert.deepEqual(score,scoreBreakdown(game,seat));
  assert.deepEqual(game,readSave(writeSave(game)));
  const damaged=structuredClone(game);
  damaged.players[1].pool=9;
  assert.throws(()=>readSave(writeSave(damaged)),/piece supply/);
});

test('legacy III–3 saves migrate with their existing deck orders and corrected final awards',()=>{
  let game=createGame({seed:'mine-iii-3-regression',mineLayout:0});
  const tile='m3-3';
  const entrance=1;
  for (const [i,space] of ROCK_LAYOUTS[0].entries()) game.mine[space].stars=[2,1,1,0][i];
  game.mineDeck=[tile,...game.mineDeck.filter(id=>id!==tile)];
  game.mineMixed=true;
  game=play(game,{kind:'mine',refill:0,card:0});
  game=play(game,{kind:'place-mine',id:tile,space:entrance});
  assert.equal(game.mine[entrance].stars,2);
  assert.deepEqual(mineRow(game,0).vp,[4,0]);

  const legacy=structuredClone(game);
  legacy.schema=1;
  delete legacy.setupVersion;
  legacy.mine[entrance].stars=0;
  const resumed=readSave(writeSave(legacy));
  assert.equal(resumed.setupVersion,1);
  assert.equal(resumed.mine[entrance].stars,2);
  for (const key of ['market','marketDiscard','events','mineDeck','mineDiscard','red','rng']) {
    assert.deepEqual(resumed[key],legacy[key]);
  }

  let finished=resumed;
  while (finished.phase!=='end') {
    const actions=legalActions(finished);
    finished=transition(finished,finished.phase==='tax'?actions[0]:actions.find(action=>action.kind==='skip'));
  }
  const oldFinal=structuredClone(finished);
  oldFinal.schema=1;
  delete oldFinal.setupVersion;
  oldFinal.mine[entrance].stars=0;
  oldFinal.result=finalResult(oldFinal);
  const fixed=readSave(writeSave(oldFinal));
  assert.equal(oldFinal.result.scores[0].mines,0);
  assert.equal(fixed.result.scores[0].mines,4);
  assert.equal(fixed.result.scores[0].total,oldFinal.result.scores[0].total+4);
  assert.deepEqual(fixed.result,finished.result);
});

test('seeded setup reaches previously missing rock and mine orders',()=>{
  const rocks=new Set();
  const mines=new Set();
  const first=Array(6).fill(0);
  for (let i=0; i<10000; i++) {
    const game=createGame({seed:`shuffle-regression-${i}`});
    rocks.add(game.mine.filter(cell=>cell?.rock).map(cell=>cell.stars).join(''));
    const tierOne=game.mineDeck.slice(0,6);
    mines.add(tierOne.join(','));
    first[Number(tierOne[0].at(-1))-1]++;
    assert.deepEqual(game.mine.filter(cell=>cell?.rock).map(cell=>cell.stars).sort(),ROCK_STARS);
  }
  assert.equal(rocks.size,12);
  assert.equal(mines.size,720);
  assert.ok(first.every(n=>n>1450&&n<1900),first.join(', '));
  assert.deepEqual(createGame({seed:'same-setup'}),createGame({seed:'same-setup'}));
});

test('save validation rejects impossible turns and preserves last-card pending choices',()=>{
  const game=createGame({seed:'pending-after-last-card'});
  const dead=structuredClone(game);
  dead.players[0].hand=0;
  assert.throws(()=>readSave(writeSave(dead)),/turn and action-card count/);
  const wrongActor={...game,actor:1};
  assert.throws(()=>readSave(writeSave(wrongActor)),/turn and action-card count/);

  let pending=play(game,{kind:'skip',card:2});
  pending=play(pending,{kind:'mine',refill:0,card:0});
  assert.equal(pending.left,0);
  assert.equal(pending.pending[0].kind,'mine-place');
  assert.deepEqual(readSave(writeSave(pending)),pending);
  const stuck={...pending,pending:[]};
  assert.throws(()=>readSave(writeSave(stuck)),/turn and action-card count/);
});

test('third house row pays the printed 1, 3 and 4 reputation, then 8 points',()=>{
  const observed=[];
  for (let removed=0; removed<4; removed++) {
    const game=createGame({seed:'house-row-3'});
    const p=game.players[0];
    p.houses[2]=removed;
    p.coins=200;
    p.held=['tavern'];
    game.city[14]={plot:0};
    const next=play(game,{kind:'build',id:'tavern',space:14,card:2});
    observed.push([next.players[0].rep-p.rep,next.players[0].vp-p.vp]);
  }
  assert.deepEqual(observed,[[1,0],[3,0],[4,0],[0,8]]);
});

test('the rival can use all six row orders for its guild set',()=>{
  for (const side of [0,1]) {
    const seen=new Set();
    for (let i=0; i<64; i++) {
      const g=createGame({seed:`rival-order-${i}`,side});
      assert.deepEqual(g.players[0].guilds,GUILD_SETUPS[1][side]);
      assert.deepEqual([...g.players[1].guilds].sort(),[...GUILD_SETUPS[1][1-side]].sort());
      seen.add(g.players[1].guilds.join('/'));
    }
    assert.equal(seen.size,6);
  }
});

test('explicit house orders are respected without changing the seeded boards or decks',()=>{
  const options={seed:'separate-house-seed',setup:6,side:1,starter:1};
  const seeded=createGame(options);
  const orders=GUILD_SETUPS[6].slice().reverse().map(set=>[...set].reverse());
  const explicit=createGame({...options,orders});
  assert.deepEqual(explicit.players.map(p=>p.guilds),orders);
  for (const key of ['mineLayout','mine','mineDeck','market','red','events','rng']) {
    assert.deepEqual(explicit[key],seeded[key],key);
  }
  assert.deepEqual(readSave(writeSave(seeded)).players,seeded.players);
});

test('Ius Regale discards at most five tiles and only the next draw recycles an empty stack',()=>{
  for (const remaining of [0,3,5,7]) {
    let g=createGame({seed:'ius-regale-boundary'});
    g.events=['code','fever','rush','michal','king'];
    g.tax=0;
    const deck=g.mineDeck;
    const split=deck.length-remaining;
    g.mineDeck=deck.slice(split);
    g.mineDiscard=deck.slice(0,split);
    const beforeRng=g.rng;

    for (let i=0; i<10; i++) g=transition(g,legalActions(g).find(a=>a.kind==='skip'));
    const discarded=Math.min(split+5,deck.length);
    assert.equal(g.round,2);
    assert.equal(g.ore,2);
    assert.deepEqual(g.mineDiscard,deck.slice(0,discarded));
    assert.deepEqual(g.mineDeck,deck.slice(discarded));
    assert.equal(g.mineMixed,false);
    assert.equal(g.rng,beforeRng);
    checkGame(g);

    const next=play(g,{kind:'mine',refill:0,card:0});
    assert.equal(next.mineMixed,remaining<=5);
    assert.equal(next.pending[0].drawn.length,1);
    if (remaining>5) assert.deepEqual(next.pending[0].drawn,[g.mineDeck[0]]);
    else assert.deepEqual(next.mineDiscard,[]);
    checkGame(next);
  }
});
