import {
  BARBARA_TAX, BUILDINGS, BUILDING_GROUPS, CARDS, CARDS_PER_TURN, CITY_WIDTH, COMMODITY,
  EVENTS, GAME_RULES, GOODS, GUILDS, GUILD_SETUPS_BY_COUNT, HOUSE_EFFECTS, LABEL,
  MINCMISTR_LEVELS, MINCMISTR_PLANS, MINES, MINE_GROUPS, MINE_ROWS, PATRICIANS,
  REP_SCORE, RIVAL_SETTINGS, ROCK_STARS, SAVE_SCHEMA, SETUP_VERSION,
  TECHNOLOGY,
} from './data.mjs';
import {BUILD_DEMAND, CITY_BUILDS, PRICES} from './prices.mjs';
import {randomIndex,shuffle} from './random.mjs';

export const seatName = (seat, count) => seat===0?'You':count===2?'Rival':`Rival ${seat}`;
export const rulesFor = state => GAME_RULES[state.players.length];
export const turnsPerRound = state => state.players.length*CARDS_PER_TURN.length;
export const seatAtTurn = (state, turn) => (state.starter+turn)%state.players.length;
export function cardsThisTurn(state, turn=state.turn) {
  const cards=CARDS_PER_TURN[Math.floor(turn/state.players.length)];
  if (cards!==1 || !state.mincmistr || seatAtTurn(state,turn)===0) return cards;
  const {level,tougher}=state.mincmistr;
  const asSixRounds=state.round+6-rulesFor(state).rounds;
  const double=MINCMISTR_LEVELS[level].extraCard.includes(asSixRounds) || (tougher && asSixRounds===3);
  return double?2:cards;
}
const UNPLAYED = (1 << CARDS.length) - 1;
const FROM_POPULATION = ['wood','food','beer'];
const FROM_ORE = ['silver','permit'];
const EFFECT_ID = action => JSON.stringify([action.kind,action.id,action.space,action.refill,action.color,action.card,action.as]);
export const coordinate = (space, columns) => `${'ABCDEFG'[space%columns]}${1+Math.floor(space/columns)}`;
export const eventNow = state => EVENTS[state.events[state.round-1]];
export const currentBarbara = state => Math.min(state.barbara,12);
const commodityRecord = () => Object.fromEntries(GOODS.map(key => [key,0]));
const tokenRecord = count => Object.fromEntries(PATRICIANS.map(key => [key,count]));
const empty = count => Array(count).fill(null);

export function seedNumber(value) {
  const normalized = String(value ?? 'silver-1308').trim().slice(0,64) || 'silver-1308';
  let hash = 2166136261;
  for (const character of normalized) hash = Math.imul(hash ^ character.codePointAt(0),16777619);
  return hash >>> 0;
}

export function createPlanDeck(seed, seat) {
  const rng={rng:seedNumber(`mincmistr/${seed}/${seat}`)};
  return {rng,draw:shuffle(rng,MINCMISTR_PLANS.map((_,i)=>i)),discard:[]};
}

function setupMincmistr(seed, count, options) {
  const level=Object.hasOwn(MINCMISTR_LEVELS,options.level)?options.level:'journeyman';
  const tougher=count===3&&level==='master'&&options.tougher===true;
  const shared=count===2||options.shared!==false;
  const decks=Array.from({length:shared?1:count-1},(_,i)=>createPlanDeck(seed,i+1));
  return {level,tougher,shared,decks,lastPlans:empty(count-1)};
}

function player(guilds, coins) {
  return {
    guilds:[...guilds], coins, vp:0, rep:0, production:commodityRecord(),
    houses:[0,0,0], held:[], pool:1, reserve:8, pelicans:0, usedPelicans:0, hand:UNPLAYED,
  };
}

