import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,MINES} from '../src/data.mjs';
import {botAction,forecastNextCard} from '../src/bot.mjs';
import {
  actionKey,cityPointsAt,createGame,finalResult,legalActions,mineRow,mineSpaces,
  plotSpaces,rulesFor,transition,
} from '../src/engine.mjs';
import {checkGame,readSave,writeSave} from '../src/save.mjs';

test('three- and four-player setup use the larger board and the printed guild sets',()=>{
  const three=createGame({playerCount:3,seed:'three-guilds',side:0,starter:2,mineLayout:0});
  const four=createGame({playerCount:4,seed:'four-guilds',side:1,starter:1,mineLayout:14});
  assert.deepEqual(three.players.map(p=>p.coins),[41,42,40]);
  assert.deepEqual(four.players.map(p=>p.coins),[43,40,41,42]);
  assert.deepEqual(three.players[0].guilds,['food','silver','wood']);
  assert.deepEqual(four.players[0].guilds,['beer','ore','permit']);
  for (const game of [three,four]) {
    assert.equal(plotSpaces(game,0).length,30);
    assert.equal(game.mine.length,28);
    assert.deepEqual(mineSpaces(game),[{space:1,wood:2},{space:5,wood:2}]);
    assert.deepEqual(game.events,[]);
    assert.deepEqual(readSave(writeSave(game)),game);
  }
  assert.deepEqual(three.mine.flatMap((cell,i)=>cell?.rock?[i]:[]),[2,12,15,25]);
  assert.deepEqual(four.mine.flatMap((cell,i)=>cell?.rock?[i]:[]),[3,15,19,24]);
  const assigned=four.players.map(p=>[...p.guilds].sort().join('/')).sort();
  assert.deepEqual(assigned,['food/ore/silver','beer/ore/permit','beer/silver/wood','food/permit/wood'].sort());
  const invalid=structuredClone(four);
  invalid.players[3].guilds=invalid.players[2].guilds;
  assert.throws(()=>readSave(writeSave(invalid)),/guild sets/);

  const study=structuredClone(three);
  study.city[5]={id:'pump',owner:2}; // F1 touches the yellow village.
  study.city[24]={id:'smelter',owner:0}; // A5 touches the silver village.
  assert.equal(cityPointsAt(study,5),1);
  assert.equal(cityPointsAt(study,24),1);
  assert.deepEqual(plotSpaces(study,0).map(p=>p.space),[4,11,18,25]);
});

test('optional events use the appropriate A/B decks and leave the final round empty',()=>{
  for(const [playerCount,decks] of [[2,'AAABB'],[3,'AAABB'],[4,'AABB']]) {
    const g=createGame({playerCount,events:true,seed:'events-by-count'});
    assert.equal(g.events.map(id=>['abbey','fever','rush','siege','code','cathedral'].includes(id)?'A':'B').join(''),decks);
    checkGame(g);
  }
  assert.equal(createGame({playerCount:2,events:false}).events.length,5);
});

test('larger mine rows award tied ranks and give zero stars no award',()=>{
  const game=createGame({playerCount:4,mineLayout:0});
  // Printed page 17 example: two players tied first, with one rank skipped.
  game.mine.splice(0,7,
    {owner:0,stars:1},{owner:0,stars:1},{rock:true,stars:1},
    {owner:1,stars:2},{owner:3,stars:0},{owner:2,stars:1},{owner:3,stars:0});
  assert.deepEqual(mineRow(game,0).vp,[3,3,1,0]);
  game.mine[2]={rock:true,stars:0};
  assert.deepEqual(mineRow(game,0).vp,[2,2,0,0]);
  game.mine[2]={rock:true,stars:2};
  game.mine[0]={owner:0,stars:3};
  game.mine[4]={owner:3,stars:1};
  assert.deepEqual(mineRow(game,0).vp,[5,3,2,2]);
});

