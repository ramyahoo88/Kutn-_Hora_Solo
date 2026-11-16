import {
  BUILDINGS,CARDS,EVENTS,GOODS,GUILD_SETUPS_BY_COUNT,MINCMISTR_LEVELS,MINCMISTR_PLANS,MINCMISTR_RULES_VERSION,
  MINE_GROUPS,MINE_ROWS,MINES,PATRICIANS,PLAN_EXPLANATION_LIMIT,RIVAL_SETTINGS,SAVE_SCHEMA,SETUP_VERSION,TECHNOLOGY,VERSION,
} from './data.mjs';
import {cardsThisTurn,finalResult,legalActions,physicalPrompt,plotCount,rulesFor,seatAtTurn,turnsPerRound,undrawnMines,usesEvents,validPlanDeck} from './engine.mjs';

export const SAVE_KIND = 'kutna-hora-solo';
export const AUTOSAVE_UNDO_LIMIT = 5;
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const array=(items,n)=>Array.isArray(items)&&items.length===n;
const known=(table,id)=>typeof id==='string'&&Object.hasOwn(table,id);
const tally=(record,keys,max)=>record&&keys.every(key=>integer(record[key],0,max));
const regularMine=id=>known(MINES,id)&&MINES[id].tier!==undefined;
const shortText=(text,max)=>typeof text==='string'&&text.length<=max;
const textList=(values,count,length)=>Array.isArray(values)&&values.length<=count&&values.every(value=>shortText(value,length));
const validExplanation=value=>value===undefined||
  Array.isArray(value)&&value.length<=PLAN_EXPLANATION_LIMIT&&value.every(step=>
    shortText(step?.rule,4)&&/^\d{1,2}(?:\.\d)?$/.test(step.rule)&&shortText(step.text,300));

function validMincmistr(s, count) {
  const m=s.mincmistr;
  if (s.difficulty!=='mincmistr') return m===undefined;
  if (!m || !known(MINCMISTR_LEVELS,m.level) || typeof m.shared!=='boolean' || typeof m.tougher!=='boolean') return false;
  if (m.tougher && (count!==3 || m.level!=='master')) return false;
  const countPlans=MINCMISTR_PLANS.length;
  const plan=id=>integer(id,0,countPlans-1);
  if (!array(m.lastPlans,count-1) || !m.lastPlans.every(id=>id===null || plan(id))) return false;
  if (s.phase==='action' && s.actor>0 && s.pending.length && m.lastPlans[s.actor-1]===null) return false;
  if (!array(m.decks,m.shared?1:count-1)) return false;
  return m.decks.every(validPlanDeck);
}