export function createGame(options = {}) {
  const seed = String(options.seed ?? 'silver-1308').trim().slice(0,64) || 'silver-1308';
  const count = [2,3,4].includes(options.playerCount)?options.playerCount:2;
  const rules=GAME_RULES[count];
  const setupCards=GUILD_SETUPS_BY_COUNT[count];
  const setup = Object.hasOwn(setupCards,options.setup) ? Number(options.setup) : 1;
  const seatOption=value=>Number.isInteger(value)&&value>=0&&value<count?value:0;
  const side=seatOption(options.side);
  const starter=seatOption(options.starter);
  const rng = seedNumber(seed);
  const sets=setupCards[setup];
  const others=sets.filter((_,index)=>index!==side);
  const guildSets=[sets[side],...shuffle({rng:seedNumber(`guild-sets/${rng}/${setup}/${side}/${count}`)},others)];
  const state = {
    schema:SAVE_SCHEMA, setupVersion:SETUP_VERSION, seed, rng,
    setup, side, starter, round:1, turn:0, left:CARDS_PER_TURN[0],
    actor:starter, phase:'action', pending:[], difficulty:RIVAL_SETTINGS.includes(options.difficulty)?options.difficulty:'standard',
    players:guildSets.map((printed,i) => {
      const order = options.orders?.[i];
      const coins = 40+(i-starter+count)%count;
      if (Array.isArray(order) && order.length===3 && new Set(order).size===3 && order.every(key=>printed.includes(key))) {
        return player(order,coins);
      }
      if (i===0) return player(printed,coins);
      // Keep the rival's house order independent of the market and deck shuffles.
      const suffix=count===2?'':`/${count}/${i}`;
      const houseRng = {rng:seedNumber(`rival-houses/${rng}/${setup}/${side}${suffix}`)};
      return player(shuffle(houseRng,printed),coins);
    }),
    city:empty(rules.board.town.length), mine:empty(MINE_ROWS*rules.board.mineWidth), market:[], marketDiscard:[],
    mineDeck:[], mineDiscard:[], mineMixed:false, technology:0, red:[], events:[],
    pop:0, ore:0, arms:commodityRecord(), tax:0, barbara:1,
    bank:tokenRecord(3), patrons:tokenRecord(0), council:tokenRecord(0),
    log:[], result:null, mineLayout:0,
  };
  if (state.difficulty==='mincmistr') state.mincmistr=setupMincmistr(seed,count,options.mincmistr??{});
  const guildStacks = shuffle(state,GOODS);
  const publicStacks = ['green','civicSilver','yellow'];
  state.market = publicStacks.map((group,i) => {
    const rows = guildStacks.slice(i*2,i*2+2).map(guild => {
      const ids = BUILDING_GROUPS[guild].map(tile=>tile.id);
      return {group:guild, tiles:[...shuffle(state,ids.slice(0,-1)),ids.at(-1)]};
    });
    return [...rows,{group,tiles:shuffle(state,BUILDING_GROUPS[group].map(tile=>tile.id))}];
  });
  state.red = shuffle(state,BUILDING_GROUPS.red.map(tile=>tile.id));
  const layouts=rules.board.rockLayouts;
  state.mineLayout = randomIndex(state,layouts.length);
  if (Number.isInteger(options.mineLayout) && layouts[options.mineLayout]) state.mineLayout=options.mineLayout;
  const rocks = shuffle(state,ROCK_STARS);
  for (const [i,space] of layouts[state.mineLayout].entries()) state.mine[space]={rock:true,stars:rocks[i]};
  state.mineDeck = MINE_GROUPS.flatMap(group=>shuffle(state,group.map(tile=>tile.id)));
  const pool = key => Object.keys(EVENTS).filter(id=>EVENTS[id].set===key);
  if (count===2 || options.events===true) {
    state.events=[...shuffle(state,pool('A')).slice(0,rules.redRound),
      ...shuffle(state,pool('B')).slice(0,rules.rounds-rules.redRound-1)];
  }
  beginRound(state);
  return state;
}

export function copyState(state, keepLog = true) {
  return {
    ...state,
    players:state.players.map(p=>({...p,production:{...p.production},houses:[...p.houses],held:[...p.held]})),
    city:[...state.city], mine:[...state.mine],
    pending:state.pending.map(item=>item.drawn?{...item,drawn:[...item.drawn]}:{...item}),
    market:state.market.map(row=>row.map(stack=>({group:stack.group,tiles:[...stack.tiles]}))),
    arms:{...state.arms}, bank:{...state.bank}, patrons:{...state.patrons}, council:{...state.council},
    mineDeck:[...state.mineDeck], mineDiscard:[...state.mineDiscard], marketDiscard:[...state.marketDiscard],
    log:keepLog && state.log ? [...state.log] : null,
  };
}

function log(state, actor, text) {
  if (state.log) state.log.push({round:state.round,actor,text});
}
function addTax(state, amount=0) {state.tax=Math.min(25,state.tax+amount);}
export function reputationChange(reputation, amount) {
  const intended = reputation+amount;
  const rep = Math.min(9,Math.max(-5,intended));
  return {rep,vp:(intended-rep)*2};
}
function changeRep(player, amount) {
  const {rep,vp}=reputationChange(player.rep,amount);
  player.rep=rep;
  player.vp+=vp;
}

