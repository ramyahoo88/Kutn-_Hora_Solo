import {BUILDINGS,CARDS,CITY_EDGE,COMMODITY,GOODS,LABEL,MINE_GROUPS,MINES,PATRICIANS,REP_LOSS,REP_SCORE} from './data.mjs';
import {
  actionKey,applyKnownAction,canBuildGuild,coordinate,copyState,income,legalActions,marketOffer,mineRow,
  patricianBase,plotCount,price,scoreBreakdown,seedNumber,taxCost,TOWN_NEIGHBOURS,
} from './engine.mjs';
import {shuffle} from './random.mjs';

const POLICIES = {
  standard:{width:10,extend:1,opponent:0.88,city:1,mine:1,council:1,conversion:true},
  baseline:{width:10,extend:1,opponent:0.83,city:1,mine:1,council:1},
  quick:{width:4,extend:0,opponent:0.65,city:1,mine:1,council:1},
  builder:{width:5,extend:1,opponent:0.66,city:1.35,mine:0.65,council:1},
  miner:{width:5,extend:1,opponent:0.65,city:0.78,mine:1.5,council:0.9},
  council:{width:5,extend:1,opponent:0.73,city:1,mine:0.85,council:1.45},
  denial:{width:6,extend:1,opponent:1.23,city:1,mine:1.25,council:1.12},
};

export function publicPlanningState(state, sample=0) {
  const copy=copyState(state,false);
  const visible=[state.setup,state.round,state.turn,state.left,state.actor,state.pop,state.ore,state.technology,sample];
  copy.rng=seedNumber(visible.join('/'));
  // Every seed with the same visible position and tile backs has the same planning distribution.
  // Substitute unseen mine faces, building order, future events, and the unrevealed red order.
  const visibleMines=new Set([...state.mine.flatMap(cell=>cell?.id?[cell.id]:[]),
    ...state.pending.flatMap(item=>item.drawn??[])]);
  const options=MINE_GROUPS.map(group=>group.filter(tile=>!visibleMines.has(tile.id)).map(tile=>tile.id));
  if (state.mineMixed) {
    const sampleDeck=shuffle(copy,options.flat());
    copy.mineDeck=sampleDeck.slice(0,state.mineDeck.length);
    copy.mineDiscard=sampleDeck.slice(state.mineDeck.length);
  } else {
    copy.mineDeck=[];
    copy.mineDiscard=[];
    for (const [i,group] of options.entries()) {
      const backs=state.mineDeck.filter(id=>MINES[id].tier===i+1).length;
      const sampleDeck=shuffle(copy,group);
      copy.mineDeck.push(...sampleDeck.slice(0,backs));
      copy.mineDiscard.push(...sampleDeck.slice(backs));
    }
  }
  const canHaveCycled = state.events.slice(0,state.round-1).includes('abbey');
  for (const row of copy.market) for (const stack of row) {
    const [top,...unseen]=stack.tiles;
    const tail=unseen.sort();
    const marked=[...tail].find(id=>['washworks','smithy','workshop','courthouse','fish','warehouse'].includes(id));
    if (!canHaveCycled && marked) stack.tiles=[top,...shuffle(copy,tail.filter(id=>id!==marked)),marked];
    else stack.tiles=[top,...shuffle(copy,tail)];
  }
  copy.events=state.events.slice(0,state.round);
  copy.red=state.round<=3?shuffle(copy,[...state.red].sort()):[];
  return copy;
}

function repValue(rep, round) {
  return (REP_SCORE[rep]??0)+(rep>=3?(6-round)*0.62:Math.max(-3,rep)*0.2)+
    (rep>=6?(6-round)*0.52:0);
}

function cashValue(coins, productionIncome, round, conversion = false) {
  const buyingPower=25+(round<5?8:0);
  const baseline=Math.min(coins,buyingPower)*(round===6?0.14:0.22);
  const surplus=Math.max(0,coins-buyingPower);
  const storage=Math.min(surplus,35)*0.05+Math.max(0,surplus-35)*0.014;
  const liquidity=productionIncome===0 && coins<10 ? (10-coins)*0.33 : 0;
  return baseline+storage*(conversion&&round>=4?0.24:1)-liquidity;
}

