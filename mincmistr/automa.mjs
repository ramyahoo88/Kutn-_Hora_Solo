// The Mincmistr: a card-driven tabletop opponent for Kutná Hora.
// Every function here corresponds to a printed rule. Keep the two in exact agreement.
import {BUILDINGS,CARDS,MINES,PATRICIANS} from '../src/data.mjs';
import {
  canBuildGuild,cityPointsAt,income,legalActions,marketOffer,mineRow,mineRows,patricianBase,plotCount,price,rulesFor,seedNumber,taxCost,
} from '../src/engine.mjs';
import {shuffle} from '../src/random.mjs';

// Goals: C = Construct (Build ▸ Plot ▸ Rights), M = Mine, I = Income, S = St. Barbara.
// Focus breaks ties: a commodity (wood, food, beer, ore, silver, permit) or 'public'.
// Arrow breaks positional ties: 'low' = lowest space number (reading order), 'high' = highest.
export const DECKS = {
  v1: [
    {goals:['C','I','M'],focus:'wood',arrow:'low'},
    {goals:['C','M','I'],focus:'food',arrow:'high'},
    {goals:['I','C','M'],focus:'beer',arrow:'low'},
    {goals:['M','C','I'],focus:'ore',arrow:'high'},
    {goals:['C','I','S'],focus:'silver',arrow:'low'},
    {goals:['I','M','C'],focus:'permit',arrow:'high'},
    {goals:['C','S','I'],focus:'public',arrow:'low'},
    {goals:['M','I','C'],focus:'wood',arrow:'high'},
    {goals:['C','M','I'],focus:'silver',arrow:'low'},
    {goals:['I','C','S'],focus:'ore',arrow:'high'},
    {goals:['S','C','I'],focus:'public',arrow:'low'},
    {goals:['C','I','M'],focus:'permit',arrow:'high'},
    {goals:['M','C','I'],focus:'food',arrow:'low'},
    {goals:['C','M','I'],focus:'beer',arrow:'high'},
    {goals:['I','C','M'],focus:'public',arrow:'low'},
  ],
  // v2: more Mine-first cards (5 C, 5 M, 3 I, 2 S first).
  v2: [
    {goals:['C','I','M'],focus:'wood',arrow:'low'},
    {goals:['C','M','I'],focus:'food',arrow:'high'},
    {goals:['M','C','I'],focus:'beer',arrow:'low'},
    {goals:['M','C','I'],focus:'ore',arrow:'high'},
    {goals:['C','I','S'],focus:'silver',arrow:'low'},
    {goals:['I','M','C'],focus:'permit',arrow:'high'},
    {goals:['S','C','M'],focus:'public',arrow:'low'},
    {goals:['M','I','C'],focus:'wood',arrow:'high'},
    {goals:['C','M','I'],focus:'silver',arrow:'low'},
    {goals:['I','C','M'],focus:'ore',arrow:'high'},
    {goals:['S','M','I'],focus:'public',arrow:'low'},
    {goals:['C','M','I'],focus:'permit',arrow:'high'},
    {goals:['M','C','I'],focus:'food',arrow:'low'},
    {goals:['M','C','S'],focus:'beer',arrow:'high'},
    {goals:['I','C','M'],focus:'public',arrow:'low'},
  ],
};
// Fixed left-to-right order of the automa's six action cards. Use the leftmost card showing the action.
export const ROW_ORDERS = {
  v1:[5,1,3,2,4,0], // first draft
  v2:[0,5,1,2,4,3], // Mine/Joker, Rights/St.Barbara, Mine/Plot, Build/Income, Rights/Income, Build/Plot
};

export const DEFAULT = {
  deck:'v1', row:'v1',
  rightsValue:'production',   // 'production' | 'income' (production × current price)
  rightsLimit:'pipeline',     // take Rights only when every held right already has a plot
  publicRights:'focus',       // 'focus': public tiles only when the card's focus is public; 'never'; 'value'
  plotTie:'arrow',            // 'arrow' | 'dots'
  mineKeep:'sum',             // keep tile with most stars+ore+VP
  minePlace:'cheap',          // cheapest space, then arrow
  tax:'pay',                  // 'pay' if able | 'keep5'
  patrician:{minPoints:3,minCoinsAfter:15},
  joker:true,
  taxReserve:false,           // last card of the round: take Income first if coins < tax owed
  incomeCap:Infinity,         // Income goal is skipped when coins >= cap
  publicRich:Infinity,        // with publicRights 'rich': public rights allowed when coins >= publicRich
};