export function price(state, key) {
  const level = FROM_POPULATION.includes(key) ? state.pop : state.ore;
  const arm = key==='ore' ? state.arms.silver : state.arms[key];
  return PRICES[key][level][arm];
}
export function canBuildGuild(state, key) {
  if (key==='ore') return true;
  const level=FROM_POPULATION.includes(key)?state.pop:state.ore;
  return level>=BUILD_DEMAND[key][state.arms[key]];
}
export function income(state, seat) {
  return GOODS.reduce((total,key)=>total+state.players[seat].production[key]*price(state,key),0);
}

export function marketOffer(state) {
  const permits = price(state,'permit');
  return state.market.flatMap((row,r)=>row.map((stack,c)=>({
    id:stack.tiles[0],group:stack.group,row:r,col:c,count:stack.tiles.length,cost:c===0?1:c*permits,
  })));
}
function moveStack(state, row, col, takeTile=true) {
  const line = state.market[row];
  const [stack] = line.splice(col,1);
  const id = takeTile ? stack.tiles.shift() : null;
  if (stack.tiles.length) line.push(stack);
  return id;
}
function advanceDemand(state, type, amount=0) {
  const track = type==='pop' ? FROM_POPULATION : FROM_ORE;
  const limit = type==='pop' ? 40 : 30;
  for (let i=0; i<amount && state[type]<limit; i++) {
    state[type]++;
    for (const group of track) {
      if (CITY_BUILDS[group][state.arms[group]]!==state[type]) continue;
      state.arms[group]++;
      const offer = marketOffer(state).find(tile=>tile.group===group);
      if (offer) state.marketDiscard.push(moveStack(state,offer.row,offer.col));
      log(state,null,offer?`The town expands ${COMMODITY[group].toLowerCase()} supply and removes ${BUILDINGS[offer.id].name} from the offer.`:`The town expands ${COMMODITY[group].toLowerCase()} supply.`);
    }
  }
}
function bypassBarbara(state) {
  if (state.barbara<=11) {
    addTax(state,BARBARA_TAX[state.barbara]);
    state.barbara++;
  }
}
function produce(state, seat, key, amount, affectsOre = true) {
  state.players[seat].production[key] += amount;
  if (key==='ore' && affectsOre) advanceDemand(state,'ore',amount);
}

export function plotSpaces(state, seat, free=false, rep=state.players[seat].rep) {
  if (plotCount(state,seat)>=3) return [];
  const {town,neighbours}=rulesFor(state).board;
  const open = town.flatMap((active,space)=>active && !state.city[space] ? [space] : []);
  const adjacent = open.map(space=>{
    const costs=neighbours[space].flatMap(i=>state.city[i]?.id?[BUILDINGS[state.city[i].id].plot]:[]);
    return {space,cost:costs.length?Math.max(...costs):null};
  });
  const mustTouch = !free && adjacent.some(item=>item.cost!==null);
  return adjacent.filter(item=>!mustTouch || item.cost!==null).map(item=>({
    space:item.space,cost:free?0:rep>=3?1:item.cost??5,
  }));
}

export function mineSpaces(state) {
  const {mineWidth,entrances}=rulesFor(state).board;
  const result=[];
  for (let space=0;space<state.mine.length;space++) {
    if (state.mine[space]) continue;
    const col=space%mineWidth;
    if (entrances.includes(space)) {
      result.push({space,wood:2});
      continue;
    }
    const adjacent=[col>0?space-1:-1,col<mineWidth-1?space+1:-1,space-mineWidth];
    const costs=adjacent.flatMap(i=>state.mine[i]?.id?[MINES[state.mine[i].id].extend]:[]);
    if (costs.length) result.push({space,wood:Math.max(...costs)});
  }
  return result;
}
export const plotCount = (state,seat) => state.city.filter(cell=>cell?.plot===seat).length;

