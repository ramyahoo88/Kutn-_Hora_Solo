// The Mincmistr — a card-driven solo opponent for Kutná Hora.
// This file is the rules as code. Every numbered comment matches a numbered rule in the printed rulebook.
// It reads the game state only through what a person can see on the table.
import {BUILDINGS,CARDS,CITY_WIDTH,GUILDS,LABEL,MINCMISTR_LEVELS,MINCMISTR_PLANS,MINES,PATRICIANS,PLAN_EXPLANATION_LIMIT} from './data.mjs';
import {
  canBuildGuild,cityPointsAt,coordinate,createPlanDeck,currentBarbara,drawPlan,legalActions,marketOffer,
  mineRows,patricianBase,plotCount,price,rulesFor,transition,unavailableActionReason,
} from './engine.mjs';

// Plan deck: 15 cards. Goals in priority order. C = Construct, M = Mine, S = St. Barbara.
// Arrow: 'low' = earliest space in reading order wins ties, 'high' = latest.
export const PLAN_DECK = MINCMISTR_PLANS;

// Rule 2: the Mincmistr's action cards, left to right. Card numbers as in the engine:
// 0 Mine/Joker, 1 Mine/Plot, 2 Build/Income, 3 Build/Plot, 4 Rights/Income, 5 Rights/St. Barbara.
export const ROW = [0,5,1,2,4,3];

// Difficulty levels (rule 9).
export const LEVELS = MINCMISTR_LEVELS;

// Keep the on-screen card text in step with the thresholds in rules 4.1 and 4.2.
export const PLAN_PRIORITIES = {cash:20, pelicans:2, prizeTiles:[6,7,8,9,11]};

export function createMincmistr(state, seat, level='journeyman') {
  return {seat,level,settings:LEVELS[level],...createPlanDeck(state.seed,seat),card:null,
    stats:{cards:0,checks:0,rules:{}}};
}

// ---------- helpers ----------
const me = (state,m) => state.players[m.seat];
const rivals = (state,m) => state.players.map((_,k)=>k).filter(k=>k!==m.seat);
const ofKind = (state,kind) => legalActions(state).filter(a=>a.kind===kind && !a.as);
const tally = (m,key) => { m.stats.rules[key]=(m.stats.rules[key]??0)+1; };
const explain = (m,rule,text) => m.explanation?.push({rule,text});
const cardName = card => CARDS[card].map(kind=>LABEL[kind]).join(' / ');
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
function unavailable(state,m,kind) {
  const card=rowCard(state,m,kind);
  if (card===null) return `No ${LABEL[kind]} card remains in the row.`;
  const why=unavailableActionReason(state,card,kind);
  return why?`${why}.`:`No legal ${LABEL[kind]} choice.`;
}
// Rule 6.1: a tile's income value is its production times the current price of its commodity.
const incomeValue = (state,id) => BUILDINGS[id].production*price(state,BUILDINGS[id].group);
// Rule 6.5: value the tile's printed VP, pelicans granted and reputation granted.
const publicValue = id => { const t=BUILDINGS[id]; return t.vp+2*t.pelicans+2*t.rep; };
// Rule 6.6: a patrician colour's edge is the Mincmistr's council score for it minus the best rival's.
function edge(state, m, color) {
  const own=patricianBase(state,m.seat)[color];
  return own-Math.max(...rivals(state,m).map(k=>patricianBase(state,k)[color]));
}
function townPointsIf(state, space, id) {
  const city=[...state.city];
  city[space]={id,owner:0};
  return cityPointsAt({...state,city},space);
}

// Use the same comparisons to choose a target and explain which comparison decided it.
const high = (label,value) => ({label,value,direction:-1});
const low = (label,value) => ({label,value,direction:1});
function arrowOrder(m,width) {
  const earliest=m.card.arrow==='low';
  return {
    label:`Plan arrow (${earliest?'earliest':'latest'} space)`,
    value:a=>a.space, direction:earliest?1:-1, format:space=>coordinate(space,width),
  };
}
const town = a => `Town ${coordinate(a.space,CITY_WIDTH)}`;
const building = a => BUILDINGS[a.id].name;

function rankedChoice(m,rule,options,criteria,name,lastTie='the first tile in offer order') {
  const ranked=options.map(option=>({option,values:criteria.map(key=>key.value(option))}));
  ranked.sort((a,b)=>{
    for (const [i,key] of criteria.entries()) {
      const difference=(a.values[i]-b.values[i])*key.direction;
      if (difference) return difference;
    }
    return 0;
  });
  const [first,second]=ranked;
  if (!first) return null;
  if (m.explanation) {
    let why='Only eligible choice.';
    if (second) {
      const difference=first.values.findIndex((value,i)=>value!==second.values[i]);
      if (difference<0) why=`Tie broken by ${lastTie}.`;
      else {
        const key=criteria[difference];
        const format=key.format??String;
        const comparison=`${format(first.values[difference])} vs ${format(second.values[difference])}`;
        why=difference===0?`Best ${key.label} (${comparison}).`:`Tie broken by ${key.label} (${comparison}).`;
      }
    }
    const scores=criteria.flatMap((key,i)=>key.format?[]:[`${key.label} ${first.values[i]}`]).join(' · ');
    explain(m,rule,`${name(first.option)}. ${why}${scores?` ${scores}.`:''}`);
  }
  return first.option;
}