export function createMemory(state, seat, config=DEFAULT) {
  const deck=config.deckCards??DECKS[config.deck];
  const rng={rng:seedNumber(`mincmistr/${state.seed}/${seat}`)};
  return {seat,config,rng,draw:shuffle(rng,deck.map((_,i)=>i)),discard:[],card:null,stats:{cards:0,checks:0,jokers:0,skips:0,goals:{}}};
}

function drawPlan(mem) {
  if (!mem.draw.length) { mem.draw=shuffle(mem.rng,mem.discard); mem.discard=[]; }
  const index=mem.draw.shift();
  mem.discard.push(index);
  mem.card=(mem.config.deckCards??DECKS[mem.config.deck])[index];
  mem.stats.cards++;
  return mem.card;
}

const actionsOfKind=(state,kind)=>legalActions(state).filter(a=>a.kind===kind&&!a.as);
// Leftmost remaining card in the automa's row that shows the action, else null.
function cardFor(state, mem, kind) {
  const p=state.players[mem.seat];
  for (const card of ROW_ORDERS[mem.config.row]) {
    if (!(p.hand&(1<<card))) continue;
    if (CARDS[card].includes(kind)) return card;
  }
  return null;
}
function jokerCard(state, mem) {
  const p=state.players[mem.seat];
  return mem.config.joker && (p.hand&1) ? 0 : null; // card 0 is Mine/Joker
}
const arrowSort=(card)=>(a,b)=>card.arrow==='low'?a-b:b-a;

