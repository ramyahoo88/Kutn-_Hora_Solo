// Behaviour profile of the Standard rival (seat 1) against Standard with printed rows (seat 0), v0.2.2.
import {createGame,transition,legalActions,plotCount} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
import {BUILDINGS} from '../../src/data.mjs';
const n=Number(process.argv[2]??30);
const t={cards:0,kinds:{},joker:0,jokerAs:{},skips:0,publicBuilds:0,guildBuilds:0,mines:0,barbara:0,seat:0,
  taxPaid:0,taxRefused:0,taxRefusedAffordable:0,endCash:[],endVP:[],endRep:[],unbuiltPlots:0,heldAtEnd:0,
  firstTurn:{},incomeRounds:[0,0,0,0,0,0],plotsHeld:0,plotSamples:0,thinkMs:[]};
for (let i=0;i<n;i++) {
  let s=createGame({seed:`profile-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  let first=[];
  while (s.phase!=='end') {
    const t0=performance.now();
    const a=botAction(s,'standard');
    if (s.actor===1) {
      t.thinkMs.push(performance.now()-t0);
      if (s.phase==='tax') {
        if (a.kind==='tax') t.taxPaid++; else { t.taxRefused++; if (legalActions(s).some(x=>x.kind==='tax')) t.taxRefusedAffordable++; }
      } else if (!s.pending.length) {
        t.cards++; t.kinds[a.kind]=(t.kinds[a.kind]??0)+1;
        if (a.as) { t.joker++; t.jokerAs[a.as]=(t.jokerAs[a.as]??0)+1; }
        if (a.kind==='skip') t.skips++;
        if (a.kind==='build') BUILDINGS[a.id].public?t.publicBuilds++:t.guildBuilds++;
        if (a.kind==='barbara') t.barbara++;
        if (a.kind==='income') t.incomeRounds[s.round-1]++;
        if (s.round===1) first.push(a.kind);
        t.plotsHeld+=plotCount(s,1); t.plotSamples++;
      } else if (a.kind==='place-mine'||a.kind==='technology') t.mines++;
      else if (a.kind==='patrician'||(a.kind==='income'&&a.color)) t.seat++;
      if (!s.pending.length && a.kind==='income' && a.color) t.seat++;
    }
    s=transition(s,a);
  }
  const p=s.players[1];
  t.endCash.push(p.coins); t.endVP.push(s.result.scores[1].total); t.endRep.push(p.rep);
  t.unbuiltPlots+=plotCount(s,1); t.heldAtEnd+=p.held.length;
  const key=first.join(' > '); t.firstTurn[key]=(t.firstTurn[key]??0)+1;
}
const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length);
const per=x=>(x/n).toFixed(1);
console.log(JSON.stringify({games:n,cardsPerGame:per(t.cards),
  cardMix:Object.fromEntries(Object.entries(t.kinds).map(([k,v])=>[k,per(v)])),
  jokerPerGame:per(t.joker),jokerAs:t.jokerAs,emptyCardsPerGame:per(t.skips),
  guildBuilds:per(t.guildBuilds),publicBuilds:per(t.publicBuilds),minesPlaced:per(t.mines),stBarbara:per(t.barbara),councilSeats:per(t.seat),
  incomeByRound:t.incomeRounds.map(x=>per(x)),
  taxPaid:t.taxPaid,taxRefused:t.taxRefused,refusedThoughAffordable:t.taxRefusedAffordable,
  endCashAvg:avg(t.endCash).toFixed(1),endVPavg:avg(t.endVP).toFixed(1),endRepAvg:avg(t.endRep).toFixed(1),
  unbuiltPlotsAtEnd:per(t.unbuiltPlots),rightsHeldAtEnd:per(t.heldAtEnd),avgPlotsHeldWhenActing:(t.plotsHeld/t.plotSamples).toFixed(2),
  distinctRound1Plans:Object.keys(t.firstTurn).length,topRound1Plans:Object.entries(t.firstTurn).sort((a,b)=>b[1]-a[1]).slice(0,4),
  thinkMsMedian:t.thinkMs.sort((a,b)=>a-b)[Math.floor(t.thinkMs.length/2)].toFixed(0),thinkMsMax:Math.max(...t.thinkMs).toFixed(0)},null,1));
