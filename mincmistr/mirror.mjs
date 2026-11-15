// Mincmistr vs Mincmistr: node mirror.mjs <levelA> <levelB> <games> <groups,comma>
import {createGame,transition} from '../src/engine.mjs';
import {createMincmistr,mincmistrAction,mincmistrCardsThisTurn} from './mincmistr.mjs';
const [la,lb,games,groups]=[process.argv[2],process.argv[3],Number(process.argv[4]),process.argv[5].split(',')];
const ms=[]; let wins=0, firstWins=0, n=0, firstMargin=0;
for (const group of groups) for (let i=0;i<games;i++) for (const seatA of [0,1]) {
  const starter=(i>>1)%2;
  let s=createGame({seed:`${group}-${i}`,setup:1+i%9,side:i%2,starter});
  const m=[]; m[seatA]=createMincmistr(s,seatA,la); m[1-seatA]=createMincmistr(s,1-seatA,lb);
  while (s.phase!=='end') { const mm=m[s.actor]; const e=mincmistrCardsThisTurn(s,mm); if (e) s.left=e; s=transition(s,mincmistrAction(s,mm)); }
  const sc=s.result.scores; const d=sc[seatA].total-sc[1-seatA].total; ms.push(d); n++;
  if (s.result.winner===seatA) wins++; if (s.result.winner===starter) firstWins++;
  firstMargin+=sc[starter].total-sc[1-starter].total;
}
const mean=ms.reduce((a,b)=>a+b)/n;
console.log(`${la} vs ${lb}: margin ${mean.toFixed(2)} win ${(100*wins/n).toFixed(1)}% | starter wins ${(100*firstWins/n).toFixed(1)}% starter margin ${(firstMargin/n).toFixed(2)} | n=${n}`);