// ----- Construct: Build ▸ Plot ▸ Rights -----
function buildingValue(state, id, mem) {
  const tile=BUILDINGS[id];
  const pv=mem?.config.publicBuildValue; const v=Array.isArray(pv)?pv[state.round-1]:(pv??0);
  return tile.public ? v : tile.production;
}
function chooseBuild(state, mem, options) {
  // Build the held right with the highest production (public last), on the plot scoring the most dots; ties by arrow.
  const card=mem.card;
  const scored=options.map(a=>{
    const t=structuredClone(state.city); t[a.space]={id:a.id,owner:mem.seat};
    const dots=cityPointsAt({...state,city:t},a.space);
    const tile=BUILDINGS[a.id];
    const v=mem.config.buildValue==='income'&&!tile.public ? tile.production*price(state,tile.group) : buildingValue(state,a.id,mem);
    return {a,v,dots};
  });
  if (mem.config.buildTie==='arrow') scored.sort((x,y)=>y.v-x.v||arrowSort(card)(x.a.space,y.a.space));
  else scored.sort((x,y)=>y.v-x.v||y.dots-x.dots||arrowSort(card)(x.a.space,y.a.space));
  return scored[0].a;
}
const publicValue=(mem,tile)=>{const w=mem.config.publicWeights??{vp:1,pel:2,rep:1}; return tile.vp*w.vp+tile.pelicans*w.pel+tile.rep*w.rep;};
function rightValue(state, mem, offer) {
  const tile=BUILDINGS[offer.id];
  if (tile.public) return mem.config.publicRights==='focus' ? -1 : publicValue(mem,tile)/2;
  if (mem.config.rightsValue==='price') return price(state,tile.group)*10+tile.production;
  return mem.config.rightsValue==='income' ? tile.production*price(state,tile.group) : tile.production;
}
function chooseRightsV3(state, mem, options) {
  // Rich (coins >= publicRich): best public tile (VP + 2 pelicans + 2 rep), cheaper first.
  // Otherwise: the buildable guild tile adding the most Income (production x price), cheaper first.
  const p=state.players[mem.seat];
  const publics=options.filter(a=>BUILDINGS[a.id].public);
  if (p.coins>=mem.config.publicRich && publics.length)
    return publics.sort((a,b)=>publicValue(mem,BUILDINGS[b.id])-publicValue(mem,BUILDINGS[a.id])||a.cost-b.cost)[0];
  const guilds=options.filter(a=>{const t=BUILDINGS[a.id]; return !t.public && canBuildGuild(state,t.group) && p.houses[p.guilds.indexOf(t.group)]<4;});
  if (!guilds.length) return mem.config.publicFallback&&publics.length ? publics.sort((a,b)=>publicValue(mem,BUILDINGS[b.id])-publicValue(mem,BUILDINGS[a.id])||a.cost-b.cost)[0] : null;
  const inc=a=>BUILDINGS[a.id].production*price(state,BUILDINGS[a.id].group)+(BUILDINGS[a.id].group==='ore'?(mem.config.oreBonus??0):0)-(mem.config.rightsCostWeight??0)*a.cost;
  return guilds.sort((a,b)=>inc(b)-inc(a)||a.cost-b.cost)[0];
}
function chooseRights(state, mem, options) {
  if (mem.config.rightsRule==='v3') return chooseRightsV3(state,mem,options);
  const card=mem.card;
  const p=state.players[mem.seat];
  let pool=options;
  // Guild rights must be buildable now (demand) and use a guild row with a house left.
  pool=pool.filter(a=>{
    const tile=BUILDINGS[a.id];
    if (tile.public) {
      if (mem.config.publicRights==='never') return false;
      if (mem.config.publicRights==='focus') return card.focus==='public';
      if (mem.config.publicRights==='rich'||mem.config.publicRights==='prefer') return card.focus==='public' || p.coins>=mem.config.publicRich;
      return true;
    }
    return canBuildGuild(state,tile.group) && p.houses[p.guilds.indexOf(tile.group)]<4;
  });
  if (!pool.length) return null;
  const offers=marketOffer(state);
  pool=pool.map(a=>({a,v:rightValue(state,mem,offers.find(o=>o.id===a.id)),focus:mem.config.focusRights===false?false:(BUILDINGS[a.id].group===card.focus||Boolean(BUILDINGS[a.id].public&&card.focus==='public'))}));
  const richPublic=mem.config.publicRights==='prefer' && p.coins>=mem.config.publicRich;
  pool.sort((x,y)=>(richPublic?Number(BUILDINGS[y.a.id].public)-Number(BUILDINGS[x.a.id].public):0)||Number(y.focus)-Number(x.focus)||y.v-x.v||x.a.cost-y.a.cost);
  return pool[0].a;
}
function choosePlot(state, mem, options) {
  const card=mem.card;
  const p=state.players[mem.seat];
  const scored=options.map(a=>{
    let dots=0;
    if (mem.config.plotTie!=='arrow' && p.held.length) {
      for (const id of p.held) {
        const t=structuredClone(state.city); t[a.space]={id,owner:mem.seat};
        dots=Math.max(dots,cityPointsAt({...state,city:t},a.space));
      }
    }
    return {a,dots};
  });
  const nearPublic=space=>rulesFor(state).board.neighbours[space].some(i=>state.city[i]?.id&&state.city[i].owner===null)?1:0;
  const crowd=space=>rulesFor(state).board.neighbours[space].filter(i=>state.city[i]?.id).length;
  if (mem.config.plotTie==='crowd') scored.sort((x,y)=>crowd(y.a.space)-crowd(x.a.space)||x.a.cost-y.a.cost||arrowSort(card)(x.a.space,y.a.space));
  else if (mem.config.plotTie==='crowdTie') scored.sort((x,y)=>x.a.cost-y.a.cost||crowd(y.a.space)-crowd(x.a.space)||arrowSort(card)(x.a.space,y.a.space));
  else if (mem.config.plotTie==='dotsOnly') scored.sort((x,y)=>y.dots-x.dots||x.a.cost-y.a.cost||arrowSort(card)(x.a.space,y.a.space));
  else if (mem.config.plotTie==='dotsFirst') scored.sort((x,y)=>y.dots-x.dots||x.a.cost-y.a.cost||nearPublic(y.a.space)-nearPublic(x.a.space)||arrowSort(card)(x.a.space,y.a.space));
  else if (mem.config.plotTie==='dotsPublic') scored.sort((x,y)=>x.a.cost-y.a.cost||y.dots-x.dots||nearPublic(y.a.space)-nearPublic(x.a.space)||arrowSort(card)(x.a.space,y.a.space));
  else scored.sort((x,y)=>x.a.cost-y.a.cost||y.dots-x.dots||arrowSort(card)(x.a.space,y.a.space));
  return scored[0].a;
}
const isFinalRound=state=>state.round===rulesFor(state).rounds;
function finalConstruct(state, mem) {
  // Final round: every held right and plot scores 1 VP, so Build, else the cheapest Plot, else the cheapest Rights.
  const p=state.players[mem.seat];
  const plots=plotCount(state,mem.seat);
  mem.stats.checks++;
  if (p.held.length && plots) {
    const card=cardFor(state,mem,'build');
    const options=actionsOfKind(state,'build').filter(a=>a.card===card);
    if (card!==null && options.length) return chooseBuild(state,mem,options);
  }
  for (const kind of ['plot','rights']) {
    const card=cardFor(state,mem,kind);
    const options=actionsOfKind(state,kind).filter(a=>a.card===card);
    if (card!==null && options.length) return options.sort((a,b)=>a.cost-b.cost)[0];
  }
  return null;
}
function constructStep(state, mem) {
  const p=state.players[mem.seat];
  if (p.coins<(mem.config.constructMinCoins??0)) return null;
  if (mem.config.finalRound && isFinalRound(state)) return finalConstruct(state,mem);
  const plots=plotCount(state,mem.seat);
  mem.stats.checks++;
  if (p.held.length && plots) {
    const card=cardFor(state,mem,'build');
    const cap=mem.config.buildCap??Infinity, capFrac=mem.config.buildCapFrac??Infinity;
    const options=actionsOfKind(state,'build').filter(a=>a.card===card && a.cost<=cap && a.cost<=p.coins*capFrac);
    if (card!==null && options.length) return chooseBuild(state,mem,options);
  }
  mem.stats.checks++;
  if ((mem.config.plotFirst ? p.held.length>=plots : p.held.length>plots) && plots<3) {
    const card=cardFor(state,mem,'plot');
    const options=actionsOfKind(state,'plot').filter(a=>a.card===card);
    if (card!==null && options.length) return choosePlot(state,mem,options);
  }
  mem.stats.checks++;
  const limitOk = mem.config.rightsLimit==='pipeline' ? p.held.length<=plots && p.held.length<3
    : mem.config.rightsLimit==='two' ? p.held.length-plots<2 && p.held.length<3
    : mem.config.rightsLimit==='three' ? p.held.length<3 : mem.config.rightsLimit==='one' ? p.held.length<1 : p.held.length<2;
  if (limitOk) {
    const card=cardFor(state,mem,'rights');
    const options=actionsOfKind(state,'rights').filter(a=>a.card===card);
    if (card!==null && options.length) return chooseRights(state,mem,options);
  }
  return null;
}

