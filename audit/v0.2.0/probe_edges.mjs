// Targeted edge probes. Each prints observed behaviour; findings are judged in the report.
import {createGame,legalActions,transition,mineSpaces,taxCost,plotSpaces,income,price} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
import {MINES} from '../../src/data.mjs';
const find=(s,f)=>legalActions(s).find(f);
const out=(k,v)=>console.log(k.padEnd(34),typeof v==='string'?v:JSON.stringify(v));

// 1. Red public building: is the house removal optional?
{
  const s=createGame({seed:'red-house'});
  s.round=4; s.players[0].coins=200; s.players[0].held=['town-hall']; s.city[14]={plot:0};
  s.players[0].houses=[3,3,3]; // every row's next house sits on the 8 VP space
  // put the red tiles into the market as after round 3, minus the held one
  s.market[0].push({group:'smallcastle',tiles:['smallcastle']}); s.market[1].push({group:'school',tiles:['school']});
  s.red=['town-hall','smallcastle','school'];
  const a=find(s,x=>x.kind==='build'&&x.id==='town-hall'&&!x.as);
  const n=transition(s,a);
  out('1 red build pending',n.pending.map(p=>p.kind));
  out('1 red house choices',legalActions(n).map(x=>x.kind+(x.id?':'+x.id:'')));
}
// 2. Entrance next to an existing mine: flat 2 wood, or the higher neighbour cost?
{
  const s=createGame({seed:'entrance',mineLayout:1});
  s.mine[3]={id:'m3-1',owner:1,stars:1};     // entrance 3 (extend 6)
  s.mine[2]={id:'m2-6',owner:1,stars:1};     // beside entrance 1 (extend 5)
  out('2 entrance-1 cost (wood)',mineSpaces(s).find(m=>m.space===1));
}
// 3. Ius Regale with fewer than five tiles left in the stack
{
  const s=createGame({seed:'ius'});
  s.events[0]='code';
  s.mineDiscard=s.mineDeck.slice(3); s.mineDeck=s.mineDeck.slice(0,3);
  let g=s;
  while (g.round===1) { const acts=legalActions(g); g=transition(g,g.phase==='tax'?acts.at(-1):acts.find(x=>x.kind==='skip')); }
  out('3 after Ius: deck/discard',[g.mineDeck.length,g.mineDiscard.length]);
}
// 4. Tile 3 on the Miners row: production without ore-deck movement
{
  const s=createGame({seed:'t3'}); s.barbara=3; s.players[0].pelicans=1;
  let n=transition(s,find(s,x=>x.kind==='barbara'&&!x.as));
  const ore0=n.ore; n=transition(n,find(n,x=>x.kind==='house'&&x.id==='ore'));
  out('4 tile3 ore prod / deck moved',[n.players[0].production.ore,n.ore-ore0]);
}
// 5. Tax with King: plots surcharge doubled, cap
{
  const s=createGame({seed:'king'}); s.round=4; s.events[3]='king'; s.tax=25; for (const i of [7,8]) s.city[i]={plot:0};
  out('5 king tax at track 25 + 2 plots',taxCost(s,0));
}
// 6. Rival guild rows: does the rival ever choose its house-row order?
{
  const rows=new Set();
  for (let i=0;i<20;i++) rows.add(createGame({seed:'rows'+i,setup:1}).players[1].guilds.join('>'));
  out('6 rival row orders seen (card 1)',[...rows]);
}
// 7. Plot at reputation 3 through the Joker vs plain card
{
  const s=createGame(); s.city[8]={id:'furnace',owner:0}; s.players[0].rep=3;
  const plain=find(s,x=>x.kind==='plot'&&x.space===9&&!x.as), jok=find(s,x=>x.kind==='plot'&&x.space===9&&x.as);
  out('7 plot cost plain / joker',[plain.cost,jok.cost]);
}
// 8. Tile 8 nested Grocer build: which St. Barbara tile does the Grocer flip, and the tax
{
  const s=createGame({seed:'t8',setup:2,side:0}); // you: silver, food, ore
  s.barbara=8; s.players[0].pelicans=1; s.players[0].held=['bakery']; s.city[14]={plot:0};
  const tax0=s.tax;
  let n=transition(s,find(s,x=>x.kind==='barbara'&&!x.as));
  n=transition(n,find(n,x=>x.kind==='build'&&x.id==='bakery'));
  out('8 tile8+bakery: barbara / tax+',[n.barbara,n.tax-tax0]);
}
// 9. Free public-rights house reward when all three slots are full
{
  const s=createGame({seed:'slots'}); const p=s.players[0];
  p.held=['pump','hammer','smelter']; s.city[14]={plot:0}; p.coins=200;
  // remove those tiles from market to keep supply legal
  for (const row of s.market) for (const st of row) st.tiles=st.tiles.filter(id=>!p.held.includes(id));
  for (const row of s.market) for (let i=row.length-1;i>=0;i--) if (!row[i].tiles.length) row.splice(i,1);
  const a=find(s,x=>x.kind==='build'&&x.id==='smelter'&&!x.as);
  const n=transition(s,a);
  out('9 after build: pending / choices',[n.pending.map(x=>x.kind),legalActions(n).map(x=>x.kind+(x.id?':'+x.id:''))]);
}
// 10. Last-round reputation: going below -5
{
  const s=createGame(); s.players[0].rep=-5; s.players[0].pelicans=1; s.barbara=5;
  const n=transition(s,find(s,x=>x.kind==='barbara'&&!x.as));
  out('10 tile5 at -5: rep / vp',[n.players[0].rep,n.players[0].vp]);
}
