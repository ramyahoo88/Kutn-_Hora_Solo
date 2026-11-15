// The Mincmistr — a card-driven solo opponent for Kutná Hora.
// This file is the rules as code. Every numbered comment matches a numbered rule in the printed rulebook.
// It reads the game state only through what a person can see on the table.
import {BUILDINGS,CARDS,MINES,PATRICIANS} from '../src/data.mjs';
import {
  canBuildGuild,cityPointsAt,legalActions,mineRows,patricianBase,plotCount,price,rulesFor,seedNumber,
} from '../src/engine.mjs';
import {shuffle} from '../src/random.mjs';

// Plan deck: 15 cards. Goals in priority order. C = Construct, M = Mine, S = St. Barbara.
// Arrow: 'low' = earliest space in reading order wins ties, 'high' = latest.
export const PLAN_DECK = [
  ['CM','low'], ['CM','high'], ['CM','low'], ['MC','high'], ['CS','low'],
  ['MC','high'], ['CS','low'], ['MC','high'], ['CM','low'], ['CS','high'],
  ['SC','low'], ['CM','high'], ['MC','low'], ['CM','high'], ['CM','low'],
].map(([goals,arrow],i)=>({number:i+1,goals:goals.split(''),arrow}));

// Rule 2: the Mincmistr's action cards, left to right. Card numbers as in the engine:
// 0 Mine/Joker, 1 Mine/Plot, 2 Build/Income, 3 Build/Plot, 4 Rights/Income, 5 Rights/St. Barbara.
export const ROW = [0,5,1,2,4,3];

// Difficulty levels (rule 9).
export const LEVELS = {
  apprentice:  {townPoints:false, rowPoints:false, extraCard:[]},
  journeyman:  {townPoints:true,  rowPoints:true,  extraCard:[]},
  master:      {townPoints:true,  rowPoints:true,  extraCard:[4,5,6]},
  grandmaster: {townPoints:true,  rowPoints:true,  extraCard:[1,2,3,4,5,6]},
};

const CASH = 20;      // rule 4.1
const PELICANS = 2;   // rule 4.2
const GOOD_TILES = [6,7,8,9,11]; // rule 4.2: St. Barbara tiles worth a single pelican

export function createMincmistr(state, seat, level='journeyman') {
  const rng={rng:seedNumber(`mincmistr/${state.seed}/${seat}`)};
  return {seat,level,settings:LEVELS[level],rng,draw:shuffle(rng,PLAN_DECK.map((_,i)=>i)),discard:[],card:null,
    stats:{cards:0,checks:0,rules:{}}};
}

// ---------- helpers ----------
const me = (state,m) => state.players[m.seat];
const rivals = (state,m) => state.players.map((_,k)=>k).filter(k=>k!==m.seat);
const ofKind = (state,kind) => legalActions(state).filter(a=>a.kind===kind && !a.as);
const tally = (m,key) => { m.stats.rules[key]=(m.stats.rules[key]??0)+1; };
// Rule 7 (arrow): ties between spaces go to the earliest (low) or latest (high) space in reading order.
const byArrow = m => (a,b) => m.card.arrow==='low' ? a-b : b-a;
// Rule 2: the leftmost card still in the row that shows the action.
function rowCard(state, m, kind) {
  const hand=me(state,m).hand;
  return ROW.find(card=>(hand&(1<<card)) && CARDS[card].includes(kind)) ?? null;
}
function withRowCard(state, m, kind) {
  const card=rowCard(state,m,kind);
  if (card===null) return [];
  return ofKind(state,kind).filter(a=>a.card===card);
}
// Rule 6.1: a tile's income value is its production times the current price of its commodity.
const incomeValue = (state,id) => BUILDINGS[id].production*price(state,BUILDINGS[id].group);
// Rule 6.5: a public tile's value is VP + 2 per pelican + 2 per reputation.
const publicValue = id => { const t=BUILDINGS[id]; return t.vp+2*t.pelicans+2*t.rep; };
// Rule 6.6: a patrician colour's edge is the Mincmistr's council score for it minus the best rival's.
function edge(state, m, color) {
  const own=patricianBase(state,m.seat)[color];
  return own-Math.max(...rivals(state,m).map(k=>patricianBase(state,k)[color]));
}
function townPointsIf(state, space, id) {
  const city=structuredClone(state.city); city[space]={id,owner:0};
  return cityPointsAt({...state,city},space);
}