// ----- Mine -----
function mineStart(state, mem) {
  mem.stats.checks++;
  if (state.players[mem.seat].coins<(mem.config.mineMinCoins??0)) return null;
  const card=cardFor(state,mem,'mine');
  if (card===null) return null;
  const options=actionsOfKind(state,'mine').filter(a=>a.card===card);
  if (!options.length) return null;
  // Use a pool miner if there is one; otherwise recruit 2 (or 1 if only 1 left in reserve).
  return options.find(a=>a.refill===0) ?? options.sort((a,b)=>b.refill-a.refill)[0];
}
function tileValue(id) {const m=MINES[id]; return m.stars+m.ore+m.vp;}
function choosePlacement(state, mem, options) {
  const card=mem.card;
  const width=rulesFor(state).board.mineWidth;
  const ids=[...new Set(options.filter(a=>a.kind==='place-mine'||a.kind==='technology').map(a=>a.id))];
  if (!ids.length) return options.find(a=>a.kind==='skip');
  const keepRule=mem.config.mineKeep;
  const lateRound=state.round>=rulesFor(state).rounds-1;
  const keepScore=id=>keepRule==='stars'?MINES[id].stars*2+MINES[id].ore+MINES[id].vp
    : keepRule==='late'?MINES[id].stars*2+(lateRound?0:MINES[id].ore*2)+MINES[id].vp
    : keepRule==='starsfirst'?MINES[id].stars*10+MINES[id].ore+MINES[id].vp : tileValue(id);
  const keep=ids.sort((a,b)=>keepScore(b)-keepScore(a)||MINES[b].stars-MINES[a].stars)[0];
  const spaces=options.filter(a=>a.id===keep);
  const rows=mineRows(state);
  const row=a=>Math.floor(a.space/width);
  const rule=mem.config.minePlace;
  const mineCount=r=>rows[r].count[mem.seat];
  // Rank gain: mine-row VP the automa would hold in that row after adding the tile's stars.
  const gain=a=>{
    const r=rows[row(a)], stars=[...r.stars]; stars[mem.seat]+=MINES[keep].stars;
    const total=r.total+MINES[keep].stars;
    const n=state.players.length;
    const awards=n===2?(total<=3?[2,0]:total<=6?[4,1]:[6,2]):(total<=5?[2,1,0]:total<=9?[3,2,1]:[5,3,2]);
    const vp=s=>s===0?0:(awards[stars.filter(o=>o>s).length]??0);
    return vp(stars[mem.seat])-r.vp[mem.seat];
  };
  spaces.sort((x,y)=>{
    if (rule==='spread') return mineCount(row(x))-mineCount(row(y))||x.cost-y.cost||arrowSort(card)(x.space,y.space);
    if (rule==='contest') return gain(y)-gain(x)||x.cost-y.cost||mineCount(row(x))-mineCount(row(y))||arrowSort(card)(x.space,y.space);
    if (rule==='cheapspread') return x.cost-y.cost||mineCount(row(x))-mineCount(row(y))||arrowSort(card)(x.space,y.space);
    return x.cost-y.cost||row(x)-row(y)||arrowSort(card)(x.space,y.space);
  });
  return spaces[0];
}

