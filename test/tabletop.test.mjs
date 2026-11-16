import assert from 'node:assert/strict';
import test from 'node:test';
import {MINE_FIELDS,MINES} from '../src/data.mjs';
import {botAction} from '../src/bot.mjs';
import {createGame,legalActions,physicalPrompt,recordPhysicalDraw,transition,undrawnMines} from '../src/engine.mjs';
import {playMincmistr} from '../src/mincmistr.mjs';
import {readSave,writeSave} from '../src/save.mjs';

const face=id=>Object.fromEntries(MINE_FIELDS.map(field=>[field,MINES[id][field]]));
const reload=state=>readSave(writeSave(state));

test('physical events apply only after confirmation and may not repeat',()=>{
  let game=createGame({tabletop:true});
  assert.equal(game.tax,0);
  assert.deepEqual(legalActions(game),[]);
  assert.equal(physicalPrompt(reload(game)).set,'A');
  assert.throws(()=>recordPhysicalDraw(game,'king'),/title/);
  const before=game;
  game=recordPhysicalDraw(game,'abbey');
  assert.deepEqual(reload(before).events,[]);
  assert.equal(game.tax,2);
  assert.deepEqual(game.events,['abbey']);
  assert.throws(()=>recordPhysicalDraw(game,'abbey'),/no physical draw/);
  for (const playerCount of [3,4]) {
    assert.equal(physicalPrompt(createGame({tabletop:true,playerCount})),null);
    assert.equal(physicalPrompt(createGame({tabletop:true,playerCount,events:true})).kind,'event');
  }
});

test('a physical draw charges the permit once and keeps the state on rejected input',()=>{
  let game=recordPhysicalDraw(createGame({tabletop:true}),'cathedral');
  const mine=legalActions(game).find(move=>move.kind==='mine'&&move.refill===1&&!move.as);
  game=reload(transition(game,mine));
  const paid=game.players[0].coins;
  const pending=writeSave(game);
  assert.deepEqual(physicalPrompt(game),{kind:'mine-draw',count:1,beforeShuffle:1});
  assert.throws(()=>recordPhysicalDraw(game,[face('m3-1')]),/draw order/);
  assert.equal(writeSave(game),pending);
  game=reload(recordPhysicalDraw(game,[face('m1-3')]));
  assert.equal(game.players[0].coins,paid);
  assert.deepEqual(game.pending[0].drawn,['m1-3']);
  const place=legalActions(game).find(move=>move.kind==='place-mine');
  game=reload(transition(game,place));
  assert.equal(game.mine[place.space].id,'m1-3');
  assert.equal(game.players[0].coins,paid-place.cost);
});

test('physical inputs reproduce complete digital games using the same revealed pieces',()=>{
  let mineDraws=0, events=0, discards=0;
  const firstRoundCode={2:2,3:4,4:0};
  for (const playerCount of [2,3,4]) for (const optionalEvents of [false,true]) {
    const options={playerCount,events:optionalEvents,difficulty:'mincmistr',
      seed:`draw-check/${playerCount}/${firstRoundCode[playerCount]}`,mincmistr:{level:'grandmaster'}};
    let digital=createGame(options);
    let game=createGame({...options,tabletop:true});
    for (let step=0;step<350;step++) {
      game=reload(game);
      const prompt=physicalPrompt(game);
      if (prompt) {
        if (prompt.kind==='event') {
          const id=digital.events[digital.round-1];
          assert.ok(prompt.choices.includes(id));
          game=recordPhysicalDraw(game,id);
          events++;
        } else if (prompt.kind==='mine-discard') {
          assert.equal(undrawnMines(game)-prompt.count,digital.mineDeck.length);
          game=recordPhysicalDraw(game);
          discards++;
        } else {
          const drawn=digital.pending[0].drawn;
          assert.equal(prompt.count,drawn.length);
          game=recordPhysicalDraw(game,drawn.map(face));
          assert.deepEqual(game.pending,digital.pending);
          mineDraws++;
        }
        continue;
      }
      for (const key of ['players','city','mine','market','mincmistr','tax','pop','ore','round','actor','phase','pending','result']) {
        assert.deepEqual(game[key],digital[key],key);
      }
      assert.equal(undrawnMines(game),digital.mineDeck.length);
      if (game.phase==='end') break;
      if (game.actor>0) {
        digital=playMincmistr(digital);
        game=playMincmistr(game);
      } else {
        const action=botAction(digital,'quick');
        digital=transition(digital,action);
        game=transition(game,action);
      }
    }
    assert.equal(game.phase,'end');
  }
  assert.ok(mineDraws>20);
  assert.ok(events>10);
  assert.ok(discards>0);
});

test('a draw can finish the current stock and continue from the physical discards',()=>{
  let game=createGame({tabletop:true,playerCount:3});
  const earlier=game.mineDeck;
  game.mineDeck=['m1-3','m3-1'];
  game.mineDiscard=earlier.filter(id=>!game.mineDeck.includes(id));
  game.tabletop.unseenDiscards[0]=1;
  game.technology=1;
  const mine=legalActions(game).find(move=>move.kind==='mine'&&!move.refill&&!move.as);
  game=reload(transition(game,mine));
  assert.deepEqual(physicalPrompt(game),{kind:'mine-draw',count:2,beforeShuffle:1});
  assert.throws(()=>recordPhysicalDraw(game,[face('m1-3'),face('m3-1')]),/draw order/);
  game=reload(recordPhysicalDraw(game,[face('m3-1'),face('m1-3')]));
  assert.equal(game.mineMixed,true);
  assert.deepEqual(game.tabletop.unseenDiscards,[0,0,0]);
  assert.equal(game.mineDiscard.length,0);
  assert.equal(undrawnMines(game),25);
});

test('Standard, Quick and Planner can commit their choices with physical draws enabled',()=>{
  for (const difficulty of ['standard','quick','planner']) {
    const game=createGame({tabletop:true,playerCount:3,starter:1,difficulty});
    const action=botAction(game);
    assert.doesNotThrow(()=>reload(transition(game,action)));
  }
});