function validTurn(s) {
  const played = s.players.map(()=>0);
  const turnCount=turnsPerRound(s);
  for (let turn=0; turn<s.turn; turn++) {
    played[seatAtTurn(s,turn)] += cardsThisTurn(s,turn);
  }
  if (s.phase==='event') {
    if (s.turn!==0 || s.actor!==s.starter || s.left!==cardsThisTurn(s) || s.pending.length) return false;
  } else if (s.phase==='action') {
    if (s.turn===turnCount || s.actor!==seatAtTurn(s,s.turn)) return false;
    const used = cardsThisTurn(s)-s.left;
    const resolving = s.pending.length>0;
    if (used<0 || (resolving ? used===0 : s.left===0)) return false;
    played[s.actor] += used;
  } else {
    if (s.turn!==turnCount || s.left!==0 || s.pending.length) return false;
    if (s.phase==='tax' && s.actor!==seatAtTurn(s,s.taxIndex)) return false;
    if (s.phase==='mine-discard' && s.actor!==s.starter) return false;
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
  ok(RIVAL_SETTINGS.includes(s.difficulty),'rival setting');
  ok(integer(s.round,1,rounds)&&integer(s.starter,0,count-1)&&integer(s.actor,0,count-1)&&
    integer(s.turn,0,turnsPerRound(s))&&integer(s.left,0,2),'turn');
  const tabletop=s.tabletop;
  ok(tabletop===undefined||tabletop&&typeof tabletop.events==='boolean'&&(count>2||tabletop.events)&&
    array(tabletop.unseenDiscards,MINE_GROUPS.length)&&tabletop.unseenDiscards.every(n=>integer(n,0,27)),'physical draw settings');
  const phases=['action','tax','end',...(tabletop?['event','mine-discard']:[])];
  ok(phases.includes(s.phase)&&Array.isArray(s.pending)&&s.pending.length<=4,'phase');
  ok(s.phase!=='tax'||integer(s.taxIndex,0,count-1),'tax order');
  ok(validMincmistr(s,count),'Mincmistr settings or Plan deck');
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
  const reveals=Math.min(s.round-Number(s.phase==='event'),rounds-1);
  const eventCount=tabletop?(tabletop.events?reveals:0):rounds-1;
  const eventsOff=!tabletop&&count>2&&array(s.events,0);
  ok(eventsOff||array(s.events,eventCount)&&new Set(s.events).size===eventCount&&
    s.events.every((id,i)=>known(EVENTS,id)&&EVENTS[id].set===(i<redRound?'A':'B')),'event order');
  ok(s.phase!=='event'||tabletop.events&&s.round<rounds,'event reveal');
  ok(integer(s.pop,0,40)&&integer(s.ore,0,30)&&tally(s.arms,GOODS,4)&&integer(s.tax,0,25)&&integer(s.barbara,1,12),'shared tracks');
  ok(tally(s.bank,PATRICIANS,3)&&tally(s.patrons,PATRICIANS,3)&&tally(s.council,PATRICIANS,3)&&
    PATRICIANS.every(id=>s.bank[id]+s.patrons[id]+s.council[id]===3),'council supply');
  ok(integer(s.technology,0,TECHNOLOGY.length)&&typeof s.mineMixed==='boolean','technology');
  ok(Array.isArray(s.mineDeck)&&Array.isArray(s.mineDiscard)&&s.mineDeck.every(regularMine)&&s.mineDiscard.every(regularMine),'mine deck');
  if (tabletop) {
    ok(undrawnMines(s)>=0&&(s.mineMixed?tabletop.unseenDiscards.slice(1).every(n=>n===0):
      tabletop.unseenDiscards.every((n,i)=>n<=s.mineDeck.filter(id=>MINES[id].tier===i+1).length)),'physical mine discards');
    ok(s.phase!=='mine-discard'||s.events[s.round-1]==='code'&&undrawnMines(s)>0,'mine discard prompt');
  }
  const pendingKinds=['mine-place','technology','right','house','patrician','score-building','plot','build','income','mine'];
  ok(s.pending.every((item,index)=>{
    if (item?.kind==='mine-draw') {
      const p=s.players[s.actor];
      return tabletop&&index===0&&typeof item.free==='boolean'&&(item.free?p.reserve+p.pool:p.pool)>0&&
        s.mineDeck.length+s.mineDiscard.length>0&&item.drawn===undefined;
    }
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
  ok(Array.isArray(s.log)&&s.log.length<=1500&&s.log.every(row=>row&&integer(row.round,1,rounds)&&
    (row.actor===null||integer(row.actor,0,count-1))&&shortText(row.text,500)&&
    (row.rule===undefined||shortText(row.rule,120))&&validExplanation(row.explanation)),'journal');
  ok(s.phase==='end' ? array(s.result?.scores,count)&&(s.result.winner===null||integer(s.result.winner,0,count-1))&&s.result.scores.every(score=>
    score&&['earned','town','mines','income','reputation','extras','total','coins'].every(key=>integer(score[key],-99999,99999))
  ) : s.result===null,'final result');
  ok(s.phase==='end'||physicalPrompt(s)||legalActions(s).length>0,'legal continuation');
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

function savedState(value) {
  const state=checkGame(migrateSave(value));
  if (state.phase==='end') state.result=finalResult(state);
  return state;
}

function saveRecord(text) {
  const game=JSON.parse(text);
  if (game?.kind!==SAVE_KIND) throw Error('Choose a Kutná Hora Solo JSON save.');
  return game;
}

export function readSave(text) {
  return savedState(saveRecord(text).state);
}
export const writeSave=state=>JSON.stringify({kind:SAVE_KIND,state});

function validPlanChanges(changes,state) {
  const spaces=(values,max)=>Array.isArray(values)&&values.length<=max&&new Set(values).size===values.length&&
    values.every(index=>integer(index,0,max-1));
  const {board}=rulesFor(state);
  return spaces(changes?.town,state.city.length)&&changes.town.every(i=>board.town[i])&&
    spaces(changes.mine,state.mine.length)&&textList(changes.summary,32,200);
}

function startingSeat(state) {
  const count=state.players.length;
  return (state.starter-(state.round-1)%count+count)%count;
}

function isPriorPosition(before,state) {
  if (!before || before.seed!==state.seed || before.setup!==state.setup || before.side!==state.side ||
      before.difficulty!==state.difficulty || before.mineLayout!==state.mineLayout || before.players.length!==state.players.length ||
      startingSeat(before)!==startingSeat(state) || Boolean(before.tabletop)!==Boolean(state.tabletop) ||
      usesEvents(before)!==usesEvents(state)) return false;
  if (state.tabletop ? !before.events.every((id,i)=>id===state.events[i]) : before.events.join()!==state.events.join()) return false;
  if (!before.players.every((player,i)=>player.guilds.join()===state.players[i].guilds.join())) return false;
  const old=before.mincmistr,next=state.mincmistr;
  if (old?.level!==next?.level || old?.shared!==next?.shared || old?.tougher!==next?.tougher) return false;
  return before.log.length<=state.log.length&&before.log.every((row,i)=>{
    const after=state.log[i];
    return row.round===after.round&&row.actor===after.actor&&row.text===after.text;
  });
}

function readReportVersions(report) {
  const version=value=>shortText(value,24)?value:null;
  return {
    appVersion:version(report?.appVersion),
    mincmistrRulesVersion:version(report?.mincmistrRulesVersion),
  };
}

function readReportSource(report,state) {
  if (!report || typeof report!=='object' || Array.isArray(report)) return undefined;
  const imported=readReportVersions(report);
  const source=readReportVersions(report.source);
  if (source.appVersion || source.mincmistrRulesVersion) imported.source=source;
  if (report.before?.kind===SAVE_KIND) {
    // A damaged replay position should not prevent opening the report itself.
    try {
      const before=savedState(report.before.state);
      if (isPriorPosition(before,state)) imported.before={kind:SAVE_KIND,state:before};
    } catch {}
  }
  return imported;
}

function readSnapshot(snapshot) {
  const state=savedState(snapshot.state);
  const rivalReport=Array.isArray(snapshot.rivalReport)
    ? snapshot.rivalReport.slice(0,150).filter(note=>typeof note==='string' && note.length<=600)
    : [];
  const review=snapshot.review;
  const validReview=state.mincmistr && integer(review?.seat,1,state.players.length-1) &&
    (review.plan===null || integer(review.plan,1,MINCMISTR_PLANS.length));
  const currentReview=validReview?{seat:review.seat,plan:review.plan}:null;
  if (currentReview?.plan&&validPlanChanges(review.changes,state)) {
    const {town,mine,summary}=review.changes;
    currentReview.changes={town,mine,summary};
  }
  if (currentReview) {
    const roundEnd=review.roundEnd;
    if (roundEnd===null) currentReview.roundEnd=null;
    else if (textList(roundEnd?.notes,24,600)&&textList(roundEnd.summary,40,200)) {
      currentReview.roundEnd={notes:roundEnd.notes,summary:roundEnd.summary};
    }
  }
  const note=snapshot.playtestNote??snapshot.playtest?.note;
  const importedReport=readReportSource(snapshot.importedReport??snapshot.playtest,state);
  return {state,rivalReport,review:currentReview,
    ...(typeof note==='string'&&note?{playtestNote:note.slice(0,1000)}:{}),
    ...(importedReport?{importedReport}:{}),
  };
}

export const readPosition=text=>readSnapshot(saveRecord(text));

export function writePlaytestReport(current,previous,note=current.playtestNote??'',createdAt=new Date()) {
  const {state,rivalReport,review,importedReport}=current;
  const before=importedReport?.before?.state??(previous?.replaced?null:previous?.state);
  const source=readReportVersions(importedReport?.source??importedReport);
  return JSON.stringify({
    kind:SAVE_KIND,state,rivalReport,review,
    playtest:{
      appVersion:VERSION,mincmistrRulesVersion:state.mincmistr?MINCMISTR_RULES_VERSION:null,
      createdAt:createdAt.toISOString(),seed:state.seed,
      setup:{
        card:state.setup,side:state.side,players:state.players.length,guildRows:state.players.map(p=>p.guilds),
        mineLayout:state.mineLayout,startingSeat:startingSeat(state),
        difficulty:state.difficulty,level:state.mincmistr?.level??null,sharedDeck:state.mincmistr?.shared??null,
        tougherMaster:state.mincmistr?.tougher??false,events:usesEvents(state),
      },
      note:note.slice(0,1000),
      ...(source.appVersion||source.mincmistrRulesVersion?{source}:{}),
      ...(isPriorPosition(before,state)?{before:{kind:SAVE_KIND,state:before}}:{}),
    },
  });
}

export function readAutosave(text) {
  const saved=saveRecord(text);
  const current=readSnapshot(saved);
  const undo=[];
  if (Array.isArray(saved.undo)) {
    // A damaged history entry should never hide a valid current position.
    for (const entry of saved.undo.slice(-AUTOSAVE_UNDO_LIMIT).reverse()) {
      try {
        const prior=readSnapshot(entry);
        if (entry.replaced===true) prior.replaced=true;
        undo.unshift(prior);
      } catch { break; }
    }
  }
  return {current,undo};
}

export function writeAutosave(current, history) {
  const saved={kind:SAVE_KIND,...current,undo:history.slice(-AUTOSAVE_UNDO_LIMIT)};
  let text=JSON.stringify(saved);
  // Leave room in browser storage when some imported snapshots have long journals.
  while (text.length>1_000_000 && saved.undo.length) {
    saved.undo.shift();
    text=JSON.stringify(saved);
  }
  return text;
}