// ----- Income and council -----
function incomeStep(state, mem, forced=false) {
  mem.stats.checks++;
  const card=cardFor(state,mem,'income');
  if (card===null) return null;
  const options=actionsOfKind(state,'income').filter(a=>a.card===card);
  if (!options.length) return null;
  const pick=chooseIncome(state,mem,options);
  // When already rich, Income is only worth taking to seat a patrician.
  if (!forced && state.players[mem.seat].coins>=mem.config.incomeCap && !pick.color) return null;
  // Final round: coins do not score, so Income is only taken to seat a patrician (or when forced).
  if (!forced && mem.config.lastRoundNoIncome && state.round===rulesFor(state).rounds && !pick.color) return null;
  return pick;
}
function chooseIncome(state, mem, options) {
  const p=state.players[mem.seat];
  const plain=options.find(a=>!a.color);
  const base=patricianBase(state,mem.seat);
  const {minPoints,minCoinsAfter,relative=false}=mem.config.patrician;
  // Relative: score = own base minus the best opponent's base for that colour (the council is shared).
  const others=state.players.map((_,k)=>k).filter(k=>k!==mem.seat).map(k=>patricianBase(state,k));
  const edge=color=>relative?base[color]-Math.max(...others.map(b=>b[color])):base[color];
  const minOwn=mem.config.patrician.minOwn??0;
  const seats=options.filter(a=>a.color && edge(a.color)>=minPoints && base[a.color]>=minOwn && p.coins+a.gross-10>=minCoinsAfter);
  if (!seats.length) return plain;
  seats.sort((a,b)=>edge(b.color)-edge(a.color)||PATRICIANS.indexOf(a.color)-PATRICIANS.indexOf(b.color));
  return seats[0];
}

// ----- St. Barbara -----
function barbaraStep(state, mem) {
  mem.stats.checks++;
  if (mem.config.barbaraAvoid && mem.config.barbaraAvoid.includes(state.barbara)) return null;
  const card=cardFor(state,mem,'barbara');
  if (card===null) return null;
  return actionsOfKind(state,'barbara').find(a=>a.card===card) ?? null;
}