function noChoices(explain, reason) {
  explain?.(reason);
  return [];
}
function rightsChoices(state, seat, {free=false,publicOnly=false,explain}={}) {
  const p = state.players[seat];
  if (p.held.length>=3) return noChoices(explain,'3 rights already held');
  const eligible=marketOffer(state).filter(offer=>{
    const tile=BUILDINGS[offer.id];
    return tile.public || (!publicOnly && p.guilds.includes(tile.group));
  });
  if (!eligible.length) return noChoices(explain,'No eligible rights');
  const choices=eligible.flatMap(offer=>{
    const cost=free?0:offer.cost;
    return p.coins>=cost ? [{kind:'rights',id:offer.id,cost}] : [];
  });
  if (!choices.length && explain) explain(`Need ${Math.min(...eligible.map(offer=>offer.cost))} g`);
  return choices;
}
function buildingChoices(state, seat, {free=false,explain}={}) {
  const p=state.players[seat];
  const plots=state.city.flatMap((cell,space)=>cell?.plot===seat?[space]:[]);
  if (!p.held.length) return noChoices(explain,plots.length?'Need a building right':'Need a right and a plot');
  if (!plots.length) return noChoices(explain,'Need a plot');
  let minimumCost=Infinity;
  let guildRestriction='';
  const choices=p.held.flatMap(id=>{
    const tile=BUILDINGS[id];
    if (!tile.public) {
      const row=p.guilds.indexOf(tile.group);
      if (row<0) {
        guildRestriction ||= 'Need a right from your guilds or a public building';
        return [];
      }
      if (p.houses[row]>=4) {
        guildRestriction ||= `No houses for ${GUILDS[tile.group]}`;
        return [];
      }
      if (!canBuildGuild(state,tile.group)) {
        guildRestriction ||= `Demand too low for ${GUILDS[tile.group]}`;
        return [];
      }
    }
    const cost=free?0:tile.wood*price(state,'wood');
    minimumCost=Math.min(minimumCost,cost);
    if (p.coins<cost) return [];
    return plots.map(space=>({kind:'build',id,space,cost}));
  });
  if (!choices.length && explain) explain(minimumCost<Infinity?`Need ${minimumCost} g`:guildRestriction);
  return choices;
}
function plotChoices(state, seat, {free=false,rep,explain}={}) {
  const spaces=plotSpaces(state,seat,free,rep);
  const choices=spaces.filter(move=>move.cost<=state.players[seat].coins).map(move=>({kind:'plot',...move}));
  if (!choices.length && explain) {
    if (plotCount(state,seat)>=3) explain('3 plots already held');
    else if (!spaces.length) explain('No open plots');
    else explain(`Need ${Math.min(...spaces.map(move=>move.cost))} g`);
  }
  return choices;
}
function incomeChoices(state, seat) {
  const gross=income(state,seat);
  const choices=[{kind:'income',gross}];
  if (state.players[seat].coins+gross>=10) {
    for (const color of PATRICIANS) if (state.patrons[color]>0) choices.push({kind:'income',gross,color,cost:10});
  }
  return choices;
}
function mineStartChoices(state, seat, {free=false,explain}={}) {
  const p=state.players[seat];
  if (p.pool+p.reserve===0) return noChoices(explain,'No miners left');
  if (state.mineDeck.length+state.mineDiscard.length===0) return noChoices(explain,'No mine tiles left');
  if (free) return [{kind:'mine',refill:0,cost:0}];
  const fee = price(state,'permit');
  const choices=p.pool>0?[{kind:'mine',refill:0,cost:0}]:[];
  if (p.coins>=fee) {
    for (let refill=1;refill<=Math.min(p.reserve,2-p.pool);refill++) choices.push({kind:'mine',refill,cost:fee});
  }
  if (!choices.length && explain) explain(`Need ${fee} g to recruit`);
  return choices;
}
function basicChoices(state, seat, kind, settings={}) {
  switch(kind) {
    case 'rights': return rightsChoices(state,seat,settings);
    case 'plot': return plotChoices(state,seat,settings);
    case 'build': return buildingChoices(state,seat,settings);
    case 'income': return incomeChoices(state,seat);
    case 'mine': return mineStartChoices(state,seat,settings);
    case 'barbara': return state.players[seat].pelicans>0?[{kind}]:noChoices(settings.explain,'Need a pelican');
    default: return [];
  }
}

export function unavailableActionReason(state, card, kind) {
  if (!(state.players[state.actor].hand&(1<<card))) return 'Already played';
  let reason='';
  basicChoices(state,state.actor,kind,{explain:message=>{reason=message;}});
  return reason;
}