for(const [count,rounds,redRound,lostRep] of [
  [3,6,3,[1,1,1,2,2,3]],
  [4,5,2,[1,1,2,2,3]],
]) {
  test(`${count} players rotate turns and taxes, then score on the printed rounds`,()=>{
    let game=createGame({playerCount:count,seed:'rule-clock',starter:count-1});
    // Isolate round timing with a constant bill and a known council score.
    game.tax=2;
    game.bank.silver=2;
    game.council.silver=1;
    for(const player of game.players) player.usedPelicans=2;
    for(let round=1;round<=rounds;round++) {
      const starter=(count+round-2)%count;
      assert.equal(game.starter,starter);
      for(const cards of [2,2,1])for(let offset=0;offset<count;offset++) {
        const actor=(starter+offset)%count;
        for(let card=0;card<cards;card++) {
          assert.equal(game.phase,'action');
          assert.equal(game.actor,actor);
          assert.equal(game.left,cards-card);
          game=transition(game,legalActions(game).find(a=>a.kind==='skip'));
          checkGame(game);
        }
      }
      for(let offset=0;offset<count;offset++) {
        assert.equal(game.phase,'tax');
        assert.equal(game.actor,(starter+offset)%count);
        const choices=legalActions(game);
        assert.equal(choices.find(a=>a.kind==='penalty').loss,lostRep[round-1]);
        assert.equal(game.players[0].vp,Math.max(0,round-redRound-1)*3);
        game=transition(game,choices.find(a=>a.kind==='tax'));
      }
      checkGame(game);
      const redTiles=game.market.flat().filter(stack=>BUILDINGS[stack.tiles[0]].group==='red');
      assert.equal(redTiles.length,round>=redRound?3:0);
      assert.equal(game.players[0].vp,Math.max(0,round-redRound)*3);
      assert.deepEqual(readSave(writeSave(game)),game);
    }
    assert.equal(game.phase,'end');
    assert.equal(game.result.winner,count-2); // The original last seat keeps its extra groschen.
    assert.deepEqual(game.result.scores.map(player=>player.total),Array(count).fill(9));
  });
}

test('final tiebreaks identify only the seats sharing first place',()=>{
  const game=createGame({playerCount:4});
  const [a,b,c,d]=game.players;
  a.vp=b.vp=c.vp=12;
  a.coins=c.coins=30;
  b.coins=29;
  d.vp=11;
  d.coins=100;
  assert.deepEqual(finalResult(game).winners,[0,2]);
  assert.equal(finalResult(game).winner,null);
  c.coins++;
  assert.deepEqual(finalResult(game).winners,[2]);
  assert.equal(finalResult(game).winner,2);
});

test('the next-card model respects seat order and changes when a public build becomes impossible',()=>{
  const game=createGame({playerCount:4,side:1,starter:3});
  game.players[0].held=['tavern'];
  game.city[3]={plot:0};
  const reply=forecastNextCard(game);
  assert.equal(reply.seat,0);
  assert.equal(reply.action.kind,'build');
  assert.equal(reply.action.id,'tavern');
  assert.ok(legalActions({...game,actor:0,left:2,turn:1}).some(a=>actionKey(a)===actionKey(reply.action)));
  game.city[3]=null;
  assert.notEqual(forecastNextCard(game).action.kind,'build');
  game.turn=11;
  assert.equal(forecastNextCard(game),null);
});

test('the revised rival pays a manageable early tax without inventing money',()=>{
  const game=createGame({playerCount:4,starter:1});
  game.phase='tax';
  game.round=1;
  game.tax=4;
  game.players[1].rep=1;
  game.players[1].coins=20;
  assert.equal(botAction(game,'classic').kind,'penalty');
  assert.equal(botAction(game).kind,'tax');
  game.players[1].coins=3;
  assert.equal(botAction(game).kind,'penalty');
});

test('larger-table planning ignores hidden order and preserves a saved choice',()=>{
  for(const playerCount of [3,4]) {
    const game=createGame({playerCount,seed:'visibility',starter:playerCount-1,events:true});
    const altered=structuredClone(game);
    altered.rng=(game.rng^0x22222222)>>>0;
    altered.red.reverse();
    const split=rulesFor(game).redRound;
    altered.events=[game.events[0],...game.events.slice(1,split).reverse(),...game.events.slice(split).reverse()];
    altered.mineDeck=[1,2,3].flatMap(tier=>game.mineDeck.filter(id=>MINES[id].tier===tier).reverse());
    for (const stack of altered.market.flat()) stack.tiles=[stack.tiles[0],...stack.tiles.slice(1).reverse()];
    checkGame(altered);
    const before=writeSave(game);
    const original=actionKey(botAction(game));
    assert.equal(actionKey(botAction(altered)),original);
    assert.equal(actionKey(botAction(readSave(before))),original);
    assert.equal(writeSave(game),before);
    assert.equal(rulesFor(game).board.mineWidth,7);
  }
});

test('different public seeds can vary equally good free plot choices',()=>{
  const board=createGame({playerCount:3,seed:'same-board',starter:1});
  // A free plot from tile 4 on the final card, with comparable sites available.
  Object.assign(board,{turn:8,actor:0,left:0,pending:[{kind:'plot'}],barbara:5});
  for (const player of board.players) player.hand=1;
  checkGame(board);
  const alternatives=new Set();
  for(let i=0;i<16;i++) alternatives.add(actionKey(botAction({...board,seed:`close-choice-${i}`})));
  assert.ok(alternatives.size>1);
});