function buildingFit(state, seat, tile, space) {
  let quality=0;
  const edge=CITY_EDGE[space];
  if (edge && tile.dots.includes(edge)) quality++;
  for (const i of TOWN_NEIGHBOURS[space]) {
    const cell=state.city[i];
    if (!cell) {
      if (!tile.public) quality+=0.18;
      continue;
    }
    if (!cell.id) continue;
    const neighbour=BUILDINGS[cell.id];
    const dots=[...neighbour.dots].filter(dot=>tile.dots.includes(dot)).length;
    if (tile.public) {
      const sign=cell.owner===seat?1:cell.owner===null?0:-0.85;
      quality+=sign*(1+dots+state.council.green*0.58);
    } else quality+=dots+(cell.owner===seat?dots*0.52:cell.owner===null?0.38:0);
  }
  return quality;
}

function project(state, seat, settings) {
  const p=state.players[seat];
  const round=state.round;
  const remaining=7-round;
  const scoringRounds=7-Math.max(round,4);
  const gross=income(state,seat);
  const base=patricianBase(state,seat);
  const breakdown=scoreBreakdown(state,seat);
  if (settings.conversion && round===6 && !cardsLeft(p) && !(state.actor===seat && state.pending.length)) {
    const repAfterTax=p.coins>=taxCost(state,seat)?p.rep:p.rep-REP_LOSS[round];
    const reputation=(REP_SCORE[Math.max(-5,repAfterTax)]??0)-2*Math.max(0,-5-repAfterTax);
    const council=PATRICIANS.reduce((sum,color)=>sum+base[color]*state.council[color],0);
    return breakdown.total-breakdown.reputation+reputation+council+p.coins*0.0001;
  }
  const owns=state.city.flatMap((cell,space)=>cell?.owner===seat?[space]:[]);
  const plots=state.city.flatMap((cell,space)=>cell?.plot===seat?[space]:[]);
  const playable=marketOffer(state).filter(offer=>{
    const tile=BUILDINGS[offer.id];
    return tile.public || (p.guilds.includes(tile.group)&&p.houses[p.guilds.indexOf(tile.group)]<4);
  }).map(offer=>offer.id);
  const holdings=p.held.map(id=>BUILDINGS[id]);
  const engine=Math.min(gross,30)*(round===6?0:0.105+0.082*(6-round))+
    Math.min(Math.max(gross-30,0),45)*(6-round)*0.026;
  const unspent=round===6?breakdown.extras:Math.min(p.held.length,1)*0.75+Math.max(0,p.held.length-1)*0.34+
    Math.min(plots.length,1)*0.95+Math.max(0,plots.length-1)*0.40+Math.min(3,p.pelicans)*0.83;
  const immediatePlan=holdings.length>0&&plots.length>0 ? Math.max(0,...holdings.flatMap(tile=>{
    if (!tile.public && (!canBuildGuild(state,tile.group) || p.houses[p.guilds.indexOf(tile.group)]>=4)) return [];
    const cost=tile.wood*price(state,'wood');
    if (p.coins+gross<cost) return [];
    return plots.map(space=>0.9+0.40*buildingFit(state,seat,tile,space)+
      (tile.public?(gross>12?0.35:-0.35):tile.production*(round<=3?0.24:0.12))-(cost>p.coins?0.7:0));
  })) : 0;
  const locationQuality=plots.length ? Math.max(0,...plots.flatMap(space=>{
    const candidates=(holdings.length ? holdings : playable.map(id=>BUILDINGS[id])).slice(0,9);
    return candidates.map(tile=>buildingFit(state,seat,tile,space));
  }))*0.34 : 0;
  const eligibility=round===6?0:owns.length*0.50+p.houses.reduce((sum,row)=>sum+0.19*row,0);
  const city=breakdown.town+eligibility+(immediatePlan+locationQuality)*(round===6?0.45:1);
  const rows=[0,1,2,3].map(row=>mineRow(state,row));
  const mineFootprint=round===6?0:rows.reduce((sum,row)=>{
    return sum+(row.count[seat]>0?0.31:0)+Math.min(3,row.stars[seat])*0.19;
  },0);
  const council=PATRICIANS.reduce((acc,color)=>{
    const points=base[color]*state.council[color];
    const possible=Math.min(1,state.patrons[color])*base[color]*(round===6?0.08:0.24);
    return acc+points*(1+(scoringRounds-1)*0.72)+possible;
  },0);
  const councilSetup=round===6?0:((p.usedPelicans%2 && (p.pelicans || state.council.silver))?0.65:0)+
    (state.council.yellow || state.patrons.yellow ? rows.filter(row=>row.count[seat]>0).length*0.34 : 0)+
    p.houses.reduce((sum,n)=>sum+Math.min(1,n),0)*0.23;
  const coinValue=cashValue(p.coins,gross,round,settings.conversion);
  const payment=taxCost(state,seat);
  const penaltyLoss=repValue(p.rep,round)-repValue(Math.max(-5,p.rep-REP_LOSS[round]),round)+
    Math.max(0,REP_LOSS[round]-5-p.rep)*2;
  const taxPressure=p.coins<payment?Math.min(2.6,penaltyLoss)*0.62:Math.min(coinValue-cashValue(p.coins-payment,gross,round,settings.conversion),penaltyLoss)*0.48;
  return p.vp+settings.city*city+settings.mine*(breakdown.mines+mineFootprint)+settings.council*(council+councilSetup)+
    breakdown.income+repValue(p.rep,round)*0.96+engine+coinValue+unspent-taxPressure+
    Math.min(p.pool,2)*0.26*(remaining-1);
}