function pendingChoices(state, pending) {
  const seat=state.actor;
  const p=state.players[seat];
  const skip={kind:'skip'};
  switch(pending.kind) {
    case 'right': return [...rightsChoices(state,seat,{free:true,publicOnly:pending.publicOnly}),skip];
    case 'plot': return [...basicChoices(state,seat,'plot',{free:true}),skip];
    case 'build': return [...buildingChoices(state,seat,{free:true}),skip];
    case 'income': return [...incomeChoices(state,seat),skip];
    case 'mine': return [...mineStartChoices(state,seat,{free:true}),skip];
    case 'mine-place': {
      const woodPrice=price(state,'wood');
      const spaces=mineSpaces(state).filter(move=>pending.free || move.wood*woodPrice<=p.coins);
      return [...pending.drawn.flatMap(id=>spaces.map(move=>({kind:'place-mine',id,space:move.space,cost:pending.free?0:move.wood*woodPrice}))),{kind:'skip'}];
    }
    case 'technology': return [...(p.pool+p.reserve>0 ? mineSpaces(state).map(move=>({kind:'technology',id:pending.id,space:move.space,cost:0})) : []),skip];
    case 'house': {
      const choices=p.guilds.flatMap((id,row)=>p.houses[row]<4?[{kind:'house',id}]:[]);
      return pending.production||!choices.length ? [...choices,skip] : choices;
    }
    case 'patrician': return [...PATRICIANS.filter(color=>state.bank[color]>0).map(color=>({kind:'patrician',color})),skip];
    case 'score-building': return [...state.city.flatMap((cell,space)=>cell?.owner===seat?[{kind:'score-building',space}]:[]),skip];
    default: throw Error('Unknown bonus action.');
  }
}

export function taxCost(state, seat) {
  const surcharge = [0,0,3,8][plotCount(state,seat)];
  const id=state.events[state.round-1];
  if (id==='rush') return 0;
  return (state.tax+surcharge)*(id==='king'?2:1);
}

export function legalActions(state) {
  if (state.phase==='end') return [];
  const p=state.players[state.actor];
  if (state.phase==='tax') {
    const cost=taxCost(state,state.actor);
    return [...(p.coins>=cost?[{kind:'tax',cost}]:[]),{kind:'penalty',loss:rulesFor(state).repLoss[state.round]}];
  }
  if (state.pending.length) return pendingChoices(state,state.pending[0]);
  const actions=[];
  for (const [card,kinds] of CARDS.entries()) {
    if (!(p.hand&(1<<card))) continue;
    for (const kind of kinds) {
      if (kind==='joker') {
        const rep=p.rep>=6?p.rep:Math.max(-5,p.rep-1);
        for (const as of ['rights','plot','build','mine','income','barbara']) {
          for (const action of basicChoices(state,state.actor,as,{rep})) actions.push({...action,card,as});
        }
      } else {
        for (const action of basicChoices(state,state.actor,kind)) actions.push({...action,card});
      }
    }
    actions.push({kind:'skip',card});
  }
  return actions;
}
export const actionKey = EFFECT_ID;

function popMine(state) {
  if (!state.mineDeck.length && state.mineDiscard.length) {
    state.mineDeck=shuffle(state,state.mineDiscard);
    state.mineMixed=true;
    state.mineDiscard=[];
  }
  return state.mineDeck.shift();
}
function fillPool(p, refill) {p.reserve-=refill; p.pool+=refill;}
function pay(p, cost=0) {p.coins-=cost;}
function startMine(state, action, free) {
  const p=state.players[state.actor];
  pay(p,action.cost);
  if (action.refill) {
    fillPool(p,action.refill);
    log(state,state.actor,`Recruited ${action.refill} ${action.refill===1?'miner':'miners'} for ${action.cost} g.`);
  }
  const drawn=[];
  for (let i=0;i<state.technology+1;i++) {
    const id=popMine(state);
    if (id) drawn.push(id);
  }
  if (drawn.length) state.pending.unshift({kind:'mine-place',free,drawn});
}
function placeMine(state, action, free) {
  const seat=state.actor;
  const p=state.players[seat];
  const tile=MINES[action.id];
  pay(p,action.cost);
  if (free && p.reserve>0) p.reserve--;
  else p.pool--;
  state.mine[action.space]={id:tile.id,owner:seat,stars:tile.stars};
  produce(state,seat,'ore',tile.ore);
  advanceDemand(state,'pop',tile.pop);
  p.vp+=tile.vp;
  log(state,seat,`Placed ${tile.name} at mine ${coordinate(action.space,rulesFor(state).board.mineWidth)} for ${action.cost} g.`);
}