// ---------- rule 6: choices ----------
function chooseRights(state, m, options) {
  // 6.1 Guild tiles only: in its own guilds, buildable now, with a house left in that row. Most income value, then cheapest, then market order.
  const p=me(state,m);
  const xs=options.filter(a=>{const t=BUILDINGS[a.id]; return !t.public && canBuildGuild(state,t.group) && p.houses[p.guilds.indexOf(t.group)]<4;});
  return xs.sort((a,b)=>incomeValue(state,b.id)-incomeValue(state,a.id)||a.cost-b.cost)[0] ?? null;
}
function choosePlot(state, m, options) {
  // 6.2 The plot where one of its held rights would score the most town points, then cheapest, then arrow.
  // Apprentice: cheapest, then arrow.
  const held=me(state,m).held;
  const pts=a=>m.settings.townPoints ? Math.max(0,...held.map(id=>townPointsIf(state,a.space,id))) : 0;
  return options.map(a=>({a,v:pts(a)})).sort((x,y)=>y.v-x.v||x.a.cost-y.a.cost||byArrow(m)(x.a.space,y.a.space))[0].a;
}
function chooseBuild(state, m, options) {
  // 6.3 The held right with the most production (public buildings count 0), on the plot where it scores the most town points, then arrow.
  // Apprentice: ignores town points.
  const prod=a=>BUILDINGS[a.id].public?0:BUILDINGS[a.id].production;
  const pts=a=>m.settings.townPoints ? townPointsIf(state,a.space,a.id) : 0;
  return options.map(a=>({a,p:prod(a),v:pts(a)})).sort((x,y)=>y.p-x.p||y.v-x.v||byArrow(m)(x.a.space,y.a.space))[0].a;
}
function chooseIncome(state, m, options) {
  // 6.6 Seat the patrician with the biggest edge if that edge is at least 1 (ties: green, silver, yellow, red). Otherwise plain Income.
  const seats=options.filter(a=>a.color && edge(state,m,a.color)>=1);
  if (!seats.length) return options.find(a=>!a.color) ?? null;
  return seats.sort((a,b)=>edge(state,m,b.color)-edge(state,m,a.color)||PATRICIANS.indexOf(a.color)-PATRICIANS.indexOf(b.color))[0];
}
function chooseMineStart(options) {
  // 5.2 Use a miner from its pool; with none, recruit as many as it can (up to 2).
  return options.find(a=>a.refill===0) ?? options.sort((a,b)=>b.refill-a.refill)[0] ?? null;
}
// Rule 6.4: mine-row award for a seat, as in the normal scoring (2 players: total stars 0-3: 2/0, 4-6: 4/1, 7+: 6/2).
function rowAward(stars, total, seat, players) {
  const awards=players===2?(total<=3?[2,0]:total<=6?[4,1]:[6,2]):(total<=5?[2,1,0]:total<=9?[3,2,1]:[5,3,2]);
  return stars[seat]===0 ? 0 : awards[stars.filter(o=>o>stars[seat]).length] ?? 0;
}
function choosePlacement(state, m, options) {
  // 6.4 Keep the drawn tile with the most stars + ore + VP (ties: more stars, then first drawn).
  // Place it where it gains the most mine-row points now; ties: cheapest space, then the row with fewest of its mines, then arrow.
  // If it cannot pay for any space, discard.
  const ids=[...new Set(options.filter(a=>a.kind==='place-mine'||a.kind==='technology').map(a=>a.id))];
  if (!ids.length) return options.find(a=>a.kind==='skip');
  const sum=id=>MINES[id].stars+MINES[id].ore+MINES[id].vp;
  const keep=ids.sort((a,b)=>sum(b)-sum(a)||MINES[b].stars-MINES[a].stars)[0];
  const width=rulesFor(state).board.mineWidth, rows=mineRows(state), n=state.players.length;
  const row=a=>rows[Math.floor(a.space/width)];
  const mines=a=>row(a).count[m.seat];
  const gain=a=>{
    const r=row(a), stars=[...r.stars]; stars[m.seat]+=MINES[keep].stars;
    return rowAward(stars,r.total+MINES[keep].stars,m.seat,n)-r.vp[m.seat];
  };
  // Apprentice: no row-point calculation; the row with the fewest of its mines, then the cheapest space, then arrow.
  if (!m.settings.rowPoints) return options.filter(a=>a.id===keep).sort((x,y)=>mines(x)-mines(y)||x.cost-y.cost||byArrow(m)(x.space,y.space))[0];
  return options.filter(a=>a.id===keep).sort((x,y)=>gain(y)-gain(x)||x.cost-y.cost||mines(x)-mines(y)||byArrow(m)(x.space,y.space))[0];
}

// ---------- rule 5: goals ----------
function construct(state, m) {
  // 5.1 Build ▸ Plot ▸ Rights.
  const p=me(state,m), plots=plotCount(state,m.seat);
  m.stats.checks++;
  if (p.held.length && plots) {
    const xs=withRowCard(state,m,'build');
    if (xs.length) return chooseBuild(state,m,xs);
  }
  if (p.held.length>plots && plots<3) {
    const xs=withRowCard(state,m,'plot');
    if (xs.length) return choosePlot(state,m,xs);
  }
  if (p.held.length<2) {
    const xs=withRowCard(state,m,'rights');
    if (xs.length) return chooseRights(state,m,xs);
  }
  return null;
}
function mine(state, m) {
  m.stats.checks++;
  return chooseMineStart(withRowCard(state,m,'mine'));
}
function income(state, m) {
  m.stats.checks++;
  const xs=withRowCard(state,m,'income');
  return xs.length ? chooseIncome(state,m,xs) : null;
}
function barbara(state, m) {
  m.stats.checks++;
  return withRowCard(state,m,'barbara')[0] ?? null;
}
function goal(state, m, g) {
  switch (g) {
    case 'C': return construct(state,m);
    case 'M': return mine(state,m);
    case 'S': return barbara(state,m);
  }
}

