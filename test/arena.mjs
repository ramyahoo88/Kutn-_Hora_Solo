import {performance} from 'node:perf_hooks';
import {botAction} from '../src/bot.mjs';
import {createGame,transition} from '../src/engine.mjs';
import {checkGame} from '../src/save.mjs';

const pairCount=Number(process.argv[2]??8);
const opponentList=(process.argv[3]??'quick,builder,miner,council,denial').split(',');
const seedGroup=process.argv[4]??'nov-playtest';
const setupCards=[1,2,3,4,5,6,7,8,9];
const started=performance.now();
const summarize=set=>{
  const counts=set.reduce((tot,row)=>[tot[0]+Number(row.win),tot[1]+Number(row.draw),tot[2]+Number(!row.win&&!row.draw)],[0,0,0]);
  const average=get=>Number((set.reduce((s,row)=>s+get(row),0)/set.length).toFixed(2));
  return {games:set.length,wins:counts[0],draws:counts[1],losses:counts[2],
    averageMargin:average(row=>row.margin),rivalCash:average(row=>row.cash),
    builds:average(row=>row.builds),councilVisits:average(row=>row.council),
    skipped:average(row=>row.skipped)};
};
const all=[];
for (const strategy of opponentList) {
  const rows=[];
  for (let i=0;i<pairCount;i++) for (const testSeat of [0,1]) {
    let game=createGame({seed:`${seedGroup}-${i}`,setup:setupCards[i%setupCards.length],side:i%2,starter:Math.floor(i/2)%2});
    let count=0;
    const actions={builds:0,council:0,skipped:0};
    while (game.phase!=='end') {
      if (++count>250) throw Error(`Game stalled at ${game.seed}.`);
      const action=botAction(game,game.actor===testSeat?'standard':strategy);
      if (!action) throw Error(`No action at ${game.seed}.`);
      if (game.actor===testSeat) {
        actions.builds+=Number(action.kind==='build');
        actions.council+=Number(action.kind==='patrician'||action.kind==='income'&&!!action.color);
        actions.skipped+=Number(action.kind==='skip'&&!game.pending.length);
      }
      game=transition(game,action);
      checkGame(game);
    }
    const scores=game.result.scores;
    rows.push({seed:game.seed,testSeat,win:game.result.winner===testSeat,draw:game.result.winner===null,
      margin:scores[testSeat].total-scores[1-testSeat].total,cash:scores[testSeat].coins,...actions});
  }
  all.push(...rows);
  console.log(JSON.stringify({opponent:strategy,...summarize(rows)}));
}
console.log(JSON.stringify({total:summarize(all),seconds:Number(((performance.now()-started)/1000).toFixed(2)),seedGroup}));