function claimRights(state, action) {
  const seat=state.actor;
  const p=state.players[seat];
  const offer=marketOffer(state).find(tile=>tile.id===action.id);
  pay(p,action.cost);
  p.held.push(moveStack(state,offer.row,offer.col));
  log(state,seat,`Took rights to ${BUILDINGS[action.id].name} for ${action.cost} g.`);
}
function construct(state, action) {
  const seat=state.actor;
  const p=state.players[seat];
  const tile=BUILDINGS[action.id];
  pay(p,action.cost);
  p.held.splice(p.held.indexOf(tile.id),1);
  state.city[action.space]={id:tile.id,owner:tile.public?null:seat};
  log(state,seat,`Built ${tile.name} at town ${coordinate(action.space,CITY_WIDTH)} for ${action.cost} g.`);
  if (tile.public) {
    p.vp+=tile.vp;
    p.pelicans+=tile.pelicans;
    changeRep(p,tile.rep);
    if (state.bank[tile.group]>0) {
      state.bank[tile.group]--;
      state.patrons[tile.group]++;
    }
    advanceDemand(state,'pop',tile.pop);
    addTax(state,tile.tax);
    if (tile.removeHouse && p.houses.some(value=>value<4)) state.pending.unshift({kind:'house'});
    return;
  }
  if (tile.group!=='ore') state.arms[tile.group]=Math.min(4,state.arms[tile.group]+1);
  produce(state,seat,tile.group,tile.production);
  advanceDemand(state,'pop',tile.pop);
  if (tile.bypass) bypassBarbara(state);
  const row=p.guilds.indexOf(tile.group);
  const effect=HOUSE_EFFECTS[row][p.houses[row]++];
  p.vp+=effect.vp??0;
  p.pelicans+=effect.pelicans??0;
  if (effect.rep) changeRep(p,effect.rep);
  if (effect.public) state.pending.unshift({kind:'right',publicOnly:true});
  if (tile.technology && state.technology<TECHNOLOGY.length) {
    state.pending.unshift({kind:'technology',id:TECHNOLOGY[state.technology++].id});
  }
}
function collect(state, action) {
  const seat=state.actor;
  const p=state.players[seat];
  p.coins+=action.gross;
  if (action.color) {
    pay(p,10);
    state.patrons[action.color]--;
    state.council[action.color]++;
  }
  log(state,seat,`Collected ${action.gross} g${action.color?` and seated a ${action.color} patrician for 10 g`:''}.`);
}

function useBarbara(state) {
  const seat=state.actor;
  const p=state.players[seat];
  const number=currentBarbara(state);
  p.pelicans--;
  p.usedPelicans++;
  log(state,seat,number===12?'Contributed at the completed cathedral.':`Contributed to St. Barbara, tile ${number}.`);
  switch(number) {
    case 1: case 12: changeRep(p,2); break;
    case 2: changeRep(p,1); state.pending.unshift({kind:'right'}); break;
    case 3: changeRep(p,-1); state.pending.unshift({kind:'house',production:true}); break;
    case 4: changeRep(p,1); state.pending.unshift({kind:'plot'}); break;
    case 5: changeRep(p,-2); state.pending.unshift({kind:'income'},{kind:'income'}); break;
    case 6: p.vp+=2; state.pending.unshift({kind:'patrician'}); break;
    case 7: changeRep(p,patricianBase(state,seat).green); break;
    case 8: p.vp++; state.pending.unshift({kind:'build',barbaraTile:8}); break;
    case 9: state.pending.unshift({kind:'mine'},{kind:'mine'}); break;
    case 10: state.pending.unshift({kind:'score-building'}); break;
    case 11: p.vp+=5; break;
  }
  // Tile 8 resolves the free building while tile 8 is still current.
  if (number<12 && number!==8) state.barbara++;
}

function basicEffect(state, action, free=false) {
  const seat=state.actor;
  const p=state.players[seat];
  switch(action.kind) {
    case 'rights': claimRights(state,action); break;
    case 'plot':
      pay(p,action.cost);
      state.city[action.space]={plot:seat};
      log(state,seat,`Claimed town ${coordinate(action.space,CITY_WIDTH)} for ${action.cost} g.`);
      break;
    case 'build': construct(state,action); break;
    case 'mine': startMine(state,action,free); break;
    case 'income': collect(state,action); break;
    case 'barbara': useBarbara(state); break;
    case 'skip': break;
  }
}

