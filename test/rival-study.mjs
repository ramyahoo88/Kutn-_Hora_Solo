import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {botAction} from '../src/bot.mjs';
import {createGame,legalActions,plotCount,transition} from '../src/engine.mjs';
import {checkGame} from '../src/save.mjs';

const seedsPerGroup=Number(process.argv[2]??12);
const seedPrefix=process.argv[3]??'rival-plans-v030';
assert.ok(Number.isInteger(seedsPerGroup)&&seedsPerGroup>0);

function runGame(options, policies) {
  let game=createGame(options);
  const players=game.players.map(()=>({
    opening:[],income:0,mines:0,builds:0,rights:0,plots:0,
    council:0,barbara:0,bills:0,declinedAffordable:0,paid:0,taxes:0,skips:0,decisions:0,ms:0,
  }));
  let steps=0;
  while(game.phase!=='end') {
    assert.ok(++steps<=300,`Stalled game ${options.seed}`);
    const seat=game.actor;
    const stats=players[seat];
    const start=performance.now();
    const action=botAction(game,policies[seat]);
    stats.ms+=performance.now()-start;
    stats.decisions++;
    assert.ok(action,`Missing action in ${options.seed}`);
    const printedCard=game.phase==='action'&&!game.pending.length;
    if (printedCard && game.round===1) stats.opening.push(action.kind);
    if (game.phase==='tax') {
      stats.taxes++;
      const payment=legalActions(game).find(choice=>choice.kind==='tax'&&choice.cost>0);
      stats.bills+=Number(!!payment);
      stats.declinedAffordable+=Number(!!payment&&action.kind==='penalty');
      stats.paid+=Number(action.kind==='tax'&&action.cost>0);
    }
    stats.income+=Number(printedCard&&action.kind==='income');
    stats.skips+=Number(printedCard&&action.kind==='skip');
    stats.mines+=Number(action.kind==='place-mine'||action.kind==='technology');
    for(const kind of ['build','rights','plot','barbara']){
      if(action.kind===kind)stats[{build:'builds',rights:'rights',plot:'plots',barbara:'barbara'}[kind]]++;
    }
    stats.council+=Number(action.kind==='patrician'||(action.kind==='income'&&!!action.color));
    game=transition(game,action);
    checkGame(game);
  }
  return {
    options,policies,steps,
    seats:players.map((stats,seat)=>({
      ...stats,rep:game.players[seat].rep,held:game.players[seat].held.length,unbuilt:plotCount(game,seat),
      vp:game.result.scores[seat].total,
      margin:game.result.scores[seat].total-Math.max(...game.result.scores.flatMap((score,i)=>i===seat?[]:[score.total])),
      win:game.result.winner===seat,draw:game.result.winners.includes(seat)&&game.result.winners.length>1,
    })),
  };
}

function summarize(rows) {
  const sum=key=>rows.reduce((total,row)=>total+row[key],0);
  const avg=key=>Number((sum(key)/rows.length).toFixed(2));
  const openings=rows.map(row=>row.opening.join('/'));
  return {
    seatGames:rows.length,wins:rows.filter(row=>row.win).length,sharedFirsts:rows.filter(row=>row.draw).length,
    margin:avg('margin'),incomeCards:avg('income'),mines:avg('mines'),builds:avg('builds'),
    rights:avg('rights'),plots:avg('plots'),unusedRights:avg('held'),unusedPlots:avg('unbuilt'),
    council:avg('council'),barbara:avg('barbara'),rep:avg('rep'),skips:avg('skips'),
    affordableBills:sum('bills'),declinedAffordable:sum('declinedAffordable'),paid:sum('paid'),
    openings:new Set(openings).size,plotThenRights:openings.filter(opening=>opening.startsWith('plot/rights/')).length,
    msPerDecision:Number((sum('ms')/sum('decisions')).toFixed(2)),
  };
}

const total=[];
for(const group of ['rival-plans-pilot','rival-plans-confirm']){
  const baseline=[],tuned=[];
  for(let i=0;i<seedsPerGroup;i++){
    const options={seed:`${seedPrefix}-${group}-${i}`,setup:i%9+1,side:i%2,starter:Math.floor(i/2)%2};
    const control=runGame(options,['classic','classic']);
    baseline.push(...control.seats);
    const variants=[0,1].map(seat=>runGame(options,seat===0?['standard','classic']:['classic','standard']));
    for(const [seat,game] of variants.entries()) tuned.push(game.seats[seat]);
    total.push({options,control,variants});
  }
  console.log(JSON.stringify({group,baseline:summarize(baseline),tuned:summarize(tuned)}));
}
console.log(JSON.stringify({
  combined:{
    baseline:summarize(total.flatMap(game=>game.control.seats)),
    tuned:summarize(total.flatMap(game=>game.variants.map((variant,seat)=>variant.seats[seat]))),
  },
}));

for(const playerCount of [3,4]){
  let steps=0;
  const table=[];
  for(let i=0;i<seedsPerGroup;i++){
    const options={playerCount,seed:`${seedPrefix}-table-${playerCount}-${i}`,setup:i%9+1,
      side:i%playerCount,starter:Math.floor(i/2)%playerCount,events:i%2===1};
    const policies=['standard','quick','builder','council'].slice(0,playerCount);
    const game=runGame(options,policies);
    steps+=game.steps;
    table.push(game.seats[0]);
  }
  console.log(JSON.stringify({playerCount,games:seedsPerGroup,steps,standard:summarize(table)}));
}
