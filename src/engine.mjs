import {
  BARBARA_TAX, BUILDINGS, BUILDING_GROUPS, CARDS, CITY, CITY_EDGE, COMMODITY,
  EVENTS, GOODS, GUILD_SETUPS, HOUSE_EFFECTS, LABEL, MINE_ENTRANCES, MINE_GROUPS,
  MINES, PATRICIANS, REP_LOSS, REP_SCORE, ROCK_LAYOUTS, ROCK_STARS, SAVE_SCHEMA, SETUP_VERSION,
  TECHNOLOGY, TURN_CARD_COUNTS,
} from './data.mjs';
import {BUILD_DEMAND, CITY_BUILDS, PRICES} from './prices.mjs';
import {randomIndex,shuffle} from './random.mjs';

export const SEATS = ['You','Rival'];
const UNPLAYED = (1 << CARDS.length) - 1;
const FROM_POPULATION = ['wood','food','beer'];
const FROM_ORE = ['silver','permit'];
const EFFECT_ID = action => JSON.stringify([action.kind,action.id,action.space,action.refill,action.color,action.card,action.as]);
export const coordinate = (space, columns) => `${'ABCDEF'[space%columns]}${1+Math.floor(space/columns)}`;
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

function player(guilds, coins) {
  return {
    guilds:[...guilds], coins, vp:0, rep:0, production:commodityRecord(),
    houses:[0,0,0], held:[], pool:1, reserve:8, pelicans:0, usedPelicans:0, hand:UNPLAYED,
  };
}

export function createGame(options = {}) {
  const seed = String(options.seed ?? 'silver-1308').trim().slice(0,64) || 'silver-1308';
  const setup = Object.hasOwn(GUILD_SETUPS,options.setup) ? Number(options.setup) : 1;
  const side = options.side===1 ? 1 : 0;
  const starter = options.starter===1 ? 1 : 0;
  const state = {
    schema:SAVE_SCHEMA, setupVersion:SETUP_VERSION, seed, rng:seedNumber(seed),
    setup, side, starter, round:1, turn:0, left:TURN_CARD_COUNTS[0],
    actor:starter, phase:'action', pending:[], difficulty:options.difficulty==='quick'?'quick':'standard',
    players:GUILD_SETUPS[setup].map((_,i) => {
      const printed = GUILD_SETUPS[setup][i===0?side:1-side];
      const order = options.orders?.[i];
      const guilds = order?.length===3 && new Set(order).size===3 && order.every(key=>printed.includes(key)) ? order : printed;
      return player(guilds, i===starter?40:41);
    }),
    city:empty(CITY.length), mine:empty(20), market:[], marketDiscard:[],
    mineDeck:[], mineDiscard:[], mineMixed:false, technology:0, red:[], events:[],
    pop:0, ore:0, arms:commodityRecord(), tax:0, barbara:1,
    bank:tokenRecord(3), patrons:tokenRecord(0), council:tokenRecord(0),
    log:[], result:null, mineLayout:0,
  };
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
  state.mineLayout = randomIndex(state,ROCK_LAYOUTS.length);
  if (Number.isInteger(options.mineLayout) && ROCK_LAYOUTS[options.mineLayout]) state.mineLayout=options.mineLayout;
  const rocks = shuffle(state,ROCK_STARS);
  for (const [i,space] of ROCK_LAYOUTS[state.mineLayout].entries()) state.mine[space]={rock:true,stars:rocks[i]};
  state.mineDeck = MINE_GROUPS.flatMap(group=>shuffle(state,group.map(tile=>tile.id)));
  const pool = key => Object.keys(EVENTS).filter(id=>EVENTS[id].set===key);
  state.events = [...shuffle(state,pool('A')).slice(0,3),...shuffle(state,pool('B')).slice(0,2)];
  beginRound(state);
  return state;
}

