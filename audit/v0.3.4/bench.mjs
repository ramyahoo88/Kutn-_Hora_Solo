import {independent} from './independent-policy.mjs';
import assert from 'node:assert/strict';
import {appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isMainThread,parentPort,Worker,workerData} from 'node:worker_threads';

const root=process.env.MINCMISTR_ROOT??fileURLToPath(new URL('../../',import.meta.url));
const load=path=>import(pathToFileURL(resolve(root,path)).href);
const [{BUILDINGS,MINE_GROUPS},{canBuildGuild,createGame,legalActions,marketOffer,plotCount,price,rulesFor,seedNumber,transition},{botAction,BOT_POLICIES},{shuffle},
  {createMincmistr,mincmistrAction,mincmistrCardsThisTurn,PLAN_DECK}]=await Promise.all([
  load('src/data.mjs'),load('src/engine.mjs'),load('src/bot.mjs'),load('src/random.mjs'),load('mincmistr/mincmistr.mjs'),
]);

const RIVAL=process.env.MINCMISTR_PLANNER_ROOT??root;
let plannedBot=null;
if(RIVAL) {
  const plannerData=await import(pathToFileURL(resolve(RIVAL,'src/data.mjs')).href);
  assert.ok(plannerData.RIVAL_SETTINGS?.includes('planner'),
    'MINCMISTR_PLANNER_ROOT must contain Planner.');
  plannedBot=(await import(pathToFileURL(resolve(RIVAL,'src/bot.mjs')).href)).botAction;
}
const buildingCount=Object.keys(BUILDINGS).length;
const mines=new Set(MINE_GROUPS.flat().map(tile=>tile.id));
const bits=hand=>hand.toString(2).replace(/0/g,'').length;

function checkSupplies(game,redRound) {
  for (const [seat,player] of game.players.entries()) {
    assert.ok(player.coins>=0&&player.rep>=-5&&player.rep<=9&&player.pool>=0&&player.pool<=2);
    assert.equal(player.pool+player.reserve+game.mine.filter(cell=>cell?.owner===seat).length,9);
    assert.ok(plotCount(game,seat)<=3&&player.held.length<=3&&player.houses.every(x=>x>=0&&x<=4));
  }
  const buildings=[...game.players.flatMap(p=>p.held),...game.market.flatMap(row=>row.flatMap(s=>s.tiles)),
    ...game.city.flatMap(cell=>cell?.id?[cell.id]:[]),...game.marketDiscard,...(game.round<=redRound?game.red:[])];
  const mineTiles=[...game.mineDeck,...game.mineDiscard,...game.pending.flatMap(item=>item.drawn??[]),
    ...game.mine.flatMap(cell=>mines.has(cell?.id)?[cell.id]:[])];
  assert.equal(buildings.length,buildingCount);
  assert.equal(new Set(buildings).size,buildingCount);
  assert.equal(mineTiles.length,mines.size);
  assert.equal(new Set(mineTiles).size,mines.size);
  for(const color of Object.keys(game.bank)) assert.equal(game.bank[color]+game.council[color]+game.patrons[color],3);
}

function newSharedDeck(seed) {
  const rng={rng:seedNumber(`mincmistr-audit/shared/${seed}`)};
  return {rng,draw:shuffle(rng,PLAN_DECK.map((_,i)=>i)),discard:[]};
}

// Test the published rights-denial idea at tables where guilds are shared.
function interceptRight(game, mm) {
  if(game.phase!=='action'||game.pending.length) return null;
  const seat=(game.actor+1)%game.players.length;
  const other=game.players[seat];
  if(!mm[seat]||other.held.length>=2||!(other.hand&((1<<4)|(1<<5)))) return null;
  const incomeValue=id=>BUILDINGS[id].production*price(game,BUILDINGS[id].group);
  const right=marketOffer(game).filter(({id,cost})=>{
    const b=BUILDINGS[id], row=other.guilds.indexOf(b.group);
    return row>=0&&other.houses[row]<4&&cost<=other.coins&&canBuildGuild(game,b.group);
  }).sort((a,b)=>incomeValue(b.id)-incomeValue(a.id)||a.cost-b.cost)[0];
  return right?.cost<=8?legalActions(game).find(a=>a.kind==='rights'&&!a.as&&a.id===right.id):null;
}