function goalAction(state, mem, goal) {
  switch(goal) {
    case 'C': return constructStep(state,mem);
    case 'M': return mineStart(state,mem);
    case 'I': return incomeStep(state,mem);
    case 'S': return barbaraStep(state,mem);
  }
  return null;
}
function jokerFor(state, mem, goal) {
  // The Joker can stand in for the card's first goal when no remaining card shows that action.
  const kind={C:null,M:'mine',I:'income',S:'barbara'}[goal];
  if (jokerCard(state,mem)===null) return null;
  const all=legalActions(state).filter(a=>a.card===0&&a.as);
  if (goal==='C') {
    const p=state.players[mem.seat], plots=plotCount(state,mem.seat);
    for (const as of ['build','plot','rights']) {
      if (as==='build' && !(p.held.length&&plots)) continue;
      if (as==='plot' && !(p.held.length>plots&&plots<3)) continue;
      if (as==='rights' && !(p.held.length<=plots&&p.held.length<3)) continue;
      const xs=all.filter(a=>a.as===as);
      if (!xs.length) continue;
      const choose={build:chooseBuild,plot:choosePlot,rights:chooseRights}[as];
      const pick=choose(state,mem,xs);
      if (pick) return pick;
    }
    return null;
  }
  const xs=all.filter(a=>a.as===kind);
  if (!xs.length) return null;
  if (kind==='income') return chooseIncome(state,mem,xs);
  if (kind==='mine') return xs.find(a=>a.refill===0) ?? xs.sort((a,b)=>b.refill-a.refill)[0];
  return xs[0];
}

function pendingChoice(state, mem) {
  const options=legalActions(state);
  const item=state.pending[0];
  const p=state.players[mem.seat];
  const skip=options.find(a=>a.kind==='skip');
  switch(item.kind) {
    case 'mine-place': case 'technology': return choosePlacement(state,mem,options);
    case 'right': {
      const xs=options.filter(a=>a.kind==='rights');
      if (!xs.length) return skip;
      // Free right: the best public tile (VP + 2 pelicans + 2 reputation); with no public offered, the best guild tile by income.
      const pubs=xs.filter(a=>BUILDINGS[a.id].public);
      if (pubs.length) return pubs.sort((a,b)=>publicValue(mem,BUILDINGS[b.id])-publicValue(mem,BUILDINGS[a.id]))[0];
      const inc=a=>BUILDINGS[a.id].production*price(state,BUILDINGS[a.id].group);
      return xs.sort((a,b)=>inc(b)-inc(a))[0];
    }
    case 'house': {
      const xs=options.filter(a=>a.kind==='house');
      if (!xs.length) return skip;
      // Remove the house from the row with the most houses already removed (completes red columns), ties top row.
      const removed=a=>p.houses[p.guilds.indexOf(a.id)], top=a=>p.guilds.indexOf(a.id);
      if (mem.config.houseRule==='fewest') return xs.sort((a,b)=>removed(a)-removed(b)||top(a)-top(b))[0];
      if (mem.config.houseRule==='most') return xs.sort((a,b)=>removed(b)-removed(a)||top(a)-top(b))[0];
      xs.sort((a,b)=>removed(b)-removed(a)||top(a)-top(b));
      return item.production ? xs.sort((a,b)=>removed(a)-removed(b))[0] : xs[0];
    }
    case 'patrician': {
      const xs=options.filter(a=>a.kind==='patrician');
      if (!xs.length) return skip;
      const base=patricianBase(state,mem.seat);
      const others=state.players.map((_,k)=>k).filter(k=>k!==mem.seat).map(k=>patricianBase(state,k));
      const edge=c=>mem.config.patrician.relative?base[c]-Math.max(...others.map(b=>b[c])):base[c];
      return xs.sort((a,b)=>edge(b.color)-edge(a.color))[0];
    }
    case 'score-building': {
      const xs=options.filter(a=>a.kind==='score-building');
      if (!xs.length) return skip;
      return xs.sort((a,b)=>cityPointsAt(state,b.space)-cityPointsAt(state,a.space))[0];
    }
    case 'plot': {
      const xs=options.filter(a=>a.kind==='plot');
      return xs.length ? choosePlot(state,mem,xs) : skip;
    }
    case 'build': {
      const xs=options.filter(a=>a.kind==='build');
      return xs.length ? chooseBuild(state,mem,xs) : skip;
    }
    case 'income': {
      const xs=options.filter(a=>a.kind==='income');
      return xs.length ? chooseIncome(state,mem,xs) : skip;
    }
    case 'mine': {
      const xs=options.filter(a=>a.kind==='mine');
      return xs.length ? xs[0] : skip;
    }
  }
  return skip ?? options[0];
}