function pendingEstimate(state) {
  const item=state.pending[0];
  if (!item) return 0;
  const p=state.players[state.actor];
  switch(item.kind) {
    case 'mine-place': {
      const placements=legalActions(state).filter(action=>action.kind==='place-mine');
      if (!placements.length) return -0.16;
      return Math.max(...placements.map(action=>{
        const mine=MINES[action.id];
        const row=mineRow(state,Math.floor(action.space/5));
        return mine.vp*0.50+mine.stars*(row.stars[state.actor]>=row.stars[1-state.actor]?0.46:0.62)+
          (state.round<5?mine.ore*0.72:mine.ore*0.24)-action.cost*0.035;
      }));
    }
    case 'technology': return 0.7;
    case 'income': return Math.min(3.5,income(state,state.actor)*0.12);
    case 'mine': return p.pool+p.reserve>0?1.25:0;
    case 'build': return p.held.length&&plotCount(state,state.actor)?2.8:0;
    case 'house': return item.production?1.6:0.55;
    case 'right': case 'plot': case 'patrician': case 'score-building': return 0.9;
    default: return 0;
  }
}

function evaluate(state, seat, settings, pending=true) {
  const opponent=state.round===6&&settings.conversion?1:settings.opponent;
  return project(state,seat,settings)-opponent*project(state,1-seat,settings)+
    (pending?pendingEstimate(state):0);
}

function cardsLeft(player) {
  return 5-CARDS.reduce((played,_,i)=>played+Number(!(player.hand&(1<<i))),0);
}

function taxDecision(state, options) {
  if (options.length===1) return options[0];
  const pay=options[0];
  const lose=options[1];
  const p=state.players[state.actor];
  const nextRep=p.rep-lose.loss;
  if (state.round===6) {
    const saved=(REP_SCORE[p.rep]??0)-(REP_SCORE[Math.max(-5,nextRep)]??0)+Math.max(0,-5-nextRep)*2;
    return saved>0 || pay.cost===0 ? pay : lose;
  }
  const gross=income(state,state.actor);
  const valueOfRep=repValue(p.rep,state.round)-repValue(Math.max(-5,nextRep),state.round)+Math.max(0,-5-nextRep)*2;
  const valueOfCoins=cashValue(p.coins,gross,state.round)-cashValue(p.coins-pay.cost,gross,state.round);
  const crossesThreshold=(p.rep>=3&&nextRep<3?0.64:0)+(p.rep>=6&&nextRep<6?0.47:0);
  return pay.cost===0||valueOfRep+crossesThreshold>=valueOfCoins?pay:lose;
}

