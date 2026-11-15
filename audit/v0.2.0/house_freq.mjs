// How often does a seat take the 2nd+ house from row 3 in Standard-vs-Standard games (shipped engine)?
import {createGame,transition} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
const n=Number(process.argv[2]??24);
const hist=[0,0,0,0,0]; let repDelta=0, vpCloseGames=0;
for (let i=0;i<n;i++) {
  let s=createGame({seed:`house-freq-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  while (s.phase!=='end') s=transition(s,botAction(s,'standard'));
  for (const p of s.players) {
    hist[p.houses[2]]++;
    // reputation shortfall vs printed board (ignoring knock-on threshold effects)
    const printed=[0,1,4,8,8][p.houses[2]], app=[0,1,3,6,10][p.houses[2]];
    repDelta+=Math.abs(printed-app);
  }
  if (Math.abs(s.result.scores[0].total-s.result.scores[1].total)<=3) vpCloseGames++;
}
console.log(JSON.stringify({players:2*n,row3HousesRemovedHistogram:hist,meanAbsRepError:(repDelta/(2*n)).toFixed(2),gamesDecidedBy3orLess:vpCloseGames}));