// ---------- rule 4: a card play ----------
function flipPlan(m) {
  if (!m.draw.length) { m.draw=shuffle(m.rng,m.discard); m.discard=[]; }
  const index=m.draw.shift();
  m.discard.push(index);
  m.card=PLAN_DECK[index];
  m.stats.cards++;
}
function cardPlay(state, m) {
  flipPlan(m);                                                     // 4.0 flip a plan card
  const p=me(state,m);
  if (p.coins<CASH) { const a=income(state,m); if (a) { tally(m,'cash'); return a; } }          // 4.1
  const goodTile=GOOD_TILES.includes(Math.min(state.barbara,12));
  if (p.pelicans>=PELICANS || (p.pelicans>=1 && goodTile)) { const a=barbara(state,m); if (a) { tally(m,'pelicans'); return a; } }  // 4.2
  for (const g of m.card.goals) { const a=goal(state,m,g); if (a) { tally(m,`goal:${g}`); return a; } } // 4.3
  for (const [key,fn] of [['fallback:I',()=>income(state,m)],['fallback:M',()=>mine(state,m)]]) { // 4.4
    const a=fn(); if (a) { tally(m,key); return a; }
  }
  tally(m,'discard');
  const card=ROW.find(c=>p.hand&(1<<c));
  return legalActions(state).find(a=>a.kind==='skip'&&a.card===card);
}

// ---------- rule 6.5, 6.7: bonus steps from tiles and St. Barbara ----------
function bonus(state, m) {
  const options=legalActions(state), item=state.pending[0], p=me(state,m);
  const skip=options.find(a=>a.kind==='skip');
  const pick=kind=>options.filter(a=>a.kind===kind);
  switch (item.kind) {
    case 'mine-place': case 'technology': return choosePlacement(state,m,options);
    case 'right': {
      const xs=pick('rights'); if (!xs.length) return skip;
      const pubs=xs.filter(a=>BUILDINGS[a.id].public);
      if (pubs.length) return pubs.sort((a,b)=>publicValue(b.id)-publicValue(a.id))[0];
      return xs.sort((a,b)=>incomeValue(state,b.id)-incomeValue(state,a.id))[0];
    }
    case 'house': {
      const xs=pick('house'); if (!xs.length) return skip;
      const removed=a=>p.houses[p.guilds.indexOf(a.id)], row=a=>p.guilds.indexOf(a.id);
      return xs.sort((a,b)=>removed(b)-removed(a)||row(a)-row(b))[0];
    }
    case 'patrician': {
      const xs=pick('patrician'); if (!xs.length) return skip;
      return xs.sort((a,b)=>edge(state,m,b.color)-edge(state,m,a.color))[0];
    }
    case 'score-building': {
      const xs=pick('score-building'); if (!xs.length) return skip;
      return xs.sort((a,b)=>cityPointsAt(state,b.space)-cityPointsAt(state,a.space)||byArrow(m)(a.space,b.space))[0];
    }
    case 'plot': { const xs=pick('plot'); return xs.length?choosePlot(state,m,xs):skip; }
    case 'build': { const xs=pick('build'); return xs.length?chooseBuild(state,m,xs):skip; }
    case 'income': { const xs=pick('income'); return xs.length?chooseIncome(state,m,xs):skip; }
    case 'mine': { const xs=pick('mine'); return xs.length?xs[0]:skip; }
  }
  return skip ?? options[0];
}

// ---------- entry points ----------
export function mincmistrAction(state, m) {
  if (state.phase==='tax') {                         // rule 8: pay tax if it can
    const options=legalActions(state);
    return options.find(a=>a.kind==='tax') ?? options.find(a=>a.kind==='penalty');
  }
  if (state.pending.length) return bonus(state,m);
  return cardPlay(state,m);
}
// Rule 9: at Master and Grandmaster, in the listed rounds, the Mincmistr's last turn plays both remaining cards.
export function mincmistrCardsThisTurn(state, m) {
  if (state.phase!=='action' || state.pending.length || state.actor!==m.seat) return null;
  // Round numbers are counted as in a 6-round game, so with 5 rounds (4 players) Master covers rounds 3-5.
  const asSixRounds=state.round+6-rulesFor(state).rounds;
  if (state.turn<2*state.players.length || !m.settings.extraCard.includes(asSixRounds)) return null;
  let hand=me(state,m).hand, n=0; while (hand) { n+=hand&1; hand>>=1; }
  return state.left===1 && n===2 ? 2 : null;
}
