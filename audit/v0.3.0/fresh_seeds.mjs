// Per-game record of the fresh-seed confirmation run (`node test/rival-study.mjs 12 audit-fresh-nov15`).
// Replays the same starts and policies as test/rival-study.mjs and writes fresh-seeds.json.
// Usage, from this folder: node fresh_seeds.mjs [seedsPerGroup] [prefix]
import {writeFileSync} from 'node:fs';
import {botAction} from '../../src/bot.mjs';
import {createGame,legalActions,plotCount,transition} from '../../src/engine.mjs';

const perGroup=Number(process.argv[2]??12);
const prefix=process.argv[3]??'audit-fresh-nov15';

function play(options, policies) {
  let game=createGame(options);
  const declined=game.players.map(()=>0), bills=game.players.map(()=>0), skips=game.players.map(()=>0);
  while (game.phase!=='end') {
    const seat=game.actor;
    const action=botAction(game,policies[seat]);
    if (game.phase==='tax') {
      const payable=legalActions(game).some(choice=>choice.kind==='tax'&&choice.cost>0);
      bills[seat]+=Number(payable);
      declined[seat]+=Number(payable&&action.kind==='penalty');
    } else if (!game.pending.length && action.kind==='skip') skips[seat]++;
    game=transition(game,action);
  }
  return game.players.map((p,seat)=>{
    const totals=game.result.scores.map(score=>score.total);
    return {
      policy:policies[seat],vp:totals[seat],
      margin:totals[seat]-Math.max(...totals.filter((_,i)=>i!==seat)),
      win:game.result.winner===seat,rep:p.rep,unusedRights:p.held.length,unusedPlots:plotCount(game,seat),
      affordableBills:bills[seat],declinedAffordable:declined[seat],cardsForNoEffect:skips[seat],
    };
  });
}

const twoPlayer=[], tables=[];
for (const group of ['rival-plans-pilot','rival-plans-confirm']) {
  for (let i=0;i<perGroup;i++) {
    const options={seed:`${prefix}-${group}-${i}`,setup:i%9+1,side:i%2,starter:Math.floor(i/2)%2};
    const control=play(options,['classic','classic']);
    const standardSeat0=play(options,['standard','classic']);
    const standardSeat1=play(options,['classic','standard']);
    twoPlayer.push({group,options,control,standardSeat0:standardSeat0[0],standardSeat1:standardSeat1[1]});
  }
}
for (const playerCount of [3,4]) {
  for (let i=0;i<perGroup;i++) {
    const options={playerCount,seed:`${prefix}-table-${playerCount}-${i}`,setup:i%9+1,
      side:i%playerCount,starter:Math.floor(i/2)%playerCount,events:i%2===1};
    const policies=['standard','quick','builder','council'].slice(0,playerCount);
    tables.push({options,policies,seats:play(options,policies)});
  }
}
const tuned=twoPlayer.flatMap(game=>[game.standardSeat0,game.standardSeat1]);
const control=twoPlayer.flatMap(game=>game.control);
const sum=(rows,key)=>rows.reduce((total,row)=>total+Number(row[key]),0);
const summary={
  command:`node test/rival-study.mjs ${perGroup} ${prefix}`,
  twoPlayer:{
    classic:{seatGames:control.length,wins:sum(control,'win'),declinedAffordable:sum(control,'declinedAffordable'),affordableBills:sum(control,'affordableBills')},
    standard:{seatGames:tuned.length,wins:sum(tuned,'win'),meanMargin:Number((sum(tuned,'margin')/tuned.length).toFixed(2)),
      declinedAffordable:sum(tuned,'declinedAffordable'),affordableBills:sum(tuned,'affordableBills')},
  },
  tables:Object.fromEntries([3,4].map(count=>{
    const seats=tables.filter(t=>t.options.playerCount===count).map(t=>t.seats[0]);
    return [count,{games:seats.length,standardWins:sum(seats,'win'),meanMargin:Number((sum(seats,'margin')/seats.length).toFixed(2))}];
  })),
};
writeFileSync('fresh-seeds.json',JSON.stringify({summary,twoPlayer,tables},null,1)+'\n');
console.log(JSON.stringify(summary,null,1));