export function copyState(state, keepLog = true) {
  return {
    ...state,
    players:state.players.map(p=>({...p,production:{...p.production},houses:[...p.houses],held:[...p.held]})),
    city:[...state.city], mine:[...state.mine], pending:state.pending.map(item=>({...item,drawn:item.drawn && [...item.drawn]})),
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
function changeRep(player, amount) {
  const intended = player.rep+amount;
  player.rep = Math.min(9,Math.max(-5,intended));
  player.vp += (intended-player.rep)*2;
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

function townNeighbours(space) {
  const row = Math.floor(space/6);
  const col = space%6;
  return [row>0?space-6:-1,row<4?space+6:-1,col>0?space-1:-1,col<5?space+1:-1].filter(i=>CITY[i]);
}
export const TOWN_NEIGHBOURS = CITY.map((open,space)=>open?townNeighbours(space):[]);
export function plotSpaces(state, seat, free=false, rep=state.players[seat].rep) {
  if (plotCount(state,seat)>=3) return [];
  const open = CITY.flatMap((active,space)=>active && !state.city[space] ? [space] : []);
  const adjacent = open.map(space=>{
    const costs=TOWN_NEIGHBOURS[space].flatMap(i=>state.city[i]?.id?[BUILDINGS[state.city[i].id].plot]:[]);
    return {space,cost:costs.length?Math.max(...costs):null};
  });
  const mustTouch = !free && adjacent.some(item=>item.cost!==null);
  return adjacent.filter(item=>!mustTouch || item.cost!==null).map(item=>({
    space:item.space,cost:free?0:rep>=3?1:item.cost??5,
  }));
}

export function mineSpaces(state) {
  const result=[];
  for (let space=0;space<state.mine.length;space++) {
    if (state.mine[space]) continue;
    const col=space%5;
    if (MINE_ENTRANCES.includes(space)) {
      result.push({space,wood:2});
      continue;
    }
    const adjacent=[col>0?space-1:-1,col<4?space+1:-1,space-5];
    const costs=adjacent.flatMap(i=>state.mine[i]?.id?[MINES[state.mine[i].id].extend]:[]);
    if (costs.length) result.push({space,wood:Math.max(...costs)});
  }
  return result;
}
export const plotCount = (state,seat) => state.city.filter(cell=>cell?.plot===seat).length;

function rightsChoices(state, seat, settings={}) {
  const p = state.players[seat];
  if (p.held.length>=3) return [];
  return marketOffer(state).flatMap(offer=>{
    const tile=BUILDINGS[offer.id];
    const cost=settings.free?0:offer.cost;
    return (tile.public || (!settings.publicOnly && p.guilds.includes(tile.group))) && p.coins>=cost ? [{kind:'rights',id:tile.id,cost}] : [];
  });
}
function buildingChoices(state, seat, free=false) {
  const p=state.players[seat];
  const plots=state.city.flatMap((cell,space)=>cell?.plot===seat?[space]:[]);
  return p.held.flatMap(id=>{
    const tile=BUILDINGS[id];
    const cost=free?0:tile.wood*price(state,'wood');
    const row=p.guilds.indexOf(tile.group);
    if (p.coins<cost || (!tile.public && (row<0 || p.houses[row]>=4 || !canBuildGuild(state,tile.group)))) return [];
    return plots.map(space=>({kind:'build',id,space,cost}));
  });
}
function incomeChoices(state, seat) {
  const gross=income(state,seat);
  const choices=[{kind:'income',gross}];
  if (state.players[seat].coins+gross>=10) {
    for (const color of PATRICIANS) if (state.patrons[color]>0) choices.push({kind:'income',gross,color,cost:10});
  }
  return choices;
}
function mineStartChoices(state, seat, free) {
  const p=state.players[seat];
  if (p.pool+p.reserve===0 || state.mineDeck.length+state.mineDiscard.length===0) return [];
  if (free) return [{kind:'mine',refill:0,cost:0}];
  const fee = price(state,'permit');
  const choices=p.pool>0?[{kind:'mine',refill:0,cost:0}]:[];
  if (p.coins>=fee) {
    for (let refill=1;refill<=Math.min(p.reserve,2-p.pool);refill++) choices.push({kind:'mine',refill,cost:fee});
  }
  return choices;
}
function basicChoices(state, seat, kind, settings={}) {
  switch(kind) {
    case 'rights': return rightsChoices(state,seat,settings);
    case 'plot': return plotSpaces(state,seat,settings.free,settings.rep).filter(move=>move.cost<=state.players[seat].coins).map(move=>({kind,...move}));
    case 'build': return buildingChoices(state,seat,settings.free);
    case 'income': return incomeChoices(state,seat);
    case 'mine': return mineStartChoices(state,seat,settings.free);
    case 'barbara': return state.players[seat].pelicans>0?[{kind}]:[];
    default: return [];
  }
}

function pendingChoices(state, pending) {
  const seat=state.actor;
  const p=state.players[seat];
  const skip={kind:'skip'};
  switch(pending.kind) {
    case 'right': return [...rightsChoices(state,seat,{free:true,publicOnly:pending.publicOnly}),skip];
    case 'plot': return [...basicChoices(state,seat,'plot',{free:true}),skip];
    case 'build': return [...buildingChoices(state,seat,true),skip];
    case 'income': return [...incomeChoices(state,seat),skip];
    case 'mine': return [...mineStartChoices(state,seat,true),skip];
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
    return [...(p.coins>=cost?[{kind:'tax',cost}]:[]),{kind:'penalty',loss:REP_LOSS[state.round]}];
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
  log(state,seat,`Placed ${tile.name} at mine ${coordinate(action.space,5)} for ${action.cost} g.`);
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
  log(state,seat,`Built ${tile.name} at town ${coordinate(action.space,6)} for ${action.cost} g.`);
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
      log(state,seat,`Claimed town ${coordinate(action.space,6)} for ${action.cost} g.`);
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
  return matchingDots(dots,CITY_EDGE[space]??'')+TOWN_NEIGHBOURS[space].reduce((sum,i)=>{
    const id=state.city[i]?.id;
    return sum+(id?matchingDots(dots,BUILDINGS[id].dots):0);
  },0);
}
export function mineRow(state, row) {
  const cells=state.mine.slice(row*5,row*5+5);
  const count=[0,0];
  const stars=[0,0];
  let total=0;
  for (const cell of cells) if (cell) {
    total+=cell.stars;
    if (!cell.rock) {
      count[cell.owner]++;
      stars[cell.owner]+=cell.stars;
    }
  }
  const awards=total<=3?[2,0]:total<=6?[4,1]:[6,2];
  const vp=stars.map((value,seat)=>value===0?0:awards[Number(value<stars[1-seat])]);
  return {count,stars,total,vp,awards};
}
export function patricianBase(state, seat) {
  const p=state.players[seat];
  let green=0;
  for (const [i,cell] of state.city.entries()) if (cell?.owner===seat) {
    green+=TOWN_NEIGHBOURS[i].filter(i=>state.city[i]?.id && state.city[i].owner===null).length;
  }
  const yellow=2*Math.min(2,...[0,1,2,3].map(row=>mineRow(state,row).count[seat]));
  return {green,silver:Math.floor(p.usedPelicans/2)*3,yellow,red:3*Math.min(...p.houses)};
}
export function patricianPoints(state, seat) {
  const base=patricianBase(state,seat);
  return PATRICIANS.reduce((sum,color)=>sum+base[color]*state.council[color],0);
}
export function scoreBreakdown(state, seat) {
  const p=state.players[seat];
  const parts={
    earned:p.vp,
    town:state.city.reduce((total,cell,i)=>total+(cell?.owner===seat?cityPointsAt(state,i):0),0),
    mines:[0,1,2,3].reduce((total,row)=>total+mineRow(state,row).vp[seat],0),
    income:Math.floor(income(state,seat)/10),
    reputation:REP_SCORE[p.rep]??0,
    extras:p.held.length+plotCount(state,seat)+p.pelicans,
  };
  return {...parts,total:Object.values(parts).reduce((sum,n)=>sum+n,0),coins:p.coins};
}

export function finalResult(state) {
  const scores=[scoreBreakdown(state,0),scoreBreakdown(state,1)];
  const difference=scores[0].total-scores[1].total || scores[0].coins-scores[1].coins;
  return {scores,winner:difference===0?null:difference>0?0:1};
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
      const discarded=state.mineDeck.splice(0,5);
      state.mineDiscard.push(...discarded);
      break;
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
  state.left=TURN_CARD_COUNTS[0];
  state.phase='action';
  for (const p of state.players) p.hand=UNPLAYED;
  const event=eventNow(state);
  if (event) addTax(state,event.tax);
  log(state,null,`Round ${state.round} begins${event?` · ${event.name}`:''}.`);
}
function finishRound(state) {
  if (state.round>=4) {
    for (let seat=0;seat<2;seat++) {
      const points=patricianPoints(state,seat);
      state.players[seat].vp+=points;
      if (points) log(state,seat,`Scored ${points} VP from the town council.`);
    }
  }
  if (state.round===6) {
    state.result=finalResult(state);
    state.phase='end';
    return;
  }
  if (state.round===3) for (const [i,id] of state.red.entries()) state.market[i].push({group:id,tiles:[id]});
  state.round++;
  state.starter=1-state.starter;
  beginRound(state);
}
function finishCard(state) {
  if (state.pending.length || state.left>0) return;
  state.turn++;
  if (state.turn===TURN_CARD_COUNTS.length) {
    state.actor=state.starter;
    resolveEvent(state);
    if (state.events[state.round-1]==='rush' || [0,1].every(seat=>taxCost(state,seat)===0)) finishRound(state);
    else {
      state.phase='tax';
      state.taxIndex=0;
    }
    return;
  }
  state.actor=1-state.actor;
  state.left=TURN_CARD_COUNTS[state.turn];
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
  if (state.taxIndex===0) {
    state.taxIndex=1;
    state.actor=1-state.actor;
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