// ---------- rule 6: choices ----------
function eligibleGuildRight(state,m,id) {
  const p=me(state,m), tile=BUILDINGS[id];
  const row=p.guilds.indexOf(tile.group);
  return !tile.public && row>=0 && p.houses[row]<4 && canBuildGuild(state,tile.group);
}
function chooseRights(state, m, options) {
  // 6.1 Guild tiles only: in its own guilds, buildable now, with a house left in that row. Most income value, then cheapest, then market order.
  const eligible=options.filter(a=>eligibleGuildRight(state,m,a.id));
  return rankedChoice(m,'6.1',eligible,[high('income value (g)',a=>incomeValue(state,a.id)),low('cost (g)',a=>a.cost)],
    a=>`${building(a)} is an eligible guild right`,'market reading order (higher row, then leftmost)');
}
function choosePlot(state, m, options) {
  // 6.2 The plot where one of its held rights would score the most town points, then cheapest, then arrow.
  // Apprentice: cheapest, then arrow.
  const held=me(state,m).held;
  const criteria=[low('cost (g)',a=>a.cost),arrowOrder(m,CITY_WIDTH)];
  if (m.settings.townPoints) criteria.unshift(high('town points',a=>Math.max(0,...held.map(id=>townPointsIf(state,a.space,id)))));
  return rankedChoice(m,'6.2',options,criteria,town);
}
function chooseBuild(state, m, options) {
  // 6.3 The held right with the most production (public buildings count 0), on the plot where it scores the most town points, then arrow.
  // Apprentice: ignores town points.
  const prod=a=>BUILDINGS[a.id].public?0:BUILDINGS[a.id].production;
  const criteria=[high('production',prod)];
  if (m.settings.townPoints) criteria.push(high('town points',a=>townPointsIf(state,a.space,a.id)));
  criteria.push(arrowOrder(m,CITY_WIDTH));
  return rankedChoice(m,'6.3',options,criteria,a=>`${building(a)} at ${town(a)} for ${a.cost} g`,'the earliest acquired right');
}
function chooseIncome(state, m, options) {
  // 6.6 Seat the patrician with the biggest edge if that edge is at least 1 (ties: green, silver, yellow, red). Otherwise plain Income.
  const plain=options.find(a=>!a.color);
  const seats=options.filter(a=>a.color).map(action=>({action,edge:edge(state,m,action.color)}));
  const best=rankedChoice(m,'6.6',seats.filter(candidate=>candidate.edge>=1),[high('edge (VP)',candidate=>candidate.edge)],
    ({action})=>`Seat a ${action.color} patrician for 10 g`,'colour order (green, silver, yellow, red)');
  if (best) return best.action;
  if (m.explanation && plain) {
    if (seats.length) explain(m,'6.6','Collect Income. No available patrician has an edge of at least 1 VP.');
    else if (PATRICIANS.some(color=>state.patrons[color]>0)) explain(m,'6.6','Collect Income. Cash plus income does not cover the 10 g seating cost.');
    else explain(m,'6.6','Collect Income. No patrician is available to seat.');
  }
  return plain??null;
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
  if (!ids.length) {
    explain(m,'6.4','Discard the tile. No legal placement is available with the current miners and placement cost.');
    return options.find(a=>a.kind==='skip');
  }
  const sum=id=>MINES[id].stars+MINES[id].ore+MINES[id].vp;
  const keep=rankedChoice(m,'6.4',ids,[high('stars + ore + VP',sum),high('stars',id=>MINES[id].stars)],
    id=>`Keep ${MINES[id].name}`,'the first tile drawn');
  const width=rulesFor(state).board.mineWidth, rows=mineRows(state), n=state.players.length;
  const row=a=>rows[Math.floor(a.space/width)];
  const mines=a=>row(a).count[m.seat];
  const gain=a=>{
    const r=row(a), stars=[...r.stars]; stars[m.seat]+=MINES[keep].stars;
    return rowAward(stars,r.total+MINES[keep].stars,m.seat,n)-r.vp[m.seat];
  };
  // Apprentice: no row-point calculation; the row with the fewest of its mines, then the cheapest space, then arrow.
  const spread=low('own mines in the row',mines);
  const cost=low('cost (g)',a=>a.cost);
  const criteria=m.settings.rowPoints?[high('mine row gain (VP)',gain),cost,spread]:[spread,cost];
  criteria.push(arrowOrder(m,width));
  return rankedChoice(m,'6.4',options.filter(a=>a.id===keep),criteria,a=>`Mine ${coordinate(a.space,width)}`);
}