function resolvePending(state, action) {
  const item=state.pending.shift();
  const seat=state.actor;
  const p=state.players[seat];
  switch(item.kind) {
    case 'mine-place':
      for (const id of item.drawn) if (id!==action.id) state.mineDiscard.push(id);
      if (action.kind==='place-mine') placeMine(state,action,item.free);
      else log(state,seat,'Discarded the mine draw.');
      break;
    case 'technology':
      if (action.kind==='technology') placeMine(state,action,true);
      else log(state,seat,`Technology advanced to ${state.technology+1} tiles per draw. The free mine was discarded.`);
      break;
    case 'house':
      if (action.kind==='house') {
        p.houses[p.guilds.indexOf(action.id)]++;
        // St. Barbara tile 3 adjusts production only. The companion also distinguishes this from a mine.
        if (item.production) produce(state,seat,action.id,2,false);
        log(state,seat,`Removed a ${COMMODITY[action.id].toLowerCase()} guild house${item.production?' for 2 production':''}.`);
      }
      break;
    case 'patrician':
      if (action.kind==='patrician') {
        state.bank[action.color]--;
        state.council[action.color]++;
        log(state,seat,`Seated a ${action.color} patrician from the bank.`);
      }
      break;
    case 'score-building':
      if (action.kind==='score-building') {
        const points=cityPointsAt(state,action.space);
        p.vp+=points;
        log(state,seat,`Scored ${points} VP for ${BUILDINGS[state.city[action.space].id].name}.`);
      }
      break;
    default: basicEffect(state,action,true); break;
  }
  if (item.barbaraTile===state.barbara) state.barbara++;
}

function matchingDots(dots, other) {
  let count=0;
  for (const dot of other) if (dots.includes(dot)) count++;
  return count;
}
export function cityPointsAt(state, space) {
  const cell=state.city[space];
  if (!cell?.id) return 0;
  const dots=BUILDINGS[cell.id].dots;
  const {edge,neighbours}=rulesFor(state).board;
  return matchingDots(dots,edge[space]??'')+neighbours[space].reduce((sum,i)=>{
    const id=state.city[i]?.id;
    return sum+(id?matchingDots(dots,BUILDINGS[id].dots):0);
  },0);
}
export function mineRow(state, row) {
  const width=rulesFor(state).board.mineWidth;
  const cells=state.mine.slice(row*width,(row+1)*width);
  const count=state.players.map(()=>0);
  const stars=state.players.map(()=>0);
  let total=0;
  for (const cell of cells) if (cell) {
    total+=cell.stars;
    if (!cell.rock) {
      count[cell.owner]++;
      stars[cell.owner]+=cell.stars;
    }
  }
  const awards=state.players.length===2
    ? (total<=3?[2,0]:total<=6?[4,1]:[6,2])
    : (total<=5?[2,1,0]:total<=9?[3,2,1]:[5,3,2]);
  const vp=stars.map(value=>value===0?0:awards[stars.filter(other=>other>value).length]??0);
  return {count,stars,total,vp,awards};
}
export function mineRows(state) {
  return Array.from({length:MINE_ROWS},(_,row)=>mineRow(state,row));
}
export function patricianBase(state, seat, rows=mineRows(state)) {
  const p=state.players[seat];
  const {neighbours}=rulesFor(state).board;
  let green=0;
  for (const [i,cell] of state.city.entries()) if (cell?.owner===seat) {
    green+=neighbours[i].filter(i=>state.city[i]?.id && state.city[i].owner===null).length;
  }
  const yellow=2*Math.min(2,...rows.map(row=>row.count[seat]));
  return {green,silver:Math.floor(p.usedPelicans/2)*3,yellow,red:3*Math.min(...p.houses)};
}
export function patricianPoints(state, seat) {
  const base=patricianBase(state,seat);
  return PATRICIANS.reduce((sum,color)=>sum+base[color]*state.council[color],0);
}
export function scoreBreakdown(state, seat, rows=mineRows(state)) {
  const p=state.players[seat];
  const parts={
    earned:p.vp,
    town:state.city.reduce((total,cell,i)=>total+(cell?.owner===seat?cityPointsAt(state,i):0),0),
    mines:rows.reduce((total,row)=>total+row.vp[seat],0),
    income:Math.floor(income(state,seat)/10),
    reputation:REP_SCORE[p.rep]??0,
    extras:p.held.length+plotCount(state,seat)+p.pelicans,
  };
  return {...parts,total:Object.values(parts).reduce((sum,n)=>sum+n,0),coins:p.coins};
}

export function finalResult(state) {
  const rows=mineRows(state);
  const scores=state.players.map((_,seat)=>scoreBreakdown(state,seat,rows));
  const best=scores.reduce((a,b)=>b.total>a.total||(b.total===a.total&&b.coins>a.coins)?b:a);
  const winners=scores.flatMap((score,seat)=>score.total===best.total&&score.coins===best.coins?[seat]:[]);
  return {scores,winner:winners.length===1?winners[0]:null,winners};
}

