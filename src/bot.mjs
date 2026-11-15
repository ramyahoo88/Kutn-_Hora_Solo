import {BUILDINGS,CARDS,CITY_WIDTH,COMMODITY,MINE_GROUPS,MINES,PATRICIANS,REP_SCORE} from './data.mjs';
import {
  actionKey,applyKnownAction,canBuildGuild,cardsThisTurn,coordinate,copyState,income,legalActions,marketOffer,mineRow,mineRows,
  patricianBase,plotCount,price,reputationChange,rulesFor,scoreBreakdown,seatAtTurn,seedNumber,taxCost,turnsPerRound,
} from './engine.mjs';
import {randomIndex,shuffle} from './random.mjs';

const classic={width:10,extend:1,opponent:0.88,city:1,mine:1,council:1,conversion:true};
const POLICIES = {
  standard:{...classic,planning:true,replyChoices:5,variety:0.32},
  classic,
  baseline:{width:10,extend:1,opponent:0.83,city:1,mine:1,council:1},
  quick:{width:4,extend:0,opponent:0.65,city:1,mine:1,council:1,planning:true,replyChoices:3,variety:0.32},
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
  copy.red=state.round<=rulesFor(state).redRound?shuffle(copy,[...state.red].sort()):[];
  return copy;
}

function repValue(rep, remaining, planning) {
  const points=(REP_SCORE[rep]??0)+(rep>=3?remaining*0.62:Math.max(-3,rep)*0.2)+
    (rep>=6?remaining*0.52:0);
  if (!planning || !remaining) return points;
  const progress=Math.min(rep,3)*(0.48+remaining*0.11);
  return points+progress+(rep>=3?remaining*0.58:0);
}

function cashValue(coins, productionIncome, remaining, conversion = false) {
  const buyingPower=25+(remaining>1?8:0);
  const baseline=Math.min(coins,buyingPower)*(remaining===0?0.14:0.22);
  const surplus=Math.max(0,coins-buyingPower);
  const storage=Math.min(surplus,35)*0.05+Math.max(0,surplus-35)*0.014;
  const liquidity=productionIncome===0 && coins<10 ? (10-coins)*0.33 : 0;
  return baseline+storage*(conversion&&remaining<=2?0.24:1)-liquidity;
}

