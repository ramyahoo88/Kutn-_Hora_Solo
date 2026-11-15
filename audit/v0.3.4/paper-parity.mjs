import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
assert.ok(process.env.MINCMISTR_V122_ROOT,'Set MINCMISTR_V122_ROOT to the audited e6806e6 checkout.');
const {createGame:originalGame,transition:originalPlay}=await import(pathToFileURL(resolve(process.env.MINCMISTR_V122_ROOT,'src/engine.mjs')));
const {botAction:originalBot}=await import(pathToFileURL(resolve(process.env.MINCMISTR_V122_ROOT,'src/bot.mjs')));
const {
  createMincmistr,mincmistrAction,mincmistrCardsThisTurn,
}=await import(pathToFileURL(resolve(process.env.MINCMISTR_V122_ROOT,'mincmistr/mincmistr.mjs')));
import {createGame,transition} from '../../src/engine.mjs';
import {playMincmistr} from '../../src/mincmistr.mjs';
import {checkGame,readSave,writeSave} from '../../src/save.mjs';

function comparable(state) {
  const {mincmistr,left,difficulty,log,...rest}=state;
  return {...rest,log:log.filter(entry=>!/^Plan \d+ ·/.test(entry.text))};
}

let cases=0,decisions=0,flips=0;
for(const count of [2,3,4]) {
  const levels=['apprentice','journeyman','master','grandmaster'];
  const configurations=levels.map(level=>({level,tougher:false}));
  if(count===3) configurations.push({level:'master',tougher:true});
  for(const config of configurations) for(const shared of count===2?[true]:[true,false]) for(let i=0;i<2;i++) {
    const options={seed:`paper-v122-${count}-${config.level}-${config.tougher}-${shared}-${i}`,
      setup:(cases%9)+1,side:cases%count,starter:(i+1)%count,events:i===0,playerCount:count};
    let paper=originalGame(options);
    let digital=createGame({...options,difficulty:'mincmistr',mincmistr:{...config,shared}});
    const bots=paper.players.slice(1).map((_,j)=>createMincmistr(paper,j+1,config.level));
    if(config.tougher) for(const bot of bots) bot.settings={...bot.settings,extraCard:[3,4,5,6]};
    const common=shared?createMincmistr(paper,1,config.level):null;
    let local=0;
    while (paper.phase!=='end') {
      assert.ok(++local<=300,options.seed);
      assert.deepEqual(comparable(digital),comparable(paper),options.seed);
      const previous=writeSave(digital);
      const bot=bots[paper.actor-1];
      if(bot) {
        const extra=mincmistrCardsThisTurn(paper,bot);
        if(extra) paper.left=extra;
        if(common) Object.assign(bot,{rng:common.rng,draw:common.draw,discard:common.discard});
      }
      assert.equal(digital.left,paper.left,options.seed);
      const beforeFlips=bot?.stats.cards;
      const choice=bot?mincmistrAction(paper,bot):originalBot(paper,'quick');
      if(bot&&common) Object.assign(common,{draw:bot.draw,discard:bot.discard});
      const next=bot?playMincmistr(digital):transition(digital,choice);
      assert.equal(writeSave(digital),previous);
      if(bot&&bot.stats.cards>beforeFlips) {
        assert.equal(next.mincmistr.lastPlans[paper.actor-1],bot.card.number-1);
        flips++;
      }
      const expected=common?[common]:bots;
      for(let j=0;j<expected.length;j++) {
        const deck=expected[j];
        assert.deepEqual(next.mincmistr.decks[j],{rng:deck.rng,draw:deck.draw,discard:deck.discard},options.seed);
      }
      paper=originalPlay(paper,choice);
      digital=readSave(writeSave(checkGame(next)));
      decisions++;
    }
    assert.deepEqual(comparable(digital),comparable(paper),options.seed);
    assert.equal(digital.left,paper.left,options.seed);
    cases++;
  }
}
console.log(`${cases} matched games, ${decisions} matching decisions and ${flips} matching Plan draws against v1.2.2.`);