function taxChoice(state, mem) {
  const options=legalActions(state);
  const pay=options.find(a=>a.kind==='tax');
  const lose=options.find(a=>a.kind==='penalty');
  if (!pay) return lose;
  const p=state.players[mem.seat];
  if (mem.config.tax==='keep5' && p.coins-pay.cost<5) return lose;
  return pay;
}

function isLastCard(state, mem) {
  // The automa's final action card of the round (its third turn, one card).
  const n=state.players.length;
  return state.turn>=2*n;
}
export function automaAction(state, mem) {
  if (state.phase==='tax') return taxChoice(state,mem);
  if (state.pending.length) return pendingChoice(state,mem);
  const card=drawPlan(mem);
  if (mem.config.taxReserve && isLastCard(state,mem) && state.players[mem.seat].coins<taxCost(state,mem.seat)) {
    const a=incomeStep(state,mem,true);
    if (a) { mem.stats.goals.reserve=(mem.stats.goals.reserve??0)+1; return a; }
  }
  const brokeAt=Array.isArray(mem.config.brokeAt)?mem.config.brokeAt[state.round-1]:(mem.config.brokeAt??-1);
  if (state.players[mem.seat].coins<brokeAt && !(mem.config.finalRound==='nobroke' && isFinalRound(state))) {
    const a=incomeStep(state,mem,true);
    if (a) { mem.stats.goals.broke=(mem.stats.goals.broke??0)+1; return a; }
  }
  if (state.round>=(mem.config.councilFrom??Infinity)) {
    const a=incomeStep(state,mem,true);
    if (a?.color) { mem.stats.goals.council=(mem.stats.goals.council??0)+1; return a; }
  }
  if (state.players[mem.seat].coins>=(mem.config.richMineAt??Infinity)) {
    const a=mineStart(state,mem);
    if (a) { mem.stats.goals.rich=(mem.stats.goals.rich??0)+1; return a; }
  }
  const barbaraAt=Array.isArray(mem.config.barbaraAt)?mem.config.barbaraAt[state.round-1]:(mem.config.barbaraAt??Infinity);
  const goodTile=(mem.config.barbaraTiles??[]).includes(Math.min(state.barbara,12));
  if (state.players[mem.seat].pelicans>=(goodTile?1:barbaraAt)) {
    const a=barbaraStep(state,mem);
    if (a) { mem.stats.goals.Seager=(mem.stats.goals.Seager??0)+1; return a; }
  }
  const rev=mem.config.reverseRounds?.includes(state.round);
  for (const goal of (rev?[...card.goals].reverse():card.goals)) {
    const a=goalAction(state,mem,goal);
    if (a) { mem.stats.goals[goal]=(mem.stats.goals[goal]??0)+1; return a; }
  }
  // First goal by Joker if possible.
  const j=jokerFor(state,mem,card.goals[0]);
  if (j) { mem.stats.jokers++; return j; }
  // Fallbacks: Income, then Mine, then play the leftmost card for no effect.
  for (const goal of ['I','M']) {
    const a=goal==='I'?incomeStep(state,mem,true):goalAction(state,mem,goal);
    if (a) { mem.stats.goals[`fallback-${goal}`]=(mem.stats.goals[`fallback-${goal}`]??0)+1; return a; }
  }
  mem.stats.skips++;
  const p=state.players[mem.seat];
  const card0=ROW_ORDERS[mem.config.row].find(c=>p.hand&(1<<c));
  return legalActions(state).find(a=>a.kind==='skip'&&a.card===card0);
}
