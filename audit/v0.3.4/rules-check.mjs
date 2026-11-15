import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.MINCMISTR_ROOT??fileURLToPath(new URL('../../',import.meta.url));
const output=resolve(process.argv[2]??'audit-positions');
mkdirSync(output,{recursive:true});
const load=path=>import(pathToFileURL(resolve(root,path)).href);
const [{BUILDINGS,CARDS,MINES},{actionKey,canBuildGuild,createGame,legalActions,mineSpaces,patricianBase,plotCount,price,rulesFor,transition},
  {checkGame,writeSave},{botAction},{createMincmistr,mincmistrAction,mincmistrCardsThisTurn,ROW}]=await Promise.all([
  load('src/data.mjs'),load('src/engine.mjs'),load('src/save.mjs'),load('src/bot.mjs'),load('mincmistr/mincmistr.mjs'),
]);
const save=(name,game)=>writeFileSync(resolve(output,name+'.json'),writeSave(checkGame(game)));
const printedRow=[0,5,1,2,4,3];
assert.deepEqual(ROW,printedRow);

// Regression: rules 6.6/10 AND the corrected v1.2.2 reference card include every opponent.
const edge=createGame({seed:'minc-ref-edge',playerCount:3,setup:1,starter:1});
edge.players[1].coins=15;
edge.players[1].usedPelicans=edge.players[2].usedPelicans=2;
edge.barbara=5;
edge.bank.silver=2;
edge.patrons.silver=1;
save('reference_edge_3p',edge);
const silver=edge.players.map((_,i)=>patricianBase(edge,i).silver);
assert.deepEqual(silver,[0,3,3]);
const physical=legalActions(edge).find(a=>a.kind==='income'&&a.card===2&&a.color==='silver');
assert.ok(physical);
const code=mincmistrAction(edge,createMincmistr(edge,1));
assert.ok(code.kind==='income'&&!code.color);
assert.equal(transition(edge,code).players[1].coins-transition(edge,physical).players[1].coins,10);
console.log(JSON.stringify({case:'edge',silver,reference:physical,rulebook:code}));

// CGE p. 20, tile 9. Start empty, then repeat with a pool miner and reserve miners.
for(const [pool,placed] of [[0,1],[1,0],[1,8]]) {
  let game=createGame({seed:'minc-free-mine',playerCount:3,setup:1,starter:1});
  game.barbara=9;
  game.players[1].pool=pool;
  const reserve=9-pool-placed;
  game.players[1].reserve=reserve;
  for(let i=0;i<placed;i++) {
    const id=game.mineDeck.shift();
    game.mine[mineSpaces(game)[0].space]={id,owner:1,stars:MINES[id].stars};
    game.players[1].production.ore+=MINES[id].ore;
  }
  game.players[1].pelicans=1;
  game.players[1].coins=20;
  const permit=price(game,'permit');
  save(reserve?`free_mine_pool_${pool}`:'free_mine_reserve_empty',game);
  const m=createMincmistr(game,1);
  const start=mincmistrAction(game,m);
  assert.equal(start.kind,'barbara');
  game=transition(game,start);
  const bonus=mincmistrAction(game,m);
  assert.deepEqual(bonus,{kind:'mine',refill:0,cost:0});
  game=transition(game,bonus);
  const place=mincmistrAction(game,m);
  assert.equal(place.kind,'place-mine');
  game=transition(game,place);
  assert.equal(game.players[1].coins,20);
  assert.equal(game.players[1].pool,pool-Number(reserve===0));
  assert.equal(game.players[1].reserve,Math.max(0,reserve-1));
  const second=game.pending[0]?.kind==='mine'?mincmistrAction(game,m).kind:null;
  if(!reserve) assert.equal(second,'skip');
  assert.equal(m.stats.cards,1);
  console.log(JSON.stringify({case:'free-mine',initialPool:pool,initialReserve:reserve,permit,placement:place.id,
    pool:game.players[1].pool,reserve:game.players[1].reserve,coins:game.players[1].coins,second}));
}

function referenceFlow(game,plan) {
  const p=game.players[game.actor];
  const legal=legalActions(game).filter(a=>!a.as);
  const card=kind=>printedRow.find(i=>(p.hand&(1<<i))&&CARDS[i].includes(kind));
  const allowed=kind=>legal.filter(a=>a.card===card(kind)&&a.kind===kind);
  const plot=plotCount(game,game.actor);
  const eligibleRights=allowed('rights').some(a=>{
    const b=BUILDINGS[a.id];
    return !b.public&&p.guilds.includes(b.group)&&p.houses[p.guilds.indexOf(b.group)]<4&&canBuildGuild(game,b.group);
  });
  const construct=()=>{
    if (allowed('build').length) return 'build';
    if (p.held.length>plot&&plot<3&&allowed('plot').length) return 'plot';
    if (p.held.length<2&&eligibleRights) return 'rights';
  };
  const prize=[6,7,8,9,11].includes(game.barbara);
  let kind;
  if (p.coins<20&&allowed('income').length) kind='income';
  else if ((p.pelicans>=2||(p.pelicans===1&&prize))&&allowed('barbara').length) kind='barbara';
  else for (const goal of plan.goals) {
    if (goal==='C') kind=construct();
    if (goal==='M'&&allowed('mine').length) kind='mine';
    if (goal==='S'&&allowed('barbara').length) kind='barbara';
    if (kind) break;
  }
  kind??=['income','mine'].find(k=>allowed(k).length)??'skip';
  return [kind,kind==='skip'?printedRow.find(i=>(p.hand&(1<<i))):card(kind)];
}