function resolveEvent(state) {
  const id=state.events[state.round-1];
  const event=EVENTS[id];
  if (!event) return;
  advanceDemand(state,'pop',event.pop);
  advanceDemand(state,'ore',event.ore);
  switch(id) {
    case 'abbey':
      for (const row of state.market) for (const stack of row) if (GOODS.includes(stack.group) && stack.tiles.length>1) stack.tiles.push(stack.tiles.shift());
      break;
    case 'fever':
      for (const p of state.players) fillPool(p,Math.min(p.reserve,2-p.pool));
      break;
    case 'siege':
      for (const row of state.market) {
        const index=row.findIndex(stack=>['green','civicSilver','yellow'].includes(stack.group));
        if (index<0) continue;
        const [tile]=row[index].tiles.splice(0,1);
        state.marketDiscard.push(tile);
        if (!row[index].tiles.length) row.splice(index,1);
      }
      break;
    case 'code': {
      // Discard from the current stack. A later Mine draw triggers recycling.
      const discarded=state.mineDeck.splice(0,5);
      state.mineDiscard.push(...discarded);
      const count=discarded.length;
      log(state,null,`${event.name} discarded ${count} mine ${count===1?'tile':'tiles'}.`);
      return;
    }
    case 'cathedral': for (const p of state.players) p.pelicans++; break;
    case 'michal':
      for (const row of state.market) if (row.length) {
        state.marketDiscard.push(row[0].tiles.shift());
        if (!row[0].tiles.length) row.shift();
      }
      break;
    case 'groschen': bypassBarbara(state); break;
    case 'abbot': for (const row of state.market) if (row.length>1) row.push(row.shift()); break;
  }
  log(state,null,`${event.name} resolved.`);
}
function beginRound(state) {
  state.actor=state.starter;
  state.turn=0;
  state.left=CARDS_PER_TURN[0];
  state.phase='action';
  for (const p of state.players) p.hand=UNPLAYED;
  const event=eventNow(state);
  if (event) addTax(state,event.tax);
  log(state,null,`Round ${state.round} begins${event?` · ${event.name}`:''}.`);
}
function finishRound(state) {
  const {rounds,redRound}=rulesFor(state);
  if (state.round>redRound) {
    for (const [seat,player] of state.players.entries()) {
      const points=patricianPoints(state,seat);
      player.vp+=points;
      if (points) log(state,seat,`Scored ${points} VP from the town council.`);
    }
  }
  if (state.round===rounds) {
    state.result=finalResult(state);
    state.phase='end';
    return;
  }
  if (state.round===redRound) for (const [i,id] of state.red.entries()) state.market[i].push({group:id,tiles:[id]});
  state.round++;
  state.starter=(state.starter+1)%state.players.length;
  beginRound(state);
}
export function finishCard(state) {
  if (state.pending.length || state.left>0) return;
  state.turn++;
  if (state.turn===turnsPerRound(state)) {
    state.actor=state.starter;
    resolveEvent(state);
    if (state.events[state.round-1]==='rush' || state.players.every((_,seat)=>taxCost(state,seat)===0)) finishRound(state);
    else {
      state.phase='tax';
      state.taxIndex=0;
    }
    return;
  }
  state.actor=seatAtTurn(state,state.turn);
  state.left=cardsThisTurn(state);
}
function resolveTax(state, action) {
  const p=state.players[state.actor];
  if (action.kind==='tax') {
    pay(p,action.cost);
    log(state,state.actor,`Paid ${action.cost} g in taxes.`);
  } else {
    changeRep(p,-action.loss);
    log(state,state.actor,`Accepted −${action.loss} reputation in lieu of tax.`);
  }
  if (state.taxIndex<state.players.length-1) {
    state.taxIndex++;
    state.actor=seatAtTurn(state,state.taxIndex);
  } else finishRound(state);
}

export function applyKnownAction(state, action, planning=false) {
  if (state.phase==='tax') {
    resolveTax(state,action);
    return;
  }
  if (state.pending.length) resolvePending(state,action);
  else {
    const p=state.players[state.actor];
    p.hand &= ~(1<<action.card);
    state.left--;
    if (action.as && p.rep<6) changeRep(p,-1);
    if (action.as) log(state,state.actor,`Used the Joker for ${LABEL[action.as]}.`);
    if (action.kind==='skip') log(state,state.actor,`Spent the ${CARDS[action.card].map(kind=>LABEL[kind]).join(' / ')} card with no effect.`);
    basicEffect(state,action);
  }
  if (!planning) finishCard(state);
}

export function transition(state, requested) {
  const action=legalActions(state).find(value=>EFFECT_ID(value)===EFFECT_ID(requested));
  if (!action) throw Error('That choice is no longer available.');
  const next=copyState(state);
  applyKnownAction(next,action);
  return next;
}