function compare(a,b) {return b.value-a.value || a.order-b.order;}
function trim(items,width) {
  if (items.length<=width) return items.sort(compare);
  items.sort(compare);
  const kept=[];
  const byRoot=new Map();
  for (const item of items) {
    const key=actionKey(item.first);
    const count=byRoot.get(key)??0;
    if (count>=Math.max(2,Math.ceil(width/3))) continue;
    kept.push(item);
    byRoot.set(key,count+1);
    if (kept.length===width) break;
  }
  return kept;
}

function search(state, settings, sample) {
  const root=publicPlanningState(state,sample);
  const seat=root.actor;
  const throughTurn=state.left;
  const target=Math.min(cardsLeft(state.players[seat]),throughTurn+settings.extend);
  const start=evaluate(root,seat,settings);
  const finished=[];
  let beam=[{state:root,first:null,value:start,order:0,spent:0,afterCurrent:null}];
  let order=0;
  for (let depth=0;beam.length&&depth<18;depth++) {
    const next=[];
    for (const node of beam) {
      const pending=node.state.pending.length>0;
      if (!pending && node.spent===target && node.first) {
        finished.push(node);
        continue;
      }
      const actions=legalActions(node.state);
      for (const action of actions) {
        const child=copyState(node.state,false);
        applyKnownAction(child,action,true);
        const spent=node.spent+Number(!pending);
        let afterCurrent=node.afterCurrent;
        let value=evaluate(child,seat,settings);
        if (!child.pending.length && spent===throughTurn && afterCurrent===null) afterCurrent=value;
        if (afterCurrent!==null && spent>throughTurn) value=afterCurrent+(value-afterCurrent)*0.68;
        if (action.kind==='skip' && !pending) value-=0.09;
        if (node.spent>=target && !child.pending.length && pending) {
          finished.push({state:child,first:node.first??action,value,order:order++,spent,afterCurrent});
        } else {
          next.push({state:child,first:node.first??action,value,order:order++,spent,afterCurrent});
        }
      }
    }
    beam=trim(next,settings.width);
  }
  return (finished.sort(compare)[0]??beam.sort(compare)[0])?.first;
}

export function botAction(state, strategy=state.difficulty) {
  const options=legalActions(state);
  if (!options.length) return null;
  if (state.phase==='tax') return taxDecision(state,options);
  if (options.length===1) return options[0];
  const settings=POLICIES[strategy]??POLICIES.standard;
  const selected=search(state,settings,0);
  return options.find(action=>actionKey(action)===actionKey(selected??{}))??options[0];
}

export function actionRationale(state, action) {
  const p=state.players[state.actor];
  switch(action.kind) {
    case 'rights': {
      const tile=BUILDINGS[action.id];
      return tile.public?`Secures ${tile.name} for its public-building effects.`:
        `Secures ${tile.name} as a way to produce more ${COMMODITY[tile.group].toLowerCase()}.`;
    }
    case 'plot': return `Reserves ${coordinate(action.space,6)} for construction${p.held.length?' using a held building right':''}.`;
    case 'build': return BUILDINGS[action.id].public?'Takes a public building’s immediate benefits and changes the city’s scoring opportunities.':
      `Builds ${BUILDINGS[action.id].name} to add ${COMMODITY[BUILDINGS[action.id].group].toLowerCase()} production and a guild house.`;
    case 'income': return action.color?`Raises cash and adds ${action.color} patrician scoring.`:'Raises cash at current market prices.';
    case 'mine': return 'Opens a mine draw to develop the ore economy or contest mine rows.';
    case 'technology': case 'place-mine': {
      const mine=MINES[action.id];
      return `Places ${mine.name} in row ${1+Math.floor(action.space/5)}${mine.stars?` with ${mine.stars} ${mine.stars===1?'star':'stars'}`:''}${mine.ore?` and ${mine.ore} ore production`:''}.`;
    }
    case 'barbara': return 'Spends a pelican to claim the current cathedral benefit.';
    case 'tax': return 'Pays the tax to preserve reputation.';
    case 'penalty': return 'Keeps cash by taking the reputation penalty.';
    default: return '';
  }
}