function play(config,focus) {
  const {seed,players,level,policy,deck='individual',setup,side,starter,events,mode='solo'}=config;
  let game=createGame({seed,playerCount:players,setup,side,starter,events});
  const {rounds,redRound}=rulesFor(game);
  const mm=game.players.map((_,seat)=>!config.digitalOpponent&&(mode==='solo'?seat!==focus:seat===focus)?createMincmistr(game,seat,level):null);
  const common=deck==='shared'?newSharedDeck(seed):null;
  const opponent=['industry','mining','council-focus','blockade'].includes(policy)?((g)=>independent(g,policy==='council-focus'?'council':policy)):policy==='planner'?plannedBot:botAction;
  assert.ok(opponent,'Set MINCMISTR_PLANNER_ROOT to a checkout of v0.3.1-playtest.');
  let spent=0,steps=0,paperCards=0,paperSkips=0,interceptions=0;
  while (game.phase!=='end') {
    assert.ok(++steps<=300,`Stalled on ${seed}`);
    const m=mm[game.actor];
    const fresh=game.phase==='action'&&!game.pending.length;
    const beforeRound=game.round, beforeTurn=game.turn, beforePhase=game.phase;
    const last=beforeTurn>=2*players;
    const double=m&&last&&(level==='grandmaster'||(level==='master'&&beforeRound>=rounds-2));
    const expect=last?(double?2:1):2;
    if(m&&fresh) {
      const extension=mincmistrCardsThisTurn(game,m);
      assert.equal(extension,double&&spent===0?2:null,`${seed} round ${game.round} turn ${game.turn}`);
      if (extension) game.left=extension;
      if (common) Object.assign(m,common);
    }
    const flips=m?.stats.cards;
    const intercept=!m&&policy==='rights-denial'?interceptRight(game,mm):null;
    if(intercept) interceptions++;
    const action=m?mincmistrAction(game,m):intercept??(config.digitalOpponent&&game.actor!==focus?botAction(game,config.digitalOpponent):opponent(game,policy==='rights-denial'?'standard':policy));
    if (m) {
      assert.ok(!action.as);
      assert.equal(m.stats.cards-flips,Number(fresh));
      if (fresh) {
        assert.equal(new Set([...m.draw,...m.discard]).size,PLAN_DECK.length);
        assert.equal(m.draw.length+m.discard.length,PLAN_DECK.length);
        if (common) Object.assign(common,{draw:m.draw,discard:m.discard});
        paperCards++;
        paperSkips+=Number(action.kind==='skip');
      }
    }
    if (fresh) {
      assert.ok(game.players[game.actor].hand&(1<<action.card));
      spent++;
    }
    const next=transition(game,action);
    if (fresh) {
      const expectedHand=next.round===game.round?bits(game.players[game.actor].hand)-1:6;
      assert.equal(bits(next.players[game.actor].hand),expectedHand);
    }
    if (beforePhase==='action'&&(beforeRound!==next.round||beforeTurn!==next.turn||next.phase!=='action')) {
      assert.equal(spent,expect,`${seed} round ${beforeRound} turn ${beforeTurn}`);
      spent=0;
    }
    game=next;
    checkSupplies(game,redRound);
  }
  const tot=game.result.scores.map(score=>score.total);
  return {focus,winner:game.result.winner,winners:game.result.winners,tot,coins:game.result.scores.map(s=>s.coins),
    paperCards,paperSkips,steps,interceptions};
}

if (!isMainThread) {
  for (const config of workerData) {
    const rows=Array.from({length:config.players},(_,seat)=>play(config,seat));
    parentPort.postMessage({ ...config, rows });
  }
} else {
  const [input,output]=process.argv.slice(2);
  assert.ok(input&&output,'node bench.mjs configurations.json results.jsonl');
  const groups=JSON.parse(readFileSync(input,'utf8'));
  for(const cfg of groups){
    assert.ok([...BOT_POLICIES,'rights-denial','industry','mining','council-focus','blockade'].includes(cfg.policy),'Unknown challenger: '+cfg.policy);
    assert.ok(!cfg.digitalOpponent||BOT_POLICIES.includes(cfg.digitalOpponent),'Unknown opponent: '+cfg.digitalOpponent);
    assert.ok([2,3,4].includes(cfg.players)&&Number.isInteger(cfg.boards)&&cfg.boards>0,'Invalid table or board count');
    assert.ok(['apprentice','journeyman','master','grandmaster'].includes(cfg.level),'Unknown paper level');
  }
  const starts=groups.flatMap(({boards,prefix,published=false,...cfg})=>Array.from({length:boards},(_,i)=>({
    ...cfg,seed:`${prefix}-${i}`,setup:1+i%9,side:i%(published?2:cfg.players),starter:published?i%cfg.players:(i+Math.floor(i/9))%cfg.players,
  })));
  starts.sort((a,b)=>(b.policy==='planner')-(a.policy==='planner')||b.players-a.players);
  writeFileSync(output,'');
  const jobs=Math.min(Number(process.env.MINCMISTR_JOBS??6),starts.length);
  let complete=0;
  await Promise.all(Array.from({length:jobs},(_,i)=>new Promise((yes,no)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:starts.filter((_,j)=>j%jobs===i)});
    worker.on('message',row=>{
      appendFileSync(output,JSON.stringify(row)+'\n');
      complete++;
      if (complete%25===0||complete===starts.length) console.error(`${complete}/${starts.length} starting boards complete`);
    });
    worker.once('error',no);
    worker.once('exit',code=>code===0?yes():no(Error(`Worker exited ${code}`)));
  })));
}
