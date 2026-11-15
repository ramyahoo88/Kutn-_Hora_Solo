import {
  BUILDINGS,CARDS,EVENTS,GOODS,GUILD_SETUPS_BY_COUNT,MINE_GROUPS,MINE_ROWS,MINES,PATRICIANS,
  SAVE_SCHEMA,SETUP_VERSION,TECHNOLOGY,
} from './data.mjs';
import {cardsThisTurn,finalResult,legalActions,plotCount,rulesFor,seatAtTurn,turnsPerRound} from './engine.mjs';

export const SAVE_KIND = 'kutna-hora-solo';
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const array=(items,n)=>Array.isArray(items)&&items.length===n;
const known=(table,id)=>typeof id==='string'&&Object.hasOwn(table,id);
const tally=(record,keys,max)=>record&&keys.every(key=>integer(record[key],0,max));
const regularMine=id=>known(MINES,id)&&MINES[id].tier!==undefined;

function validTurn(s) {
  const played = s.players.map(()=>0);
  const turnCount=turnsPerRound(s);
  for (let turn=0; turn<s.turn; turn++) {
    played[seatAtTurn(s,turn)] += cardsThisTurn(s,turn);
  }
  if (s.phase==='action') {
    if (s.turn===turnCount || s.actor!==seatAtTurn(s,s.turn)) return false;
    const used = cardsThisTurn(s)-s.left;
    const resolving = s.pending.length>0;
    if (used<0 || (resolving ? used===0 : s.left===0)) return false;
    played[s.actor] += used;
  } else {
    if (s.turn!==turnCount || s.left!==0 || s.pending.length) return false;
    if (s.phase==='tax' && s.actor!==seatAtTurn(s,s.taxIndex)) return false;
    if (s.phase==='end' && s.round!==rulesFor(s).rounds) return false;
  }
  return s.players.every((p,seat)=>CARDS.filter((_,card)=>!(p.hand&(1<<card))).length===played[seat]);
}