function buildingFit(state, seat, tile, space) {
  let quality=0;
  const {edge,neighbours}=rulesFor(state).board;
  if (edge[space] && tile.dots.includes(edge[space])) quality++;
  for (const i of neighbours[space]) {
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

function canConstruct(state, player, tile) {
  if (tile.public) return true;
  const row=player.guilds.indexOf(tile.group);
  return row>=0 && player.houses[row]<4 && canBuildGuild(state,tile.group);
}

function constructionStock(state, player, plots, holdings, market, gross, wood) {
  // Allow one Income action to fund a near-term build. Give a single unpaired
  // right or plot some value when the other part of the plan is within reach.
  const budget=player.coins+gross;
  const funded=holdings.filter(tile=>canConstruct(state,player,tile)&&tile.wood*wood<=budget);
  const pairs=Math.min(funded.length,plots.length);
  const land=rulesFor(state).board.town.some((open,space)=>open&&!state.city[space]);
  const rightProspect=Number(pairs===0&&funded.length>0&&land);
  const plotProspect=Number(pairs===0&&plots.length>0&&market.some(offer=>{
    const tile=BUILDINGS[offer.id];
    return canConstruct(state,player,tile)&&tile.wood*wood+offer.cost<=budget;
  }));
  const spareRights=holdings.length-pairs-rightProspect;
  const sparePlots=plots.length-pairs-plotProspect;
  return pairs*0.56+rightProspect*0.34+plotProspect*0.38-spareRights*0.66-sparePlots*0.82;
}

function project(state, seat, settings, rows) {
  const p=state.players[seat];
  const round=state.round;
  const {rounds,redRound,repLoss}=rulesFor(state);
  const remaining=rounds-round;
  const scoringRounds=rounds+1-Math.max(round,redRound+1);
  const gross=income(state,seat);
  const base=patricianBase(state,seat,rows);
  const breakdown=scoreBreakdown(state,seat,rows);
  if (settings.conversion && remaining===0 && !cardsLeft(p) && !(state.actor===seat && state.pending.length)) {
    const repAfterTax=p.coins>=taxCost(state,seat)?p.rep:p.rep-repLoss[round];
    const reputation=(REP_SCORE[Math.max(-5,repAfterTax)]??0)-2*Math.max(0,-5-repAfterTax);
    const council=PATRICIANS.reduce((sum,color)=>sum+base[color]*state.council[color],0);
    return breakdown.total-breakdown.reputation+reputation+council+p.coins*0.0001;
  }
  const owns=state.city.flatMap((cell,space)=>cell?.owner===seat?[space]:[]);
  const plots=state.city.flatMap((cell,space)=>cell?.plot===seat?[space]:[]);
  const playable=marketOffer(state).filter(offer=>{
    const tile=BUILDINGS[offer.id];
    return tile.public || (p.guilds.includes(tile.group)&&p.houses[p.guilds.indexOf(tile.group)]<4);
  });
  const holdings=p.held.map(id=>BUILDINGS[id]);
  const wood=price(state,'wood');
  const engine=Math.min(gross,30)*(remaining===0?0:0.105+0.082*remaining)+
    Math.min(Math.max(gross-30,0),45)*remaining*0.026;
  const classicStock=Math.min(p.held.length,1)*0.75+Math.max(0,p.held.length-1)*0.34+
    Math.min(plots.length,1)*0.95+Math.max(0,plots.length-1)*0.40;
  const stock=settings.planning&&remaining>0?constructionStock(state,p,plots,holdings,playable,gross,wood):classicStock;
  const unspent=remaining===0?breakdown.extras:stock+Math.min(3,p.pelicans)*0.83;
  const immediatePlan=holdings.length>0&&plots.length>0 ? Math.max(0,...holdings.flatMap(tile=>{
    if (!tile.public && (!canBuildGuild(state,tile.group) || p.houses[p.guilds.indexOf(tile.group)]>=4)) return [];
    const cost=tile.wood*wood;
    if (p.coins+gross<cost) return [];
    return plots.map(space=>0.9+0.40*buildingFit(state,seat,tile,space)+
      (tile.public?(gross>12?0.35:-0.35):tile.production*(round<=3?0.24:0.12))-(cost>p.coins?0.7:0));
  })) : 0;
  const locationQuality=plots.length ? Math.max(0,...plots.flatMap(space=>{
    const candidates=(holdings.length ? holdings : playable.map(offer=>BUILDINGS[offer.id])).slice(0,9);
    return candidates.map(tile=>buildingFit(state,seat,tile,space));
  }))*0.34 : 0;
  const eligibility=remaining===0?0:owns.length*0.50+p.houses.reduce((sum,row)=>sum+0.19*row,0);
  const city=breakdown.town+eligibility+(immediatePlan+locationQuality)*(remaining===0?0.45:1);
  const mineFootprint=remaining===0?0:rows.reduce((sum,row)=>{
    return sum+(row.count[seat]>0?0.31:0)+Math.min(3,row.stars[seat])*0.19;
  },0);
  const council=PATRICIANS.reduce((acc,color)=>{
    const points=base[color]*state.council[color];
    const possible=Math.min(1,state.patrons[color])*base[color]*(remaining===0?0.08:0.24);
    return acc+points*(1+(scoringRounds-1)*0.72)+possible;
  },0);
  const councilSetup=remaining===0?0:((p.usedPelicans%2 && (p.pelicans || state.council.silver))?0.65:0)+
    (state.council.yellow || state.patrons.yellow ? rows.filter(row=>row.count[seat]>0).length*0.34 : 0)+
    p.houses.reduce((sum,n)=>sum+Math.min(1,n),0)*0.23;
  const coinValue=cashValue(p.coins,gross,remaining,settings.conversion);
  const payment=taxCost(state,seat);
  const penalty=reputationChange(p.rep,-repLoss[round]);
  const reputation=repValue(p.rep,remaining,settings.planning);
  const penaltyLoss=reputation-repValue(penalty.rep,remaining,settings.planning)-penalty.vp;
  const taxPressure=p.coins<payment?Math.min(2.6,penaltyLoss)*0.62:Math.min(coinValue-cashValue(p.coins-payment,gross,remaining,settings.conversion),penaltyLoss)*0.48;
  return p.vp+settings.city*city+settings.mine*(breakdown.mines+mineFootprint)+settings.council*(council+councilSetup)+
    breakdown.income+reputation*0.96+engine+coinValue+unspent-taxPressure+
    Math.min(p.pool,2)*0.26*remaining;
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
        const rules=rulesFor(state);
        const row=mineRow(state,Math.floor(action.space/rules.board.mineWidth));
        const leads=row.stars.every(value=>value<=row.stars[state.actor]);
        return mine.vp*0.50+mine.stars*(leads?0.46:0.62)+
          (state.round<rules.rounds-1?mine.ore*0.72:mine.ore*0.24)-action.cost*0.035;
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
  const opponent=state.round===rulesFor(state).rounds&&settings.conversion?1:settings.opponent;
  const rows=mineRows(state);
  const scores=state.players.map((_,player)=>project(state,player,settings,rows));
  const others=scores.filter((_,player)=>player!==seat);
  // Respect the strongest rival while keeping pressure from the rest of the table.
  const opposition=0.7*Math.max(...others)+0.3*others.reduce((sum,value)=>sum+value,0)/others.length;
  return scores[seat]-opponent*(others.length===1?others[0]:opposition)+
    (pending?pendingEstimate(state):0);
}

function cardsLeft(player) {
  return 5-CARDS.reduce((played,_,i)=>played+Number(!(player.hand&(1<<i))),0);
}

function taxDecision(state, options, settings) {
  if (options.length===1) return options[0];
  const pay=options[0];
  const lose=options[1];
  const p=state.players[state.actor];
  const nextRep=p.rep-lose.loss;
  const remaining=rulesFor(state).rounds-state.round;
  if (remaining===0) {
    const saved=(REP_SCORE[p.rep]??0)-(REP_SCORE[Math.max(-5,nextRep)]??0)+Math.max(0,-5-nextRep)*2;
    return saved>0 || pay.cost===0 ? pay : lose;
  }
  const gross=income(state,state.actor);
  const valueOfRep=repValue(p.rep,remaining,settings.planning)-
    repValue(Math.max(-5,nextRep),remaining,settings.planning)+Math.max(0,-5-nextRep)*2;
  const valueOfCoins=cashValue(p.coins,gross,remaining)-cashValue(p.coins-pay.cost,gross,remaining);
  const crossesThreshold=(p.rep>=3&&nextRep<3?0.64:0)+(p.rep>=6&&nextRep<6?0.47:0);
  const protection=settings.planning&&p.coins-pay.cost<8&&p.held.length&&gross<8
    ? (8-Math.max(0,p.coins-pay.cost))*0.1
    : 0;
  return pay.cost===0||valueOfRep+crossesThreshold>=valueOfCoins+protection?pay:lose;
}

// Estimate which public opportunity the very next player is most likely to take.
// The model spends one legal card and does not search that player's full turn.
export function forecastNextCard(state) {
  const turn=state.turn+1;
  if (state.phase!=='action'||state.pending.length||turn>=turnsPerRound(state)) return null;
  const seat=seatAtTurn(state,turn);
  const next={...state,actor:seat,turn,left:cardsThisTurn(state,turn)};
  const player=state.players[seat];
  const gross=income(state,seat);
  const wood=price(state,'wood');
  const holding=player.held.map(id=>BUILDINGS[id]).filter(tile=>canConstruct(state,player,tile));
  const plots=plotCount(state,seat);
  const horizon=rulesFor(state).rounds-state.round;
  const affordable=holding.filter(tile=>tile.wood*wood<=player.coins+gross);
  const council=patricianBase(state,seat);
  const tilePriority=tile=>tile.public
    ? tile.vp*0.65+tile.pelicans*0.75+tile.rep*0.55
    : tile.production*price(state,tile.group)*(horizon>0?0.24:0.12);
  const priorities={
    build:action=>3.3+tilePriority(BUILDINGS[action.id])+buildingFit(state,seat,BUILDINGS[action.id],action.space)*0.36,
    rights:action=>{
      const tile=BUILDINGS[action.id];
      if (!canConstruct(state,player,tile)||tile.wood*wood+action.cost>player.coins+gross) return 0.2;
      return 0.65+Math.min(2,tilePriority(tile)*0.55)+Number(plots>affordable.length)*1.5-affordable.length*0.72;
    },
    plot:action=>0.7-1.3*plots+(affordable.length
      ? 2.1+Math.max(0,...affordable.map(tile=>buildingFit(state,seat,tile,action.space)))*0.33
      : 0),
    income:action=>Math.min(gross,35)*(player.coins<13?0.21:0.085)+
      Number(action.gross>0&&holding.some(tile=>tile.wood*wood>player.coins&&tile.wood*wood<=player.coins+gross))*1.8+
      (action.color?council[action.color]*(1+horizon*0.18)-0.65:0),
    mine:()=>1.5+state.technology*0.24+Number(gross<8)*0.8,
    barbara:()=>2.15+Number(player.rep<3&&horizon>0)*0.8,
    skip:()=>-1,
  };
  let best=null;
  let bestScore=-Infinity;
  for (const action of legalActions(next)) {
    const score=priorities[action.kind](action)-(action.cost??0)*0.055-
      Number(!!action.as&&player.rep<6)*0.75;
    if (score>bestScore) {
      best=action;
      bestScore=score;
    }
  }
  return best?{seat,turn,action:best}:null;
}

function replyAdjustment(position, seat, settings) {
  const reply=forecastNextCard(position);
  if (!reply) return 0;
  const projected=copyState(position,false);
  projected.actor=reply.seat;
  projected.turn=reply.turn;
  projected.left=cardsThisTurn(projected);
  applyKnownAction(projected,reply.action,true);
  const swing=evaluate(projected,seat,settings,false)-evaluate(position,seat,settings,false)-
    settings.opponent*pendingEstimate(projected)*0.35;
  return Math.max(-2.7,Math.min(2.7,swing))*0.42;
}

function variation(state, action, amplitude) {
  if (!amplitude||state.round===rulesFor(state).rounds) return 0;
  // The public game seed varies close choices without consulting the deck RNG.
  const context=seedNumber(`${state.round}/${state.turn}/${state.left}/${state.actor}/${actionKey(action)}`);
  const rng={rng:(seedNumber(state.seed)^context)>>>0};
  return (randomIndex(rng,4096)/4096-0.5)*amplitude;
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
  let beam=[{state:root,first:null,value:start,order:0,spent:0,afterCurrent:null,turnEnd:null}];
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
        let turnEnd=node.turnEnd;
        let value=evaluate(child,seat,settings);
        if (!child.pending.length && spent===throughTurn && afterCurrent===null) {
          afterCurrent=value;
          turnEnd=child;
        }
        if (afterCurrent!==null && spent>throughTurn) value=afterCurrent+(value-afterCurrent)*0.68;
        if (action.kind==='skip' && !pending) value-=0.09;
        if (node.spent>=target && !child.pending.length && pending) {
          finished.push({state:child,first:node.first??action,value,order:order++,spent,afterCurrent,turnEnd});
        } else {
          next.push({state:child,first:node.first??action,value,order:order++,spent,afterCurrent,turnEnd});
        }
      }
    }
    beam=trim(next,settings.width);
  }
  const ranked=(finished.length?finished:beam).sort(compare);
  if (!settings.replyChoices) return ranked[0]?.first;
  const shortList=[];
  const seen=new Set();
  for (const node of ranked) {
    const key=actionKey(node.first);
    if (seen.has(key)) continue;
    seen.add(key);
    const reply=node.turnEnd?replyAdjustment(node.turnEnd,seat,settings):0;
    shortList.push({...node,value:node.value+reply+variation(state,node.first,settings.variety)});
    if (shortList.length===settings.replyChoices) break;
  }
  return shortList.sort(compare)[0]?.first;
}

