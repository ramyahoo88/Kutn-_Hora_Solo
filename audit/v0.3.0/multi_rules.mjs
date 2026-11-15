// Rule edges specific to 3–4 players (v0.3.0). Usage: node multi_rules.mjs <srcDir>
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const src=pathToFileURL(resolve(process.argv[2]??'../../src')).href;
const E=await import(`${src}/engine.mjs`), D=await import(`${src}/data.mjs`);
const say=(k,v)=>console.log(k.padEnd(44),typeof v==='string'?v:JSON.stringify(v));

// 1. Mine rank awards with ties (rulebook: tied players take the full place value; places are used up).
function rowWith(count, starsBySeat, rockStars=0) {
  const s=E.createGame({playerCount:count,seed:'ranks'});
  s.mine=s.mine.map(()=>null);
  let col=0;
  starsBySeat.forEach((stars,seat)=>{ if (stars) s.mine[col++]={id:'m1-1',owner:seat,stars}; });
  if (rockStars) s.mine[col++]={rock:true,stars:rockStars};
  return E.mineRow(s,0);
}
for (const [count,stars,rock,expect] of [
  [4,[3,3,1,0],0,[3,3,1,0]],   // 7★: 3/2/1 – two tie first, next is third
  [4,[5,2,2,1],0,[5,3,3,0]],   // 10★: tie for 2nd/3rd gets 2nd, nobody 3rd, 4th place scores 0
  [3,[2,2,2],0,[3,3,3]],       // 6★: three-way tie for first
  [3,[1,1,0],3,[2,2,0]],       // 5★ incl. rock: 2/1/0
  [4,[4,4,1,1],0,[3,3,1,1]],   // 10★ boundary: two firsts 5? check
]) {
  const r=rowWith(count,stars,rock);
  say(`1 ${count}p stars ${stars} rock ${rock} total ${r.total}`,{vp:r.vp,awards:r.awards});
}
// 2. Starting groschen follow seat order from the starting player.
for (const count of [3,4]) for (let starter=0;starter<count;starter++)
  say(`2 ${count}p starter ${starter} coins`,E.createGame({playerCount:count,seed:'coins',starter}).players.map(p=>p.coins));
// 3. Shared guilds: both owners may take rights and build; the commodity arm moves once per building.
{
  const s=E.createGame({playerCount:3,seed:'shared',setup:1,side:0}); // card 1: geb / ime / sbm → silver shared by sets 1 and 2
  const owners=s.players.map((p,i)=>[i,p.guilds]);
  say('3 card-1 guilds by seat',owners);
  const silverOwners=s.players.flatMap((p,i)=>p.guilds.includes('silver')?[i]:[]);
  say('3 seats holding Metallurgists',silverOwners);
  const offer=E.marketOffer(s).find(o=>D.BUILDINGS[o.id].group==='silver');
  for (const seat of [0,1,2]) {
    const t=structuredClone(s); t.actor=seat; t.starter=seat;
    say(`3 seat ${seat} may take ${offer.id} rights`,E.legalActions(t).some(a=>a.kind==='rights'&&a.id===offer.id&&!a.as));
  }
}
// 4. Tax order and starter rotation at 4 players.
{
  let s=E.createGame({playerCount:4,seed:'order',starter:2});
  const order=[];
  for (let i=0;i<12;i++) { order.push(s.actor); s=E.transition(s,E.legalActions(s).find(a=>a.kind==='skip')); }
  say('4 round-1 turn actors (starter 2)',order);
  say('4 round-2 starter',s.starter);
}
// 5. Optional events at 4 players: two A before red (after round 2), two B, final round empty.
{
  const s=E.createGame({playerCount:4,seed:'ev',events:true});
  say('5 4p events',s.events.map(id=>`${id}:${D.EVENTS[id].set}`));
  const t=E.createGame({playerCount:3,seed:'ev',events:true});
  say('5 3p events',t.events.map(id=>`${id}:${D.EVENTS[id].set}`));
  say('5 3p default events',E.createGame({playerCount:3,seed:'ev'}).events);
}
// 6. Shared first place.
{
  const s=E.createGame({playerCount:3,seed:'tie'}); s.round=6;
  for (const p of s.players) { p.vp=10; p.coins=50; }
  s.players[2].coins=49;
  const r=E.finalResult(s);
  say('6 3p tie on VP and groschen → winners',{winners:r.winners,winner:r.winner,totals:r.scores.map(x=>x.total)});
}