export function checkGame(s) {
  const ok=(value,message)=>{if (!value) throw Error(`Save has an invalid ${message}.`);};
  ok(s?.schema===SAVE_SCHEMA&&integer(s.setupVersion,1,SETUP_VERSION)&&
    typeof s.seed==='string'&&s.seed.length<=64&&integer(s.rng,0,0xffffffff),'format');
  ok(Array.isArray(s.players)&&integer(s.players.length,2,4),'player list');
  const count=s.players.length;
  const {board,rounds,redRound}=rulesFor(s);
  const guildSets=GUILD_SETUPS_BY_COUNT[count][s.setup];
  ok(Object.hasOwn(GUILD_SETUPS_BY_COUNT[count],s.setup)&&integer(s.side,0,count-1)&&
    integer(s.mineLayout,0,board.rockLayouts.length-1),'setup');
  ok(['standard','quick'].includes(s.difficulty),'rival setting');
  ok(integer(s.round,1,rounds)&&integer(s.starter,0,count-1)&&integer(s.actor,0,count-1)&&
    integer(s.turn,0,turnsPerRound(s))&&integer(s.left,0,2),'turn');
  ok(['action','tax','end'].includes(s.phase)&&Array.isArray(s.pending)&&s.pending.length<=4,'phase');
  ok(s.phase!=='tax'||integer(s.taxIndex,0,count-1),'tax order');
  const assigned=new Set();
  for (const [seat,p] of s.players.entries()) {
    ok(p&&integer(p.coins,0,99999)&&integer(p.vp,-99999,99999)&&integer(p.rep,-5,9),'player total');
    ok(array(p.guilds,3)&&new Set(p.guilds).size===3,'guild rows');
    const set=guildSets.findIndex(guilds=>p.guilds.every(id=>guilds.includes(id)));
    ok(set>=0&&!assigned.has(set)&&(seat!==0||set===s.side),'guild sets');
    assigned.add(set);
    ok(array(p.houses,3)&&p.houses.every(n=>integer(n,0,4))&&tally(p.production,GOODS,999),'player board');
    ok(Array.isArray(p.held)&&p.held.length<=3&&p.held.every(id=>known(BUILDINGS,id)),'held rights');
    ok(integer(p.hand,0,63)&&integer(p.pool,0,2)&&integer(p.reserve,0,8)&&integer(p.pelicans,0,99)&&integer(p.usedPelicans,0,99),'piece supply');
  }
  ok(validTurn(s),'turn and action-card count');
  ok(array(s.city,board.town.length)&&s.city.every((cell,i)=>cell===null||board.town[i]&&cell&&(
    cell.id ? known(BUILDINGS,cell.id)&&(BUILDINGS[cell.id].public?cell.owner===null:integer(cell.owner,0,count-1)) : integer(cell.plot,0,count-1)
  )),'town board');
  ok(array(s.mine,MINE_ROWS*board.mineWidth)&&s.mine.every((cell,i)=>{
    const rock=board.rockLayouts[s.mineLayout].includes(i);
    if (rock) return cell?.rock===true&&integer(cell.stars,0,2);
    return cell===null||cell&&!cell.rock&&known(MINES,cell.id)&&cell.stars===MINES[cell.id].stars&&integer(cell.owner,0,count-1);
  }),'mine board');
  ok(s.mine.filter(cell=>cell?.rock).map(cell=>cell.stars).sort().join(',')==='0,1,1,2','rock stars');
  ok(s.players.every((p,seat)=>plotCount(s,seat)<=3&&p.pool+p.reserve+s.mine.filter(cell=>cell?.owner===seat).length===9),'miner or plot count');
  ok(array(s.market,3)&&s.market.every(row=>Array.isArray(row)&&row.length<=4&&row.every(stack=>{
    return typeof stack?.group==='string'&&Array.isArray(stack.tiles)&&stack.tiles.length>0&&stack.tiles.every(id=>known(BUILDINGS,id));
  })),'market');
  ok(Array.isArray(s.marketDiscard)&&s.marketDiscard.every(id=>known(BUILDINGS,id))&&array(s.red,3)&&s.red.every(id=>BUILDINGS[id]?.group==='red'),'building discard');
  const buildings=[...s.market.flatMap(row=>row.flatMap(stack=>stack.tiles)),...s.marketDiscard,...s.players.flatMap(p=>p.held),
    ...s.city.flatMap(cell=>cell?.id?[cell.id]:[]),...(s.round<=redRound?s.red:[])];
  ok(buildings.length===Object.keys(BUILDINGS).length&&new Set(buildings).size===buildings.length,'building supply');
  const eventsOff=count>2&&array(s.events,0);
  ok(eventsOff||array(s.events,rounds-1)&&new Set(s.events).size===rounds-1&&
    s.events.every((id,i)=>known(EVENTS,id)&&EVENTS[id].set===(i<redRound?'A':'B')),'event order');
  ok(integer(s.pop,0,40)&&integer(s.ore,0,30)&&tally(s.arms,GOODS,4)&&integer(s.tax,0,25)&&integer(s.barbara,1,12),'shared tracks');
  ok(tally(s.bank,PATRICIANS,3)&&tally(s.patrons,PATRICIANS,3)&&tally(s.council,PATRICIANS,3)&&
    PATRICIANS.every(id=>s.bank[id]+s.patrons[id]+s.council[id]===3),'council supply');
  ok(integer(s.technology,0,TECHNOLOGY.length)&&typeof s.mineMixed==='boolean','technology');
  ok(Array.isArray(s.mineDeck)&&Array.isArray(s.mineDiscard)&&s.mineDeck.every(regularMine)&&s.mineDiscard.every(regularMine),'mine deck');
  const pendingKinds=['mine-place','technology','right','house','patrician','score-building','plot','build','income','mine'];
  ok(s.pending.every(item=>{
    if (!pendingKinds.includes(item?.kind)) return false;
    if (item.kind==='mine-place') {
      const p=s.players[s.actor];
      return typeof item.free==='boolean' && (item.free?p.reserve+p.pool:p.pool)>0 &&
        Array.isArray(item.drawn) && integer(item.drawn.length,1,s.technology+1) && item.drawn.every(regularMine);
    }
    if (item.drawn!==undefined) return false;
    if (item.kind==='technology') return item.id!==undefined && item.id===TECHNOLOGY[s.technology-1]?.id;
    if (item.kind==='build') return item.barbaraTile===8 && s.barbara===8;
    return true;
  }),'pending choice');
  const mines=[...s.mineDeck,...s.mineDiscard,...s.pending.flatMap(item=>item.drawn??[]),...s.mine.flatMap(cell=>regularMine(cell?.id)?[cell.id]:[])];
  ok(mines.length===MINE_GROUPS.flat().length&&new Set(mines).size===mines.length,'mine stock');
  const technologyTiles=[...s.mine.filter(cell=>cell?.id&&!regularMine(cell.id)).map(cell=>cell.id),
    ...s.pending.filter(item=>item.kind==='technology').map(item=>item.id)];
  const availableTechnology=TECHNOLOGY.slice(0,s.technology).map(tile=>tile.id);
  ok(new Set(technologyTiles).size===technologyTiles.length&&technologyTiles.every(id=>availableTechnology.includes(id)),'technology stock');
  ok(Array.isArray(s.log)&&s.log.length<=1500&&s.log.every(row=>row&&integer(row.round,1,rounds)&&(row.actor===null||integer(row.actor,0,count-1))&&typeof row.text==='string'&&row.text.length<=500),'journal');
  ok(s.phase==='end' ? array(s.result?.scores,count)&&(s.result.winner===null||integer(s.result.winner,0,count-1))&&s.result.scores.every(score=>
    score&&['earned','town','mines','income','reputation','extras','total','coins'].every(key=>integer(score[key],-99999,99999))
  ) : s.result===null,'final result');
  ok(s.phase==='end'||legalActions(s).length>0,'legal continuation');
  return s;
}

function migrateSave(s) {
  if (s?.schema===2) return {...s,schema:SAVE_SCHEMA};
  if (s?.schema!==1) return s;
  // Preserve the revealed board and shuffled stacks. The saved RNG word can
  // seed the corrected generator the next time a shuffle is needed.
  if (Array.isArray(s.mine)) {
    for (const cell of s.mine) {
      if (cell?.id==='m3-3' && cell.stars===0) cell.stars=MINES['m3-3'].stars;
    }
  }
  return {...s,schema:SAVE_SCHEMA,setupVersion:1};
}

export function readSave(text) {
  const game=JSON.parse(text);
  if (game?.kind!==SAVE_KIND) throw Error('Choose a Kutná Hora Solo JSON save.');
  const state=checkGame(migrateSave(game.state));
  if (state.phase==='end') state.result=finalResult(state);
  return state;
}
export const writeSave=state=>JSON.stringify({kind:SAVE_KIND,state});