export function botAction(state, strategy=state.difficulty) {
  const options=legalActions(state);
  if (!options.length) return null;
  const settings=POLICIES[strategy]??POLICIES.standard;
  if (state.phase==='tax') return taxDecision(state,options,settings);
  if (options.length===1) return options[0];
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
    case 'plot': return `Reserves ${coordinate(action.space,CITY_WIDTH)} for construction${p.held.length?' using a held building right':''}.`;
    case 'build': return BUILDINGS[action.id].public?'Takes a public building’s immediate benefits and changes the city’s scoring opportunities.':
      `Builds ${BUILDINGS[action.id].name} to add ${COMMODITY[BUILDINGS[action.id].group].toLowerCase()} production and a guild house.`;
    case 'income': return action.color?`Raises cash and adds ${action.color} patrician scoring.`:'Raises cash at current market prices.';
    case 'mine': return 'Opens a mine draw to develop the ore economy or contest mine rows.';
    case 'technology': case 'place-mine': {
      const mine=MINES[action.id];
      return `Places ${mine.name} in row ${1+Math.floor(action.space/rulesFor(state).board.mineWidth)}${mine.stars?` with ${mine.stars} ${mine.stars===1?'star':'stars'}`:''}${mine.ore?` and ${mine.ore} ore production`:''}.`;
    }
    case 'barbara': return 'Spends a pelican to claim the current cathedral benefit.';
    case 'tax': return 'Pays the tax to preserve reputation.';
    case 'penalty': return 'Keeps cash by taking the reputation penalty.';
    default: return '';
  }
}