// ---------- rule 5: goals ----------
function construct(state, m) {
  // 5.1 Build ▸ Plot ▸ Rights.
  const p=me(state,m), plots=plotCount(state,m.seat);
  m.stats.checks++;
  if (p.held.length && plots) {
    const xs=withRowCard(state,m,'build');
    if (xs.length) return chooseBuild(state,m,xs);
    if (m.explanation) explain(m,'5.1',`Build unavailable. ${unavailable(state,m,'build')}`);
  } else explain(m,'5.1',`Build needs ${!p.held.length&&!plots?'a right and a plot':plots?'a right':'a plot'}.`);
  if (p.held.length>plots && plots<3) {
    const xs=withRowCard(state,m,'plot');
    if (xs.length) return choosePlot(state,m,xs);
    if (m.explanation) explain(m,'5.1',`Plot unavailable. ${unavailable(state,m,'plot')}`);
  } else explain(m,'5.1','Plot needs more rights than plots and fewer than three plots.');
  if (p.held.length<2) {
    const xs=withRowCard(state,m,'rights');
    const action=chooseRights(state,m,xs);
    if (action) return action;
    if (m.explanation) {
      const offers=marketOffer(state).filter(offer=>eligibleGuildRight(state,m,offer.id));
      if (rowCard(state,m,'rights')===null) explain(m,'6.1','No Rights card remains in the row.');
      else if (offers.length) explain(m,'6.1',`Rights needs ${Math.min(...offers.map(offer=>offer.cost))} g for an eligible guild tile.`);
      else explain(m,'6.1','None of its guild tiles on offer has an available house and enough demand to build.');
    }
  } else {
    explain(m,'5.1','Construct buys Rights only when it holds fewer than two.');
  }
  return null;
}
function mine(state, m) {
  m.stats.checks++;
  const action=chooseMineStart(withRowCard(state,m,'mine'));
  if (action) explain(m,'5.2',action.refill?`Recruit ${action.refill} ${action.refill===1?'miner':'miners'} for ${action.cost} g.`:'Use a miner already in the pool.');
  return action;
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
  m.card=PLAN_DECK[drawPlan(m)];
  m.stats.cards++;
}
function cardPlay(state, m) {
  flipPlan(m);                                                     // 4.0 flip a plan card
  const p=me(state,m);
  const {cash,pelicans,prizeTiles}=PLAN_PRIORITIES;
  if (p.coins<cash) {
    const a=income(state,m);
    if (a) { tally(m,'cash'); return a; }
    if (m.explanation) explain(m,'4.1',`Has ${p.coins} g. ${unavailable(state,m,'income')}`);
  } else explain(m,'4.1',`Has ${p.coins} g. The cash check needs fewer than ${cash} g.`);
  const tile=currentBarbara(state);
  const goodTile=prizeTiles.includes(tile);
  if (p.pelicans>=pelicans || (p.pelicans>=1 && goodTile)) {
    const a=barbara(state,m);
    if (a) {
      tally(m,'pelicans');
      explain(m,'4.2',`Has ${p.pelicans} ${p.pelicans===1?`pelican on prize tile ${tile}`:'pelicans'}.`);
      return a;
    }
    if (m.explanation) explain(m,'4.2',unavailable(state,m,'barbara'));
  } else explain(m,'4.2',p.pelicans===0?'No pelicans to contribute.':`Only one pelican and St. Barbara tile ${tile} is not a prize tile.`);
  for (const [i,g] of m.card.goals.entries()) {
    const a=goal(state,m,g);
    if (a) { tally(m,`goal:${g}`); return a; }
    if (m.explanation) {
      const why=g==='C'?'No Construct action is possible.':unavailable(state,m,g==='M'?'mine':'barbara');
      explain(m,'4.3',`Goal ${i+1} ${PLAN_GOALS[g]} could not be played. ${why}`);
    }
  }
  for (const [key,fn] of [['fallback:I',()=>income(state,m)],['fallback:M',()=>mine(state,m)]]) { // 4.4
    const a=fn(); if (a) { tally(m,key); return a; }
    if (m.explanation) explain(m,'4.4',unavailable(state,m,key==='fallback:I'?'income':'mine'));
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
      const xs=pick('rights');
      if (!xs.length) {
        const why=p.held.length===3?'All three rights slots are full.':item.publicOnly?'No public right is on offer.':'No eligible right is on offer.';
        explain(m,'6.5',`Skip the free right. ${why}`);
        return skip;
      }
      const pubs=xs.filter(a=>BUILDINGS[a.id].public);
      if (pubs.length) return rankedChoice(m,'6.5',pubs,[high('Printed VP + 2 × pelicans granted + 2 × reputation granted',a=>publicValue(a.id))],
        a=>`Free public right to ${building(a)}`);
      return rankedChoice(m,'6.5',xs,[high('income value (g)',a=>incomeValue(state,a.id))],
        a=>`No public right on offer. Take the free guild right to ${building(a)}`);
    }
    case 'house': {
      const removed=a=>p.houses[p.guilds.indexOf(a.id)], row=a=>p.guilds.indexOf(a.id);
      return rankedChoice(m,'6.5',pick('house'),[high('houses already removed',removed),low('row',a=>row(a)+1)],
        a=>`Remove a ${GUILDS[a.id]} house`)??skip;
    }
    case 'patrician': {
      return rankedChoice(m,'6.5',pick('patrician'),[high('edge (VP)',a=>edge(state,m,a.color))],
        a=>`Seat a ${a.color} patrician from the bank`,'colour order (green, silver, yellow, red)')??skip;
    }
    case 'score-building': {
      return rankedChoice(m,'6.5',pick('score-building'),[high('town points',a=>cityPointsAt(state,a.space)),arrowOrder(m,CITY_WIDTH)],
        a=>`Score ${BUILDINGS[state.city[a.space].id].name} at ${town(a)}`)??skip;
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

export const PLAN_GOALS={C:'Construct',M:'Mine',S:'St. Barbara'};
export function describePlan(card) {
  const order=card.goals.map(goal=>PLAN_GOALS[goal]).join(' → ');
  return `Plan ${card.number} · ${order} · ${card.arrow==='low'?'earliest':'latest'} space on ties`;
}

function describePlanRule(m,action) {
  // Digital play creates fresh statistics for each decision. cardPlay tallies
  // exactly the check that found a legal action, including fallback.
  const [check]=Object.keys(m.stats.rules);
  if (check==='cash') return 'Rule 4.1 · Short of cash → Income';
  if (check==='pelicans') return 'Rule 4.2 · Pelicans → St. Barbara';
  const label=action.kind==='build'?'Build':LABEL[action.kind];
  if (check.startsWith('goal:')) {
    const goal=check.slice(5);
    const name=PLAN_GOALS[goal];
    const priority=m.card.goals.indexOf(goal)+1;
    return `Rule 4.3 · Goal ${priority} ${name}${name===label?'':` → ${label}`}`;
  }
  return `Rule 4.4 · Fallback → ${label}`;
}

// Play one decision from a saved digital game. Bonus decisions use the last flipped card.
export function playMincmistr(state, beforeRoundEnd) {
  const {mincmistr,actor:seat}=state;
  if (!mincmistr || seat===0 || state.phase==='end') throw Error('Choose a Mincmistr turn.');
  const slot=mincmistr.shared?0:seat-1;
  const deck=mincmistr.decks[slot];
  const m={
    seat,settings:LEVELS[mincmistr.level],
    rng:{...deck.rng},draw:[...deck.draw],discard:[...deck.discard],
    card:PLAN_DECK[mincmistr.lastPlans[seat-1]]??null,stats:{cards:0,checks:0,rules:{}},
    explanation:state.log?[]:null,
  };
  const action=mincmistrAction(state,m);
  if (!m.stats.cards) {
    if (!m.explanation?.length || !m.card) return transition(state,action,beforeRoundEnd);
    const title=`${describePlan(m.card)}.`;
    const index=state.log.findLastIndex(entry=>entry.actor===seat&&entry.round===state.round&&entry.text===title);
    if (index<0) return transition(state,action,beforeRoundEnd);
    const log=[...state.log];
    const explanation=[...(log[index].explanation??[]),...m.explanation].slice(0,PLAN_EXPLANATION_LIMIT);
    log[index]={...log[index],explanation};
    return transition({...state,log},action,beforeRoundEnd);
  }

  explain(m,action.kind==='skip'?'4.4':'2',action.kind==='skip'
    ? `Discard ${cardName(action.card)}, the leftmost remaining card.`
    : `Use ${cardName(action.card)}, the leftmost remaining card for ${LABEL[action.kind]}.`);

  // Save the new deck and the move together so Undo and reload reproduce the same draw.
  const decks=[...mincmistr.decks];
  decks[slot]={rng:m.rng,draw:m.draw,discard:m.discard};
  const lastPlans=[...mincmistr.lastPlans];
  lastPlans[seat-1]=m.card.number-1;
  const log=state.log?[...state.log,{
    round:state.round,actor:seat,text:`${describePlan(m.card)}.`,rule:describePlanRule(m,action),explanation:m.explanation,
  }]:null;
  return transition({...state,mincmistr:{...mincmistr,decks,lastPlans},log},action,beforeRoundEnd);
}