function concealed(game) {
  const s=structuredClone(game);
  s.rng=(s.rng^0x15892028)>>>0;
  if (s.mineMixed) s.mineDeck.reverse();
  else s.mineDeck=[1,2,3].flatMap(tier=>s.mineDeck.filter(id=>MINES[id].tier===tier).reverse());
  for(const stack of s.market.flat()) if (stack.tiles.length>2) {
    stack.tiles=[stack.tiles[0],...stack.tiles.slice(1,-1).reverse(),stack.tiles.at(-1)];
  }
  const {redRound}=rulesFor(game);
  if(game.round<=redRound) s.red.reverse();
  s.events=[...game.events.slice(0,game.round),...game.events.slice(game.round,redRound).reverse(),...game.events.slice(Math.max(game.round,redRound)).reverse()];
  return s;
}

const totals={};
for(const players of [2,3,4]) for(const level of ['apprentice','journeyman','master','grandmaster']) {
  const stats={games:0,planFlips:0,flow:0,hidden:0,bonus:0,plotQuotes:0,townFits:0,councilQuotes:0,placingMines:0,emptyPublicBonus:0};
  for(let i=0;i<6;i++) {
    const seed=`astra034-flow-${players}-${i}`;
    let game=createGame({seed,playerCount:players,setup:i+1,side:i%players,starter:i%players,events:i%2===0});
    const bots=new Map(game.players.slice(1).map((_,i)=>[i+1,createMincmistr(game,i+1,level)]));
    const auditTrace=[];
    for(let steps=0;game.phase!=='end';steps++) {
      assert.ok(steps<300,seed);
      const m=bots.get(game.actor);
      if(m) {
        const extension=mincmistrCardsThisTurn(game,m);
        if(extension) game.left=extension;
      }
      const fresh=game.phase==='action'&&!game.pending.length;
      const cloned=m?structuredClone(m):null;
      // Keep the Plan about to be revealed fixed; scramble only future Plan order.
      if(cloned&&cloned.draw.length>1)cloned.draw=[cloned.draw[0],...cloned.draw.slice(1).reverse()];
      if(cloned&&(cloned.draw.length||!fresh))cloned.rng.rng=(cloned.rng.rng^0x67ac2103)>>>0;
      const action=m?mincmistrAction(game,m):botAction(game,'standard');
      if(m) {
        assert.equal(actionKey(mincmistrAction(concealed(game),cloned)),actionKey(action));
        stats.hidden++;
        if(fresh) {
          assert.deepEqual([action.kind,action.card],referenceFlow(game,m.card),`${seed} ${game.round}/${game.turn}`);
          stats.flow++;
        } else if(game.pending.length) stats.bonus++;
        const relevant=legalActions(game).filter(a=>a.kind===action.kind&&a.card===action.card&&!a.as);
        if (action.kind==='plot') {
          stats.plotQuotes+=relevant.length;
          if(level!=='apprentice') stats.townFits+=relevant.length*game.players[game.actor].held.length;
        }
        if (action.kind==='income') stats.councilQuotes+=relevant.filter(a=>a.color).length;
        if(action.kind==='place-mine'||action.kind==='technology') stats.placingMines++;
        if(action.kind==='barbara'&&game.barbara===7&&patricianBase(game,game.actor).green===0) stats.emptyPublicBonus++;
      }
      if(players===4&&level==='master'&&i===0) auditTrace.push({round:game.round,turn:game.turn,actor:game.actor,
        phase:game.phase,pending:game.pending[0]?.kind,plan:m?.card?.number,action});
      game=transition(game,action);
    }
    stats.planFlips+=[...bots.values()].reduce((n,m)=>n+m.stats.cards,0);
    stats.games++;
    if(auditTrace.length) writeFileSync(resolve(output,'master_4p_trace.json'),JSON.stringify({seed,playerCount:players,
      level,setup:i+1,side:i%players,starter:i%players,events:i%2===0,result:game.result,trace:auditTrace},null,2)+'\n');
  }
  totals[`${players}/${level}`]=stats;
}
console.log(JSON.stringify({checks:totals}));
