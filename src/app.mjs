import {
  BARBARA, BUILDINGS, CARDS, CITY_WIDTH, COMMODITY, EVENTS, GAME_RULES, GOODS, GUILDS,
  GUILD_SETUPS_BY_COUNT, HOUSE_EFFECTS, LABEL, MINES, MINE_FIELDS, PATRICIANS, REP_SCORE, VERSION,
} from './data.mjs';
import {
  applyKnownAction, canBuildGuild, cityPointsAt, copyState, coordinate, createGame, currentBarbara,
  eventNow, income, legalActions, marketOffer, mineDrawName, mineRows, patricianBase, physicalPrompt, plotCount, price,
  recordPhysicalDraw, reputationChange, rulesFor, scoreBreakdown, seatName, taxCost, transition, unavailableActionReason,
  undrawnMines, usesEvents,
} from './engine.mjs';
import {actionRationale,botAction} from './bot.mjs';
import {describePlan,PLAN_DECK,playMincmistr,ROW} from './mincmistr.mjs';
import {connectReference,openReference,setPlanFace,showPlan,startPaperDrawer} from './paper.mjs';
import {readAutosave,readPosition,writeAutosave,writePlaytestReport,writeSave} from './save.mjs';
import {downloadJson,storageSlot} from './storage.mjs';

const TABLETOP_BUILD=false;
const DIGITAL_STORAGE='kutna-hora-solo-v1';
const STORAGE=TABLETOP_BUILD?'kutna-hora-tabletop-v1':DIGITAL_STORAGE;
const MINE_DRAFT_STORAGE=`${STORAGE}-mine-draft`;
const savedGame=storageSlot(STORAGE);
const FIRST_SEED='silver-1308';
const byId=id=>document.getElementById(id);
const noteInput=byId('playtest-note');
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>`${n} g`;
const formatNumber=n=>String(n).replace('-','−');
const dotLabels={b:'blue',r:'red',y:'yellow',s:'silver',o:'orange'};
const signs={wood:'⌂',food:'✣',beer:'◈',ore:'⬟',silver:'◇',permit:'▤'};
const cap=text=>text[0].toUpperCase()+text.slice(1);
const plansByNote=new Map(PLAN_DECK.map(plan=>[`${describePlan(plan)}.`,plan.number]));
let state;
let unreadableSave=null;
let saveFailed=false;
let saveConflict=false;
const playerName=seat=>seatName(seat,state.players.length);
let undo=[];
let selections=[];
let cardPick=null;
let choice=0;
let detailsOpen=false;
let busy=false;
let allJournal=false;
let rivalReport=[];
let review=null;
let importedReport;
let savingDraft=null;
let mineDraft=null;
let flashTimer;
let selectionGroup=null;
let boardSeat=0;

function currentPosition() {
  return {state,rivalReport,review,playtestNote:noteInput.value||undefined,importedReport};
}

function restorePlaytestNote(note='') {
  noteInput.value=note;
  noteInput.closest('details').open=Boolean(note);
}

function clearMineDraft() {
  mineDraft=null;
  if (!TABLETOP_BUILD) return;
  try { sessionStorage.removeItem(MINE_DRAFT_STORAGE); }
  catch {}
}

function mineEntryDraft() {
  if (mineDraft) return mineDraft;
  // Match the exact pending position. Drafts stay in this tab and out of saves.
  const position=writeSave(state);
  let values={};
  try {
    const saved=JSON.parse(sessionStorage.getItem(MINE_DRAFT_STORAGE));
    if (saved?.position===position && saved.values && typeof saved.values==='object') values=saved.values;
    else sessionStorage.removeItem(MINE_DRAFT_STORAGE);
  } catch {}
  mineDraft={position,values};
  return mineDraft;
}

function reportVersions() {
  if (!importedReport) return undefined;
  const {appVersion,mincmistrRulesVersion,source}=importedReport;
  return {appVersion,mincmistrRulesVersion,source};
}

function payZeroTaxes(position) {
  while (position.phase==='tax' && taxCost(position,position.actor)===0) {
    position=transition(position,{kind:'tax',cost:0});
  }
  return position;
}

function checkEdition(position) {
  if (Boolean(position.state.tabletop)!==TABLETOP_BUILD) {
    throw Error(TABLETOP_BUILD
      ? 'This edition uses physical draws. Open a digital save in the earlier digital app.'
      : 'Open this save in the tabletop edition.');
  }
}

function restoreAutosave() {
  try {
    const saved=savedGame.read();
    unreadableSave=null;
    saveFailed=false;
    saveConflict=false;
    if (saved===null) return;
    try {
      const loaded=readAutosave(saved);
      checkEdition(loaded.current);
      ({rivalReport,review,importedReport}=loaded.current);
      state=payZeroTaxes(loaded.current.state);
      restorePlaytestNote(loaded.current.playtestNote);
      undo=loaded.undo.filter(position=>Boolean(position.state.tabletop)===TABLETOP_BUILD);
      boardSeat=0;
      resetSelection();
      return true;
    } catch {
      unreadableSave=saved;
    }
  } catch {
    saveFailed=true;
  }
}

function startDigitalGame() {
  if (state) return;
  restoreAutosave();
  state ??= createGame({seed:FIRST_SEED,tabletop:TABLETOP_BUILD});
  if (TABLETOP_BUILD) {
    if (physicalPrompt(state)?.kind!=='mine-draw') clearMineDraft();
    try { byId('export-digital-save').hidden=storageSlot(DIGITAL_STORAGE).read()===null; }
    catch {}
  }
  savedGame.watch(changed=>{
    saveConflict=changed;
    renderSaveStatus();
  });
  render();
}

async function storePosition(next, {replace=false, undoing=false}={}) {
  const previous=currentPosition();
  if (replace) previous.replaced=true;
  const history=undoing?undo.slice(0,-1):[...undo,previous].slice(-20);
  const restoreDraft=replace || (undoing&&next.replaced);
  const position={
    state:payZeroTaxes(next.state),rivalReport:next.rivalReport,review:next.review,
    playtestNote:restoreDraft?next.playtestNote:previous.playtestNote,
    importedReport:replace||undoing?next.importedReport:reportVersions(),
  };
  const contents=unreadableSave!==null && !replace?null:writeAutosave(position,history);
  const result=await savedGame.write(contents,{replace});
  saveConflict=result==='conflict';
  if (saveConflict) return false;
  clearMineDraft();
  ({state,rivalReport,review,importedReport}=position);
  if (restoreDraft) {
    boardSeat=0;
    restorePlaytestNote(position.playtestNote);
  }
  undo=history;
  resetSelection();
  saveFailed=result==='unavailable';
  if (result==='saved') unreadableSave=null;
  return true;
}

async function persistPlaytestNote() {
  let note;
  do {
    note=noteInput.value;
    const result=await savedGame.write(writeAutosave(currentPosition(),undo));
    saveConflict=result==='conflict';
    saveFailed=result==='unavailable';
    if (result!=='saved') return;
  } while (note!==noteInput.value);
}

noteInput.addEventListener('input',()=>{
  if (busy || savingDraft || saveConflict || unreadableSave!==null) return;
  savingDraft=persistPlaytestNote().finally(()=>{
    savingDraft=null;
    renderSaveStatus();
  });
  renderSaveStatus();
});

function renderSaveStatus() {
  const protectedSave=unreadableSave!==null;
  let warning='';
  if (saveConflict) warning='The saved game changed. Load it to continue. You can export this tab’s game and note first.';
  else if (saveFailed) warning='Autosave is unavailable. Export your game and note to keep your progress.';
  else if (protectedSave) warning='Your previous autosave could not be opened. Autosave is paused. Start a new game or import a save to resume it.';
  if (byId('save-warning').textContent!==warning) byId('save-warning').textContent=warning;
  byId('save-status').hidden=!warning;
  byId('load-saved-game').hidden=!saveConflict && !saveFailed;
  byId('load-saved-game').disabled=busy||!!savingDraft;
  byId('export-unreadable').hidden=!protectedSave || saveConflict;
  byId('undo').disabled=busy || saveConflict || undo.length===0;
  byId('report-before').disabled=busy || saveConflict;
  noteInput.readOnly=busy;
  for (const button of byId('decisions').querySelectorAll('[data-do="commit"],[data-do="rival"],[data-do="rival-step"],#physical-draw button[type="submit"]')) {
    button.disabled=busy || saveConflict;
  }
}
function resetSelection() {
  cardPick=null;
  choice=0;
  detailsOpen=false;
  selectionGroup=null;
}
function say(message, problem=false) {
  clearTimeout(flashTimer);
  const flash=byId('flash');
  flash.textContent=message;
  flash.classList.toggle('error',problem);
  flashTimer=setTimeout(()=>{flash.textContent='';},4200);
}
function dots(tile) {
  if (!tile?.dots) return '';
  return `<span class="dots" aria-label="${[...tile.dots].map(x=>dotLabels[x]).join(', ')} dots">${[...tile.dots].map(x=>`<i class="dot dot-${x}" aria-hidden="true"></i>`).join('')}</span>`;
}
function tileEffects(tile) {
  const effects=[];
  if (tile.public) {
    if (tile.vp) effects.push(`VP +${tile.vp}`);
    if (tile.rep) effects.push(`Reputation +${tile.rep}`);
    if (tile.pelicans) effects.push(`Pelicans +${tile.pelicans}`);
    if (tile.removeHouse) effects.push('Remove a house');
    effects.push(`${cap(tile.group)} patrician to pool`);
  } else {
    effects.push(`${COMMODITY[tile.group]} production +${tile.production}`);
    if (tile.technology) effects.push(`Ore deck +${tile.production}`,'Advances mining technology');
    else effects.push(`Advance ${COMMODITY[tile.group].toLowerCase()} price indicator`);
    if (tile.bypass) effects.push('Advances St. Barbara');
  }
  if (tile.pop) effects.push(`Population +${tile.pop}`);
  if (tile.tax) effects.push(`Tax rate +${money(tile.tax)}`);
  return effects.join(' · ');
}
function addChange(effects,label,before,after,unit='') {
  if (before!==after) effects.push(`${label} ${after>before?'+':'−'}${Math.abs(after-before)}${unit}`);
}
function appliedEffects(action) {
  // Apply only this choice to a copy. Round-end events and subsequent choices
  // stay separate, and no new tile faces from the copy are shown.
  const next=copyState(state,false);
  applyKnownAction(next,action,true);
  const before=state.players[state.actor];
  const after=next.players[state.actor];
  const effects=[];
  const mine=MINES[action.id];
  if (mine) effects.push(`${mine.stars} ★`,`${mine.extend} wood for adjacent expansion`);
  for (const key of GOODS) {
    addChange(effects,`${COMMODITY[key]} production`,before.production[key],after.production[key]);
    addChange(effects,`${COMMODITY[key]} price indicator`,state.arms[key],next.arms[key]);
  }
  addChange(effects,'Population',state.pop,next.pop);
  addChange(effects,'Ore deck',state.ore,next.ore);
  addChange(effects,'Tax rate',state.tax,next.tax,' g');
  addChange(effects,'VP',before.vp,after.vp);
  addChange(effects,'Reputation',before.rep,after.rep);
  if (action.kind==='barbara' && before.rep===after.rep) {
    effects.push(`Reputation stays at ${formatNumber(after.rep)}`);
  }
  addChange(effects,'Pelicans',before.pelicans,after.pelicans);
  for (const color of PATRICIANS) addChange(effects,`${cap(color)} patrician pool`,state.patrons[color],next.patrons[color]);
  if (next.barbara!==state.barbara) {
    effects.push(next.barbara===12?'Completes St. Barbara':`Advances St. Barbara to tile ${next.barbara}`);
  }
  if (next.technology!==state.technology) effects.push(`Draw up to ${next.technology+1} mines per action`,'Free technology mine choice');
  for (const [row,key] of before.guilds.entries()) {
    if (after.houses[row]===before.houses[row]) continue;
    effects.push(`Removes one ${GUILDS[key]} house`);
    const reward=HOUSE_EFFECTS[row][before.houses[row]];
    if (action.kind==='build' && reward.public) effects.push('Free public building rights choice');
  }
  if (action.kind==='build' && next.pending[0]?.kind==='house') effects.push('Choose a house to remove');
  const prices=GOODS.flatMap(key=>{
    const from=price(state,key);
    const to=price(next,key);
    return from===to?[]:[`${COMMODITY[key]} ${from} → ${money(to)}`];
  });
  return `<span>${effects.join(' · ')}</span>${prices.length?`<span class="price-changes">Price changes · ${prices.join(' · ')}</span>`:''}`;
}
function actionLabel(a) {
  switch(a.kind) {
    case 'plot': return `Town ${coordinate(a.space,CITY_WIDTH)} · ${money(a.cost)}`;
    case 'rights': return `${BUILDINGS[a.id].name} · ${money(a.cost)}`;
    case 'build': return `${BUILDINGS[a.id].name} at ${coordinate(a.space,CITY_WIDTH)} · ${money(a.cost)}`;
    case 'income': return a.color ? `Collect ${money(a.gross)} and seat ${a.color} · 10 g` : `Collect ${money(a.gross)}`;
    case 'mine': return a.refill ? `Recruit ${a.refill} · ${money(a.cost)}, then draw` : 'Draw without buying a permit';
    case 'place-mine': case 'technology': return `${mineDrawName(state,a.id)} at mine ${coordinate(a.space,rulesFor(state).board.mineWidth)} · ${money(a.cost)}`;
    case 'barbara': return `Spend one pelican · ${BARBARA[currentBarbara(state)][0]}`;
    case 'house': return `Remove a ${GUILDS[a.id]} house`;
    case 'patrician': return `Seat ${a.color} directly`;
    case 'score-building': return `Score ${BUILDINGS[state.city[a.space].id].name} at ${coordinate(a.space,CITY_WIDTH)}`;
    case 'tax': return `Pay ${money(a.cost)}`;
    case 'penalty': {
      const before=state.players[state.actor].rep;
      const {rep,vp}=reputationChange(before,-a.loss);
      const losses=[];
      if (rep<before) losses.push(`Lose ${before-rep} reputation`);
      if (vp<0) losses.push(`Lose ${-vp} VP`);
      return losses.join(' · ');
    }
    case 'skip': return state.pending[0]?.kind==='mine-place'?'Discard all drawn mines':'Continue with no effect';
    default: return LABEL[a.kind]??a.kind;
  }
}
function choiceInfo(a) {
  if (!a) return '';
  if (a.kind==='rights') return `<span>${dots(BUILDINGS[a.id])} When built · ${tileEffects(BUILDINGS[a.id])}</span>`;
  if (a.kind==='build') return dots(BUILDINGS[a.id])+' '+appliedEffects(a);
  if (['technology','place-mine','house','score-building'].includes(a.kind)) return appliedEffects(a);
  if (a.kind==='mine') return `<span>Draw up to ${state.technology+1} ${state.technology?'tiles':'tile'}, then choose one or discard the draw.</span>`;
  if (a.kind==='barbara') {
    const tile=currentBarbara(state);
    const rule=`<span>${BARBARA[tile][1]}</span>`;
    if (tile!==7) return rule;
    const joker=a.as && state.players[state.actor].rep<6 ? 'Includes the Joker cost. ' : '';
    return `${rule}<span class="effect-delta">${joker}${appliedEffects(a)}</span>`;
  }
  if (a.kind==='penalty') {
    const before=state.players[state.actor].rep;
    const {rep,vp}=reputationChange(before,-a.loss);
    const effects=[rep===before?`Reputation stays at ${formatNumber(rep)}`:`Reputation ${formatNumber(before)} → ${formatNumber(rep)}`];
    if (vp<0) effects.push(`Lose ${-vp} VP for steps below −5`);
    const scoreBefore=REP_SCORE[before]??0;
    const scoreAfter=REP_SCORE[rep]??0;
    if (scoreBefore!==scoreAfter) effects.push(`Final reputation score ${formatNumber(scoreBefore)} → ${formatNumber(scoreAfter)} VP`);
    return effects.join(' · ');
  }
  return '';
}
function publicLink(id) {
  const rank=PATRICIANS.indexOf(id);
  return ['public neighbours','pairs of used pelicans','mines in every row','empty columns of houses'][rank];
}

function renderDashboard() {
  const event=eventNow(state);
  const {rounds,redRound}=rulesFor(state);
  const title=state.phase==='end'?'Game complete':`Round ${state.round} of ${rounds}`;
  const dots=Array.from({length:rounds},(_,i)=>`<span title="Round ${i+1}" class="round-dot ${i+1===state.round?'now':''} ${i+1<state.round?'done':''}"></span>`).join('');
  let heading='Building market';
  let detail=`Red public buildings enter after round ${redRound}.`;
  if (state.round>redRound) {
    heading='Town council';
    detail=state.round===rounds?'Patricians score after taxes, followed by final scoring.':'Patricians score after taxes.';
  }
  if (event) {
    heading=event.name;
    detail=event.detail;
  }
  byId('dashboard').innerHTML=`<div class="round-label"><strong>${title}</strong><span class="round-dots" aria-hidden="true">${dots}</span></div>
    <div class="event"><strong>${heading}</strong><span>${detail}</span></div>
    <div class="tax-label"><span>Tax rate</span><strong>${money(state.tax)}</strong></div>`;
}
function renderOverview() {
  const rows=mineRows(state);
  const output=state.players.map((p,seat)=>{
    const {total}=scoreBreakdown(state,seat,rows);
    return `<article class="player panel seat-${seat} ${state.actor===seat&&state.phase!=='end'?'on-move':''}">
      <div class="player-title"><span class="seat-mark" aria-hidden="true"></span><h2>${playerName(seat)}</h2><span class="guild-line">${p.guilds.map(id=>GUILDS[id]).join(' · ')}</span></div>
      <div class="player-values">
        <span><b>${p.coins}</b><small><span class="metric-long">Groschen</span><span class="metric-short" aria-hidden="true">Cash</span></small></span><span><b>${income(state,seat)}</b><small>Income</small></span>
        <span><b>${p.rep}</b><small><span class="metric-long">Reputation</span><span class="metric-short" aria-hidden="true">Rep</span></small></span><span><b>${p.vp}</b><small><span class="metric-long">Earned VP</span><span class="metric-short" aria-hidden="true">VP</span></small></span>
      </div>
      <div class="player-foot"><span>${p.pelicans} unused pelican${p.pelicans===1?'':'s'} · ${p.pool} ready ${p.pool===1?'miner':'miners'}</span><span>${total} VP ${state.phase==='end'?'final':'if scored now'}</span></div>
      <button type="button" class="link board-link" data-do="player-board" data-value="${seat}" aria-label="View ${seat===0?'your':playerName(seat)+'’s'} player board">Player board</button>
    </article>`;
  });
  const overview=byId('overview');
  overview.classList.toggle('many-seats',state.players.length>2);
  overview.style.setProperty('--seats',state.players.length);
  overview.innerHTML=output.join('')+`<section class="panel economy" aria-label="Commodity prices">
    <div class="economy-copy"><strong>Market prices</strong><small>Population ${state.pop} · Ore ${state.ore}</small></div>
    <div class="prices">${GOODS.map(g=>`<span class="price"><span class="commodity-sign commodity-${g}" aria-hidden="true">${signs[g]}</span><span>${COMMODITY[g]}</span><b>${price(state,g)}</b></span>`).join('')}</div>
  </section>`;
}
function houseReward(reward) {
  const effects=[];
  if (reward.public) effects.push('Free public rights');
  if (reward.pelicans) effects.push(`${reward.pelicans} pelican`);
  if (reward.rep) effects.push(`+${reward.rep} reputation`);
  if (reward.vp) effects.push(`${reward.vp} VP`);
  return effects;
}
function renderPlayerBoard() {
  const p=state.players[boardSeat];
  byId('player-board-title').textContent=boardSeat===0?'Your player board':`${playerName(boardSeat)} player board`;
  const goods=GOODS.map(key=>`<tr><th scope="row">${COMMODITY[key]}</th><td>${p.production[key]}</td><td>${money(price(state,key))}</td><td>${money(p.production[key]*price(state,key))}</td></tr>`).join('');
  const houses=p.guilds.map((key,row)=>{
    const removed=p.houses[row];
    const rewards=HOUSE_EFFECTS[row];
    const track=rewards.map((reward,index)=>{
      const status=index<removed?'Removed':index===removed?'Next':'';
      return `<li class="${status.toLowerCase()}">${status?`<small>${status}</small>`:''}${houseReward(reward).map(text=>`<span>${text}</span>`).join('')}</li>`;
    }).join('');
    return `<div class="house-row">
      <div class="house-row-heading"><strong>${GUILDS[key]}</strong><small>${rewards.length-removed} left</small></div>
      <ol class="house-track" role="list" aria-label="${GUILDS[key]} house rewards">${track}</ol>
    </div>`;
  }).join('');
  byId('player-board-body').innerHTML=`
    <table class="score-table" aria-label="Production and income">
      <thead><tr><th scope="col">Commodity</th><th scope="col">Production</th><th scope="col">Price</th><th scope="col">Income</th></tr></thead>
      <tbody>${goods}</tbody>
    </table>
    <section class="house-rows" aria-labelledby="house-rows-title"><h3 id="house-rows-title">Guild houses</h3>${houses}</section>
    <p class="muted">Miners · ${p.pool} ready · ${p.reserve} in reserve</p>
    <p class="muted">Pelicans · ${p.pelicans} unused · ${p.usedPelicans} used</p>`;
}
function renderRivalHand() {
  const open=byId('rival-hand')?.open??true;
  const m=state.mincmistr;
  const order=m?ROW:CARDS.map((_,i)=>i);
  const shared=m?.shared&&state.players.length>2;
  const title=m?`Mincmistr · ${cap(m.level)}${m.tougher?' · Rounds 3–6':''}`:'Rival action cards';
  const hands=state.players.slice(1).map((player,i)=>{
    const seat=i+1;
    const cards=order.filter(index=>player.hand&(1<<index)).map(index=>CARDS[index]);
    const plan=m?PLAN_DECK[m.lastPlans[i]]:null;
    const count=m&&!shared?` · ${m.decks[m.shared?0:i].draw.length} Plans left`:'';
    const planText=plan
      ? `${describePlan(plan)} <button type="button" class="link plan-card-link" data-do="plan-card" data-value="${seat}/${plan.number}" aria-haspopup="dialog" aria-label="View ${playerName(seat)}’s Plan ${plan.number} card">View Plan card</button>`
      : 'Waiting for first Plan';
    return `<div class="rival-cards seat-${seat}">
      <strong>${playerName(seat)} <small>${cards.length} in hand${count}</small></strong>
      ${m?`<p class="rival-plan">${planText}</p>`:''}
      <ul aria-label="${playerName(seat)} action cards">${cards.map(pair=>`<li>${pair.map(kind=>LABEL[kind]).join(' / ')}</li>`).join('')}</ul>
    </div>`;
  });
  return `<details id="rival-hand" class="panel rival-hand" ${open?'open':''}>
    <summary>${title}</summary>
    ${shared?`<p class="rival-plan">Shared Plan deck · ${m.decks[0].draw.length} left</p>`:''}${hands.join('')}
  </details>`;
}
function showPlanCard(value) {
  const [seat,number]=value.split('/').map(Number);
  const plan=PLAN_DECK[number-1];
  if (!plan) return;
  byId('plan-title').textContent=`${playerName(seat)}’s Plan ${plan.number}`;
  const dialog=byId('plan-dialog');
  showPlan(dialog,plan);
  dialog.showModal();
}
function groupedChoices(actions) {
  if (!actions.every(a=>a.kind==='place-mine'||a.kind==='build'||a.kind==='skip') || new Set(actions.filter(a=>a.id).map(a=>a.id)).size<2) return actions;
  const ids=[...new Set(actions.filter(a=>a.id).map(a=>a.id))];
  if (!ids.includes(selectionGroup)) selectionGroup=ids[0];
  return actions.filter(a=>a.kind==='skip'||a.id===selectionGroup);
}
function renderChoices(actions, title, intro='') {
  if (!actions.length) return '';
  const grouped=groupedChoices(actions);
  const ids=[...new Set(actions.filter(a=>a.id).map(a=>a.id))];
  const isGrouped=grouped.length<actions.length;
  selections=grouped;
  if (choice>=grouped.length) choice=0;
  const current=grouped[choice];
  const first=actions.find(a=>a.kind!=='skip');
  const groupButtons=isGrouped?`<div class="tile-options" aria-label="Choose tile">${ids.map(id=>{
    const name=MINES[id]?mineDrawName(state,id):BUILDINGS[id].name;
    return `<button type="button" class="outline ${selectionGroup===id?'active':''}" data-do="tile" data-value="${id}" aria-pressed="${selectionGroup===id}">${name}</button>`;
  }).join('')}</div>`:'';
  const useSelect=grouped.length>6 || grouped.some(a=>a.space!==undefined);
  const options=grouped.length<=1?'':useSelect?`<label class="sr-only" for="action-option">Choose target</label><select id="action-option" aria-label="Choose target">${grouped.map((a,i)=>`<option value="${i}" ${i===choice?'selected':''}>${safe(actionLabel(a))}</option>`).join('')}</select>`:
    `<div class="tile-options" aria-label="Available choices">${grouped.map((a,i)=>`<button type="button" class="outline ${i===choice?'active':''}" data-do="option" data-value="${i}" aria-pressed="${i===choice}">${safe(actionLabel(a))}</button>`).join('')}</div>`;
  const mainLabel=grouped.length===1?actionLabel(current):current.kind==='skip'?actionLabel(current):first?.kind==='mine'?'Draw mine tiles':first?.kind==='income'?'Take Income':'Confirm choice';
  return `<div class="choices"><h3>${title}</h3>${intro?`<p class="muted">${intro}</p>`:''}${groupButtons}${options}
    <div class="choice-info">${choiceInfo(current)}</div><button type="button" class="primary fill" data-do="commit">${safe(mainLabel)}</button></div>`;
}
function renderCardChoices(actions) {
  const p=state.players[0];
  const cardControl=(card,kind)=>{
    const available=actions.some(a=>a.card===card&&(kind==='joker'?a.as:!a.as&&a.kind===kind));
    const isPicked=cardPick?.card===card&&cardPick.kind===kind;
    const reason=available?'':unavailableActionReason(state,card,kind);
    return `<button type="button" class="card-action ${isPicked?'selected':''}" data-do="card" data-value="${card}/${kind}" aria-pressed="${isPicked}" ${available?'':'disabled'}>${LABEL[kind]}${reason?`<small class="card-reason">${safe(reason)}</small>`:''}</button>`;
  };
  const cards=`<div class="hand" aria-label="Action card hand">${CARDS.map((kinds,card)=>`<div class="action-card ${p.hand&(1<<card)?'':'used'}">${kinds.map(kind=>cardControl(card,kind)).join('')}</div>`).join('')}</div>`;
  let choices='<p class="muted action-prompt">Choose one half of an available card.</p>';
  if (cardPick) {
    let kind=cardPick.kind;
    let intro='';
    let extra='';
    if (kind==='joker') {
      kind=cardPick.as??'rights';
      const uses=[...new Set(actions.filter(a=>a.card===cardPick.card&&a.as).map(a=>a.as))];
      if (!uses.includes(kind)) kind=uses[0];
      cardPick.as=kind;
      intro=p.rep>=6?'Your reputation waives the Joker cost.':'You lose 1 reputation before the chosen action.';
      extra=`<div class="tile-options joker-options" aria-label="Use Joker as">${uses.map(key=>`<button type="button" class="outline ${key===kind?'active':''}" data-do="joker" data-value="${key}" aria-pressed="${key===kind}">${LABEL[key]}</button>`).join('')}</div>`;
    }
    const list=actions.filter(a=>a.card===cardPick.card&&a.kind===kind&&(cardPick.kind==='joker'?a.as:!a.as));
    choices=extra+renderChoices(list,`${cardPick.kind==='joker'?'Joker · ':''}${LABEL[kind]}`,intro);
  }
  return cards+choices+`<details class="pass" ${detailsOpen?'open':''}>
    <summary>Play a card with no effect</summary><div class="tile-options">
    ${actions.filter(a=>a.kind==='skip').map(a=>`<button type="button" class="outline ${cardPick?.card===a.card&&cardPick?.kind==='skip'?'active':''}" data-do="card" data-value="${a.card}/skip">${CARDS[a.card].map(kind=>LABEL[kind]).join(' / ')}</button>`).join('')}</div></details>`;
}
function renderPending(actions) {
  const item=state.pending[0];
  const titles={
    'mine-place':['Place a mine',`${item.drawn?.length??0} drawn. Pick a tile and an open mine space.`],
    technology:['Place the technology tile',`New mine draws now reveal up to ${state.technology+1} tiles.`],
    right:['Take free rights',item.publicOnly?'Choose one of the public buildings.':'Choose an eligible building.'],
    house:['Remove a guild house',item.production?'You gain 2 production in the selected guild.':'The removed house’s printed effect is skipped.'],
    patrician:['Choose a patrician','The token moves directly from the bank to the council.'],
    'score-building':['Choose a building to score','You earn its current adjacent matches.'],
    plot:['Choose a free plot','Any empty space in town is eligible.'],
    build:['Choose a free building action','Use a held building right and one of your plots.'],
    income:['Collect income','You may also pay 10 g to seat one patrician from the pool.'],
    mine:['Take a free mine action','Draw tiles and place one with a miner from your reserve first.'],
  };
  return renderChoices(actions,...titles[item.kind]);
}
function renderResult() {
  const {scores,winner,winners}=state.result;
  const title=winner===null?'Shared first place':winner===0?'You won':`${playerName(winner)} won`;
  const note=winner===null?winners.map(playerName).join(' · '):
    scores.some((score,seat)=>seat!==winner&&score.total===scores[winner].total)?'Groschen decided the tie.':'';
  const lines=[['earned','Earned during play'],['town','Town adjacency'],['mines','Mine rows'],['income','Final income'],['reputation','Reputation'],['extras','Unused pieces'],['total','Total VP'],['coins','Groschen']];
  return `<h3 class="result-title">${title}</h3>${note?`<p class="muted">${note}</p>`:''}<table class="score-table final-score">
    <thead><tr><th scope="col">Score</th>${scores.map((_,seat)=>`<th scope="col">${playerName(seat)}</th>`).join('')}</tr></thead>
    <tbody>${lines.map(([key,label])=>`<tr class="${key==='total'?'total':''}"><th scope="row">${label}</th>${scores.map(score=>`<td>${score[key]}</td>`).join('')}</tr>`).join('')}</tbody>
    </table><button type="button" class="primary fill" data-do="dialog" data-value="setup">New game</button>`;
}
function ruleLink(number,label=`Rule ${number}`) {
  if (!byId(`mincmistr-rule-${number}`)) return safe(label);
  return `<button type="button" class="link rule-link" data-do="rule" data-value="${safe(number)}" aria-haspopup="dialog" aria-label="Read Mincmistr rule ${safe(number)}">${safe(label)}</button>`;
}
function renderRule(text) {
  const match=text.match(/^Rule (\d+(?:\.\d+)?)\b/);
  return match?ruleLink(match[1])+safe(text.slice(match[0].length)):safe(text);
}
function renderExplanation(entry) {
  if (!entry?.explanation?.length) return '';
  return `<details class="plan-explanation"><summary>Why this move?</summary><ol>${
    entry.explanation.map(step=>`<li>${ruleLink(step.rule)} <span>${safe(step.text)}</span></li>`).join('')
  }</ol></details>`;
}
function renderPlanChanges(changes, hasRoundEndRecord) {
  if (!changes) return '';
  const width=rulesFor(state).board.mineWidth;
  const spaces=[
    ...changes.town.map(i=>['town',i,`Town ${coordinate(i,CITY_WIDTH)}`]),
    ...changes.mine.map(i=>['mine',i,`Mine ${coordinate(i,width)}`]),
  ];
  if (!spaces.length&&!changes.summary.length) return '';
  const title=hasRoundEndRecord?'Changed by this Plan':'Changes after this step';
  return `<div class="plan-changes"><h4>${title}</h4><ul class="change-list">${
    spaces.map(([area,index,label])=>`<li><button type="button" class="link changed-space" data-do="locate-plan-change" data-value="${area}-${index}">◆ ${label}</button></li>`).join('')
  }${changes.summary.map(line=>`<li>${safe(line)}</li>`).join('')}</ul></div>`;
}

function renderRoundEnd(roundEnd) {
  if (!roundEnd || (!roundEnd.notes.length&&!roundEnd.summary.length)) return '';
  return `<div class="round-end-review"><h4>Automatic round-end effects</h4>
    ${roundEnd.notes.length?`<ul class="round-end-notes">${roundEnd.notes.map(line=>`<li>${safe(line)}</li>`).join('')}</ul>`:''}
    ${roundEnd.summary.length?`<ul class="change-list">${roundEnd.summary.map(line=>`<li>${safe(line)}</li>`).join('')}</ul>`:''}
  </div>`;
}

function renderPhysicalDraw(prompt) {
  if (prompt.kind==='event') {
    return `<form id="physical-draw" class="physical-draw">
      <p>Reveal your round ${state.round} event from deck ${prompt.set}.</p>
      <label>Printed event title<select name="event" required>
        <option value="">Select the title</option>
        ${prompt.choices.map(id=>`<option value="${id}">${safe(EVENTS[id].name)}</option>`).join('')}
      </select></label>
      <button type="submit" class="primary fill">Confirm event</button>
    </form>`;
  }
  const count=prompt.count;
  const tiles=`${count} mine ${count===1?'tile':'tiles'}`;
  if (prompt.kind==='mine-discard') {
    return `<form id="physical-draw" class="physical-draw">
      <p>Move ${tiles} from the top of the physical draw stack to the discard pile.</p>
      <button type="submit" class="primary fill">Confirm discard</button>
    </form>`;
  }
  const shuffle=prompt.beforeShuffle<count;
  const draw=shuffle?(prompt.beforeShuffle
    ? `Draw ${prompt.beforeShuffle}, then shuffle the discard pile and draw the remaining ${count-prompt.beforeShuffle}.`
    : `Shuffle the discard pile, then draw ${tiles}.`):`Draw ${tiles} from your stack.`;
  const labels={
    stars:['Stars'],ore:['Ore','Ore production'],pop:['Pop.','Population'],
    vp:['VP','Immediate VP'],extend:['Wood','Wood beside or below'],
  };
  const {values}=mineEntryDraft();
  return `<form id="physical-draw" class="physical-draw" autocomplete="off">
    <p>${draw} Enter the tiles in draw order. Leave absent symbols at zero. Wood is the cost shown for spaces beside or below the tile.</p>
    ${Array.from({length:count},(_,i)=>`<fieldset class="mine-entry"><legend>Drawn tile ${i+1}</legend>
      ${MINE_FIELDS.map((field,j)=>{
        const [label,fullLabel=label]=labels[field];
        const name=`${field}-${i}`;
        const value=typeof values[name]==='string'?values[name]:field==='extend'?'':'0';
        const last=i===count-1 && j===MINE_FIELDS.length-1;
        return `<label><span aria-hidden="true" title="${fullLabel}">${label}</span>
          <input name="${name}" aria-label="${fullLabel}" type="number" inputmode="numeric" enterkeyhint="${last?'done':'next'}"
            required step="1" min="${field==='extend'?1:0}" value="${safe(value)}">
        </label>`;
      }).join('')}
      <p id="mine-entry-error-${i}" class="mine-entry-error" hidden></p>
    </fieldset>`).join('')}
    <button type="submit" class="primary fill">Confirm mine draw</button>
  </form>`;
}

function renderDecisions() {
  selections=[];
  let title='Your turn';
  let tag=state.phase==='action'?`${state.left} ${state.left===1?'card':'cards'} left`:'';
  let content='';
  const prompt=physicalPrompt(state);
  if (prompt) {
    title=prompt.kind==='event'?'Reveal an event':prompt.kind==='mine-discard'?'Discard mine tiles':
      state.actor===0?'Draw your mine tiles':`${playerName(state.actor)} needs a mine draw`;
    content=renderPhysicalDraw(prompt);
    tag='';
  } else if (state.phase==='end') {
    title='Final scoring';
    content=renderResult();
  } else if (state.actor!==0) {
    const multiple=state.players.length>2;
    title=`${playerName(state.actor)} ${state.phase==='tax'?'taxes':'turn'}`;
    const what=multiple?'Play rivals':state.phase==='tax'?'Resolve rival taxes':'Play rival turn';
    const flow=multiple?(TABLETOP_BUILD?'Runs rival turns and pauses for physical draws.':'Resolves rival turns and taxes until your next decision.'):'';
    const step=state.phase==='tax'?'Resolve these taxes':state.pending.length?'Finish this Plan':'Play one Plan';
    content=`${flow?`<p class="muted rival-flow">${flow}</p>`:''}<button type="button" class="primary fill" data-do="rival" ${busy?'aria-busy="true"':''}>${busy?'Rival planning…':what}</button>
      ${state.mincmistr&&(state.phase==='action'||multiple)?`<button type="button" class="outline fill rival-step" data-do="rival-step">${step}</button>`:''}`;
  } else if (state.phase==='tax') {
    title='Your taxes';
    content=renderChoices(legalActions(state),'Pay or lose reputation','Your choices include any plot surcharges.');
  } else if (state.pending.length) {
    tag='Resolve effect';
    content=renderPending(legalActions(state));
  } else content=renderCardChoices(legalActions(state));
  const last=state.log.filter(entry=>entry.actor>0).slice(-4).map(entry=>noteFor(entry.actor,entry.text));
  const reviewTitle=review?.plan?`Plan ${review.plan}`:'Taxes';
  const draw=review?.plan?state.log.findLast(entry=>entry.actor===review.seat&&plansByNote.has(entry.text)):null;
  const planEntry=draw&&plansByNote.get(draw.text)===review.plan?draw:null;
  const notes=review?`<section class="panel rival-review" aria-labelledby="review-title"><div class="panel-head">
    <h3 id="review-title">${playerName(review.seat)} · ${reviewTitle}</h3></div>
    <div class="review-body">
      ${review.plan?`<button type="button" class="outline review-plan" data-do="plan-card" data-value="${review.seat}/${review.plan}" aria-haspopup="dialog">
        <span class="printed-plan-face" id="review-plan-face" aria-hidden="true"></span>View Plan card</button>`:''}
      <div class="review-actions">
        ${planEntry?.rule?`<p class="review-rule">${renderRule(planEntry.rule)}</p>`:''}
        ${rivalReport.length?`<ul>${rivalReport.map(row=>`<li>${safe(row)}</li>`).join('')}</ul>`:
          prompt?.kind==='mine-draw'?'<p class="muted">Waiting for the physical draw.</p>':'<p class="muted">Finished resolving the Plan.</p>'}
      </div>
    </div>
    ${renderPlanChanges(review.changes,review.roundEnd!==undefined)}
    ${renderRoundEnd(review.roundEnd)}
    ${renderExplanation(planEntry)}
    </section>`:
    rivalReport.length||last.length?`<details class="panel rival-report" ${state.players.length===2?'open':''}><summary>Rival notes</summary><ul>${(rivalReport.length?rivalReport:last).map(row=>`<li>${safe(row)}</li>`).join('')}</ul></details>`:'';
  byId('decisions').innerHTML=`<section class="panel decision" aria-label="Turn actions"><div class="panel-head"><h2 id="turn-title" tabindex="-1">${title}</h2>${tag?`<span class="turn-tag">${tag}</span>`:''}</div>
    <div class="panel-body">${content}</div></section>
    ${review?notes:''}${state.phase==='end'?'':renderRivalHand()}${review?'':notes}`;
  if (review?.plan) setPlanFace(byId('review-plan-face'),PLAN_DECK[review.plan-1]);
}

function noteFor(seat, text) {
  return state.players.length===2?text:`${playerName(seat)} · ${text}`;
}

function inspectAttributes(reference, label) {
  return `data-do="inspect" data-value="${safe(reference)}" aria-haspopup="dialog" aria-label="${safe(label)}"`;
}
function detailsButton(reference, label) {
  return `<button type="button" class="tile-details-button" ${inspectAttributes(reference,`Details for ${label}`)}>Details</button>`;
}
function showTileDetails(trigger, name, facts) {
  byId('tile-title').textContent=name;
  byId('tile-facts').innerHTML=facts.map(([label,value])=>`<dt>${safe(label)}</dt><dd>${safe(value)}</dd>`).join('');
  trigger.focus({preventScroll:true});
  byId('tile-dialog').showModal();
}
function inspectTile(reference, trigger) {
  const [area,key,heldId]=reference.split('/');
  const space=Number(key);
  if (area==='mine') {
    const cell=state.mine[space];
    const location=`Mine ${coordinate(space,rulesFor(state).board.mineWidth)}`;
    if (cell?.rock) {
      showTileDetails(trigger,'Rock',[['Location',location],['Stars',`${cell.stars} toward the row total`]]);
      return;
    }
    const tile=MINES[cell?.id];
    if (!tile) return;
    const effects=[];
    if (tile.ore) effects.push(`Ore production and ore deck +${tile.ore}`);
    if (tile.pop) effects.push(`Population +${tile.pop}`);
    if (tile.vp) effects.push(`VP +${tile.vp}`);
    showTileDetails(trigger,tile.name,[
      ['Location',location],
      ['Owner',playerName(cell.owner)],
      ['Stars',cell.stars],
      ['Expansion value',`${tile.extend} wood`],
      ['Printed effects',effects.join(' · ')||'No immediate production, population or VP'],
    ]);
    return;
  }
  const offer=area==='market'?marketOffer(state).find(item=>item.id===key):null;
  const cell=area==='town'?state.city[space]:null;
  const held=area==='held' && state.players[space]?.held.includes(heldId);
  const tile=BUILDINGS[offer?.id??cell?.id??(held?heldId:undefined)];
  if (!tile) return;
  const facts=[['Type',tile.public?'Public building':GUILDS[tile.group]]];
  if (offer) facts.push(['Rights price',money(offer.cost)],['Tiles in stack',offer.count]);
  if (held) facts.push(['Held by',playerName(space)]);
  if (cell) {
    facts.push(['Location',`Town ${coordinate(space,CITY_WIDTH)}`],['Owner',cell.owner===null?'Public':playerName(cell.owner)]);
    if (!tile.public) facts.push(['Town score now',`${cityPointsAt(state,space)} VP`]);
  }
  facts.push(
    ['Build cost',cell?`${tile.wood} wood`:`${tile.wood} wood · ${money(tile.wood*price(state,'wood'))} at current prices`],
    ['Plot value',money(tile.plot)],
    ['Matching dots',[...tile.dots].map(dot=>cap(dotLabels[dot])).join(', ')],
    ['Printed effects',tileEffects(tile)],
  );
  if (!cell && !tile.public && !canBuildGuild(state,tile.group)) {
    facts.push(['Construction','Unavailable at current demand']);
  }
  showTileDetails(trigger,tile.name,facts);
}

function mapCell(value, i, columns, area, board) {
  const id=coordinate(i,columns);
  const tile=area==='town'?BUILDINGS[value?.id]:MINES[value?.id];
  const selectedAction=selections[choice];
  const matching=selections.findIndex(a=>a.space===i&&(
    area==='town'?['plot','build','score-building'].includes(a.kind):['place-mine','technology'].includes(a.kind)));
  const active=matching>=0&&selectedAction?.space===i;
  const changed=review?.changes?.[area]?.includes(i);
  const owner=value?.owner??value?.plot;
  const tokenClass=owner!==undefined?`seat-${owner}`:value?'neutral':'open';
  const entrance=area==='mine'&&board.entrances.includes(i)&&!value;
  const classes=[`cell ${tokenClass}`,matching>=0?'target':'',active?'selected':'',value?.rock?'rock':'',
    entrance?'entrance':'',changed?'plan-changed':''].join(' ');
  const name=value?.rock?'Rock':tile?.name??(value?'Reserved plot':entrance?'Entrance':'Open space');
  const shortName=area==='town'&&value?.plot!==undefined?'Plot':
    name.startsWith('Technology ')?name.replace('Technology ','Tech '):null;
  const label=shortName?`<b><span class="cell-label-full">${safe(name)}</span><span class="cell-label-short" aria-hidden="true">${safe(shortName)}</span></b>`:
    `<b>${safe(name)}</b>`;
  const positionOwner=owner!==undefined?playerName(owner):tile?.public?'Public':'';
  const title=`${area==='town'?'Town':'Mine'} ${id} · ${name}${positionOwner?` · ${positionOwner}`:''}${value?.rock?` · ${value.stars} ★`:''}${changed?' · Changed by last Plan':''}`;
  const edge=area==='town'&&board.edge[i];
  const edgeMark=edge?`<span class="cell-edge" title="Board edge · ${dotLabels[edge]}"><span class="sr-only">Board edge</span>${dots({dots:edge})}</span>`:'';
  const details=area==='town'?dots(tile)+edgeMark:
    value?`<small>${value.stars} ★${tile?` · ${tile.extend}w`:''}</small>`:'';
  const content=`<span class="cell-id">${id}${changed?'<span class="plan-change-mark" aria-hidden="true"> ◆</span><span class="sr-only"> Changed by last Plan</span>':''}</span>${value||entrance?label:''}${details}`;
  const attributes=`class="${classes}" title="${safe(title)}"${changed?` id="plan-change-${area}-${i}"`:''}`;
  const reference=`${area}/${i}`;
  const inspectable=tile||value?.rock;
  if (matching>=0) {
    const target=`<button type="button" ${attributes} data-do="option" data-value="${matching}" aria-label="${safe(`${title} · ${actionLabel(selections[matching])}`)}" aria-pressed="${active}">${content}</button>`;
    return inspectable?`<div class="tile-with-details">${target}${detailsButton(reference,title)}</div>`:target;
  }
  if (inspectable) return `<button type="button" ${attributes} ${inspectAttributes(reference,`Inspect ${title}`)}>${content}</button>`;
  return `<div ${attributes}${changed?' tabindex="-1"':''}>${content}</div>`;
}
function renderBoards() {
  const {board}=rulesFor(state);
  const town=state.city.map((v,i)=>board.town[i]?mapCell(v,i,CITY_WIDTH,'town',board):'<div class="void" aria-hidden="true"></div>').join('');
  const mine=state.mine.map((v,i)=>mapCell(v,i,board.mineWidth,'mine',board)).join('');
  const rows=mineRows(state);
  const columns=rows.map((row,i)=>`<th scope="col" title="${row.total} total stars">Row ${i+1}</th>`).join('');
  const rowScores=state.players.map((_,seat)=>`<tr><th class="seat-${seat}" scope="row">${playerName(seat)}</th>${rows.map(row=>`<td>${row.vp[seat]}</td>`).join('')}</tr>`).join('');
  const legend=state.players.map((_,seat)=>`<span class="seat-${seat}">${playerName(seat)}</span>`).join('');
  byId('boards').innerHTML=`<section class="panel board" aria-label="Town board"><div class="panel-head"><h2>Town</h2><div class="legend">${legend}<span>Public</span></div></div><div class="town-grid">${town}</div></section>
    <section class="panel board" aria-label="Mine board"><div class="panel-head"><h2>Mines</h2><span class="fine">Draw ${state.technology+1} · ${undrawnMines(state)} in stack</span></div>
    <div class="mine-grid" style="--mine-columns:${board.mineWidth}">${mine}</div>
    <div class="mine-scores"><table class="score-table" aria-label="Mine row scores"><thead><tr><th scope="col">Mine VP</th>${columns}</tr></thead><tbody>${rowScores}</tbody></table></div></section>`;
}

function renderMarket() {
  const offers=marketOffer(state);
  const heading='<div class="offer-head"><span>1 g</span><span>1 permit</span><span>2 permits</span><span>3 permits</span></div>';
  const rows=Array.from({length:3},(_,r)=>Array.from({length:4},(_,c)=>{
    const offer=offers.find(tile=>tile.row===r&&tile.col===c);
    if (!offer) return '<div class="market-empty" aria-hidden="true">—</div>';
    const tile=BUILDINGS[offer.id];
    const closed=!tile.public&&!canBuildGuild(state,tile.group);
    const match=selections.findIndex(a=>a.kind==='rights'&&a.id===tile.id);
    const selected=selections[choice]?.id===tile.id && match>=0;
    const title=`${tile.name} · ${tile.public?'Public':GUILDS[tile.group]} · Rights ${money(offer.cost)} · Build ${tile.wood} wood · ${tileEffects(tile)}${closed?' · Construction is unavailable at current demand':''}`;
    const fields=`<span class="offer-guild">${tile.public?'Public':GUILDS[tile.group]}</span><b>${tile.name}</b><span class="offer-foot">${dots(tile)}<small>${tile.wood}w · ${offer.count} left</small></span>`;
    const attributes=`class="offer commodity-${tile.group} ${closed?'closed':''} ${selected?'chosen':''}" title="${safe(title)}"`;
    const reference=`market/${tile.id}`;
    if (match>=0) {
      const target=`<button type="button" ${attributes} data-do="option" data-value="${match}" aria-label="${safe(title)}" aria-pressed="${selected}">${fields}</button>`;
      return `<div class="tile-with-details">${target}${detailsButton(reference,tile.name)}</div>`;
    }
    return `<button type="button" ${attributes} ${inspectAttributes(reference,`Inspect ${tile.name}`)}>${fields}</button>`;
  }).join(''));
  const held=state.players.map((p,seat)=>{
    const tiles=p.held.map(id=>`<button type="button" class="link" ${inspectAttributes(`held/${seat}/${id}`,`Inspect ${BUILDINGS[id].name} held by ${seat===0?'you':playerName(seat)}`)}>${safe(BUILDINGS[id].name)}</button>`);
    return `<div class="held-row"><span class="seat-${seat}">${playerName(seat)}</span><div class="held-tiles">${tiles.join('')||'—'}</div></div>`;
  }).join('');
  const standings=mineRows(state);
  const baseValues=state.players.map((_,seat)=>patricianBase(state,seat,standings));
  const patricians=PATRICIANS.map(color=>{
    const points=baseValues.map((base,seat)=>`<span class="seat-${seat}" aria-label="${playerName(seat)} ${base[color]*state.council[color]} VP">${base[color]*state.council[color]}</span>`).join('');
    return `<div title="Scores ${publicLink(color)}" class="council-row"><span class="patrician-${color}">${cap(color)}</span><span>${state.patrons[color]}</span><span>${state.council[color]}</span><strong class="council-points">${points}</strong></div>`;
  }).join('');
  const {rounds,redRound}=rulesFor(state);
  const scoreOrder=state.players.map((_,seat)=>playerName(seat)).join(' / ');
  const number=currentBarbara(state);
  byId('town-hall').innerHTML=`<section class="panel" aria-label="Building offer"><div class="panel-head"><h2>Town hall</h2><span class="fine">Available rights</span></div>
    <div class="market"><span class="sr-only">Tiles list the wood cost and stack count.</span>${heading}<div class="offer-grid">${rows.join('')}</div></div>
    <div class="holdings"><h3>Held rights</h3>${held}</div></section>
    <section class="panel council"><div class="panel-head"><h2>Council</h2><span class="fine">Scoring rounds ${redRound+1}–${rounds}</span></div><div class="panel-body">
    <div class="council-row council-head"><span>Patrician</span><span>Pool</span><span>Seated</span><span>VP</span></div>${patricians}<small class="fine">${scoreOrder}</small></div></section>
    <section class="panel cathedral"><div class="panel-head"><h2>St. Barbara</h2><span class="fine">${number===12?'Complete':`Tile ${number} of 11`}</span></div>
    <div class="panel-body"><strong>${BARBARA[number][0]}</strong><p>${BARBARA[number][1]}</p></div></section>`;
}
function formatReportVersions({appVersion,mincmistrRulesVersion}) {
  const versions=[];
  if (appVersion) versions.push(`App v${appVersion}`);
  if (mincmistrRulesVersion) versions.push(`Mincmistr v${mincmistrRulesVersion}`);
  return versions.join(' · ');
}

function renderJournal() {
  const button=byId('journal-toggle');
  button.textContent=allJournal?'Show recent':'Show all';
  button.setAttribute('aria-expanded',String(allJournal));
  const entries=(allJournal?state.log:state.log.slice(-6)).slice().reverse();
  byId('journal-body').innerHTML=`<ol class="log-list">${entries.map(item=>{
    const plan=state.mincmistr&&item.actor>0?plansByNote.get(item.text):undefined;
    const note=safe(item.text);
    const content=plan?`<button type="button" class="link plan-card-link" data-do="plan-card" data-value="${item.actor}/${plan}" aria-haspopup="dialog">${note}</button>${item.rule?`<div class="journal-rule">${renderRule(item.rule)}</div>`:''}${renderExplanation(item)}`:note;
    return `<li><span class="log-round">R${item.round}</span><span class="log-seat seat-${item.actor}">${item.actor===null?'Town':playerName(item.actor)}</span><div class="journal-entry">${content}</div></li>`;
  }).join('')}</ol>`;
  byId('report-source').hidden=!importedReport;
  byId('report-before').hidden=!importedReport?.before;
  if (importedReport) {
    const original=formatReportVersions(importedReport.source??importedReport);
    const exporter=formatReportVersions(importedReport);
    const showExporter=Boolean(importedReport.source && exporter && original!==exporter);
    const title=showExporter?'Original report':'Imported game report';
    byId('report-source-title').textContent=original?`${title} · ${original}`:title;
    byId('report-exported-with').hidden=!showExporter;
    byId('report-exported-with').textContent=showExporter?`Re-exported with ${exporter}`:'';
  }
}
function render() {
  if (byId('tile-dialog').open) byId('tile-dialog').close();
  if (byId('plan-dialog').open) byId('plan-dialog').close();
  const focus=document.activeElement;
  const focused=focus?.dataset?.do?{action:focus.dataset.do,value:focus.dataset.value}:null;
  renderDashboard();
  renderOverview();
  renderDecisions();
  renderBoards();
  renderMarket();
  renderJournal();
  renderSaveStatus();
  if (byId('player-board-dialog').open) renderPlayerBoard();
  if (focused && !focus.isConnected) {
    const next=[...document.querySelectorAll('[data-do]')].find(el=>el.dataset.do===focused.action&&el.dataset.value===focused.value&&!el.disabled);
    if (next) next.focus({preventScroll:true});
  }
}
async function changeGame(change, {focus=false, planning=false}={}) {
  if (busy || saveConflict) return;
  busy=true;
  if (planning) renderDecisions();
  renderSaveStatus();
  try {
    // A draft write uses the same save slot, so let it finish before moving.
    if (savingDraft) await savingDraft;
    if (!saveConflict) await change();
  }
  catch (error) { say(error.message,true); }
  finally {
    busy=false;
    render();
    if (focus && !byId('digital-game').hidden && !document.querySelector('dialog[open]')) {
      byId(saveConflict?'load-saved-game':'turn-title').focus({preventScroll:true});
    }
  }
}

function commit() {
  const a=selections[choice];
  if (!a || state.actor!==0) return;
  const recentPlan=review?{seat:review.seat,plan:review.plan}:null;
  changeGame(()=>storePosition({state:transition(state,a),rivalReport,review:recentPlan}),{focus:true});
}
function compareChange(summary,label,from,to,unit='') {
  if (from!==to) summary.push(`${label} ${from} → ${to}${unit}`);
}

function playerChanges(previous,next) {
  const summary=[];
  compareChange(summary,'Coins',previous.coins,next.coins,' g');
  compareChange(summary,'Reputation',previous.rep,next.rep);
  compareChange(summary,'Earned points',previous.vp,next.vp,' VP');
  compareChange(summary,'Pelicans',previous.pelicans,next.pelicans);
  compareChange(summary,'Miner pool',previous.pool,next.pool);
  compareChange(summary,'Miner reserve',previous.reserve,next.reserve);
  for (const good of GOODS) compareChange(summary,`${COMMODITY[good]} production`,previous.production[good],next.production[good]);
  for (const [row,guild] of previous.guilds.entries()) {
    compareChange(summary,`Houses removed · ${GUILDS[guild]}`,previous.houses[row],next.houses[row]);
  }
  const gained=next.held.filter(id=>!previous.held.includes(id));
  const spent=previous.held.filter(id=>!next.held.includes(id));
  if (gained.length) summary.push(`Rights gained · ${gained.map(id=>BUILDINGS[id].name).join(', ')}`);
  if (spent.length) summary.push(`Rights used · ${spent.map(id=>BUILDINGS[id].name).join(', ')}`);
  return summary;
}

function sharedChanges(before,after) {
  const summary=[];
  compareChange(summary,'Population',before.pop,after.pop);
  compareChange(summary,'Ore',before.ore,after.ore);
  compareChange(summary,'Tax',before.tax,after.tax,' g');
  compareChange(summary,'Mine draw',before.technology+1,after.technology+1);
  const cathedral=game=>currentBarbara(game)===12?'complete':`tile ${currentBarbara(game)}`;
  compareChange(summary,'St. Barbara',cathedral(before),cathedral(after));
  for (const color of PATRICIANS) {
    compareChange(summary,`${cap(color)} patricians seated`,before.council[color],after.council[color]);
    compareChange(summary,`${cap(color)} patricians in pool`,before.patrons[color],after.patrons[color]);
  }
  return summary;
}

function planChanges(before,after) {
  const seat=before.actor;
  const changes=(from,to,keys)=>from.flatMap((cell,i)=>
    keys.some(key=>cell?.[key]!==to[i]?.[key])?[i]:[]);
  return {
    town:changes(before.city,after.city,['id','owner','plot']),
    mine:changes(before.mine,after.mine,['id','owner','rock','stars']),
    summary:[...playerChanges(before.players[seat],after.players[seat]),...sharedChanges(before,after)],
  };
}

function roundEndReview(before,after) {
  if (!before) return null;
  const notes=after.log.slice(before.log.length).map(({actor,text})=>actor===null?text:`${playerName(actor)} · ${text}`);
  const players=before.players.flatMap((player,seat)=>
    playerChanges(player,after.players[seat]).map(line=>`${playerName(seat)} · ${line}`));
  return {notes,summary:[...sharedChanges(before,after),...players]};
}

async function rivalMoves(start, {onePlan=false, finishCardOnly=false}={}) {
  const multiple=start.players.length>2;
  const continuingPlan=onePlan&&start.pending.length>0;
  const notes=continuingPlan&&review?.seat===start.actor?[...rivalReport]:[];
  let next=start;
  let afterAction;
  const beforeRoundEnd=onePlan?position=>{afterAction=copyState(position);}:undefined;
  let planNumber=null;
  let steps=0;
  while (next.actor!==0&&next.phase!=='end'&&!physicalPrompt(next)) {
    const turn=next;
    do {
      if (++steps>120) throw Error('The rivals’ turns did not finish.');
      const previousEntries=next.log.length;
      let why;
      if (next.mincmistr) {
        next=playMincmistr(next,beforeRoundEnd);
        if (onePlan && start.phase==='action') planNumber=next.mincmistr.lastPlans[start.actor-1]+1;
      } else {
        const action=botAction(next);
        if (!action) throw Error('No legal rival action.');
        if (!multiple&&['rights','build','place-mine','technology','income'].includes(action.kind)) why=actionRationale(next,action);
        next=transition(next,action);
      }
      const afterTaxes=payZeroTaxes(next);
      if (afterTaxes!==next && onePlan) afterAction??=next;
      next=afterTaxes;
      const entries=next.log.slice(previousEntries,afterAction?.log.length);
      for (const {actor,text} of entries) {
        if (actor!==turn.actor && !(onePlan && actor===null)) continue;
        if (onePlan && plansByNote.has(text)) continue;
        notes.push(onePlan?text:noteFor(turn.actor,text));
      }
      if (why) notes.push(why);
    } while (!physicalPrompt(next)&&(onePlan||finishCardOnly?next.pending.length>0:
      next.actor===turn.actor&&next.phase===turn.phase&&next.round===turn.round&&next.turn===turn.turn));
    if (onePlan || finishCardOnly || !multiple || saveConflict || physicalPrompt(next)) break;
    // Let the browser update between rivals on larger tables.
    if (next.actor!==0&&next.phase!=='end') await new Promise(resolve=>setTimeout(resolve,0));
  }
  const reviewed=onePlan?{seat:start.actor,plan:planNumber,roundEnd:roundEndReview(afterAction,next)}:null;
  if (reviewed?.plan) {
    const before=continuingPlan?undo.findLast(({state:previous})=>
      previous.seed===start.seed&&previous.round===start.round&&previous.turn===start.turn&&
      previous.actor===start.actor&&previous.left===start.left+1&&!previous.pending.length&&
      plansByNote.get(start.log[previous.log.length]?.text)===planNumber)?.state:start;
    if (before) reviewed.changes=planChanges(before,afterAction??next);
  }
  return {state:next,rivalReport:onePlan||multiple?notes:notes.slice(0,6),review:reviewed};
}

function runRival(onePlan=false) {
  if (state.actor===0 || state.phase==='end' || physicalPrompt(state) || (onePlan && !state.mincmistr)) return;
  changeGame(async()=>{
    await new Promise(resolve=>setTimeout(resolve,24));
    const next=await rivalMoves(state,{onePlan});
    if (!saveConflict) await storePosition(next);
  },{focus:true,planning:true});
}

function clearMineEntryError(entry) {
  if (!entry?.hasAttribute('aria-invalid')) return;
  entry.removeAttribute('aria-invalid');
  entry.removeAttribute('aria-describedby');
  const feedback=entry.querySelector('.mine-entry-error');
  feedback.hidden=true;
  feedback.textContent='';
}

byId('decisions').addEventListener('input',event=>{
  const field=event.target;
  if (!field.matches('#physical-draw .mine-entry input')) return;
  clearMineEntryError(field.closest('.mine-entry'));
  const draft=mineEntryDraft();
  draft.values[field.name]=field.value;
  try { sessionStorage.setItem(MINE_DRAFT_STORAGE,JSON.stringify(draft)); }
  catch {}
});

byId('decisions').addEventListener('focusin',event=>{
  if (event.target.matches('#physical-draw .mine-entry input')) event.target.select();
});

byId('decisions').addEventListener('keydown',event=>{
  const field=event.target;
  if (event.key!=='Enter' || event.isComposing || !field.matches('#physical-draw .mine-entry input')) return;
  const fields=[...field.form.querySelectorAll('.mine-entry input')];
  const next=fields[fields.indexOf(field)+1];
  if (!next) return;
  event.preventDefault();
  if (field.reportValidity()) next.focus();
});

byId('decisions').addEventListener('submit',event=>{
  const drawForm=event.target;
  if (drawForm.id!=='physical-draw') return;
  event.preventDefault();
  const prompt=physicalPrompt(state);
  if (busy||saveConflict||!prompt) return;
  const form=new FormData(drawForm);
  let input;
  if (prompt.kind==='event') input=form.get('event');
  else if (prompt.kind==='mine-draw') {
    input=Array.from({length:prompt.count},(_,i)=>
      Object.fromEntries(MINE_FIELDS.map(field=>[field,Number(form.get(`${field}-${i}`))])));
  }
  clearMineEntryError(drawForm.querySelector('.mine-entry[aria-invalid]'));
  let next;
  try { next=recordPhysicalDraw(state,input); }
  catch (error) {
    const entry=drawForm.querySelectorAll('.mine-entry')[error.tileIndex];
    if (entry) {
      const feedback=entry.querySelector('.mine-entry-error');
      feedback.textContent=error.message;
      feedback.hidden=false;
      entry.setAttribute('aria-invalid','true');
      entry.setAttribute('aria-describedby',feedback.id);
      entry.querySelector('input').focus();
    } else say(error.message,true);
    return;
  }
  changeGame(async()=>{
    if (prompt.kind==='mine-draw'&&next.actor>0) {
      const onePlan=review?.seat===next.actor&&review.plan===next.mincmistr?.lastPlans[next.actor-1]+1;
      const result=await rivalMoves(next,{onePlan,finishCardOnly:true});
      if (!saveConflict) await storePosition(result);
    } else await storePosition({state:next,rivalReport,review});
  },{focus:true});
});
function changeAction(card,kind) {
  const wasOpen=byId('decisions').querySelector('details')?.open??false;
  resetSelection();
  detailsOpen=wasOpen;
  cardPick={card:Number(card),kind};
  render();
}
function randomSeed() {
  const value=crypto.getRandomValues(new Uint32Array(1))[0];
  return `silver-${value.toString(36)}`;
}
function guildOrders(guilds) {
  return guilds.flatMap(a=>guilds.filter(b=>b!==a).map(b=>[a,b,guilds.find(c=>c!==a&&c!==b)]));
}
function fillMincmistrOptions() {
  const form=byId('setup-form');
  const count=Number(form.elements.playerCount.value);
  const active=form.elements.difficulty.value==='mincmistr';
  const several=active&&count>2;
  const tougher=active&&count===3&&form.elements.mincmistrLevel.value==='master';
  byId('mincmistr-level-option').hidden=!active;
  form.elements.mincmistrLevel.disabled=!active;
  byId('mincmistr-deck-option').hidden=!several;
  form.elements.mincmistrDecks.disabled=!several;
  byId('mincmistr-tougher-option').hidden=!tougher;
  form.elements.mincmistrTougher.disabled=!tougher;
}
function fillTableOptions() {
  const count=Number(byId('player-count').value);
  const starter=byId('setup-form').elements.starter;
  const previous=Number(starter.value);
  starter.innerHTML=Array.from({length:count},(_,seat)=>`<option value="${seat}">${seatName(seat,count)}</option>`).join('');
  starter.value=String(previous<count?previous:0);
  byId('setup-events').hidden=count===2;
  byId('setup-form').elements.events.disabled=count===2;
  fillMincmistrOptions();
  fillSetup();
}
function fillSetup(changeSide=true) {
  const card=Number(byId('guild-setup').value);
  const count=Number(byId('player-count').value);
  const sets=GUILD_SETUPS_BY_COUNT[count][card];
  const select=byId('guild-side');
  const old=Number(select.value);
  if (changeSide) select.innerHTML=sets.map((guilds,i)=>`<option value="${i}">${guilds.map(id=>GUILDS[id]).join(' · ')}</option>`).join('');
  const chosen=old<count?old:0;
  select.value=String(chosen);
  const guilds=sets[chosen];
  byId('guild-rows').innerHTML=guildOrders(guilds).map((order,i)=>`<option value="${i}">${order.map(id=>GUILDS[id]).join(' → ')}</option>`).join('');
  byId('opening-note').textContent=count===2
    ? `Rival guild set (row order set by seed) · ${sets[1-chosen].map(id=>GUILDS[id]).join(' · ')}`
    : `${GAME_RULES[count].rounds} rounds on the larger boards. The seed assigns the remaining guild sets and house rows to rivals.`;
}
function openDialog(kind) {
  if (kind==='setup') {
    const form=byId('setup-form');
    byId('guild-setup').innerHTML=Object.keys(GUILD_SETUPS_BY_COUNT[2]).map(key=>`<option ${Number(key)===state.setup?'selected':''} value="${key}">Card ${key}</option>`).join('');
    byId('player-count').value=String(state.players.length);
    form.elements.seed.value=randomSeed();
    form.elements.difficulty.value=state.difficulty;
    form.elements.mincmistrLevel.value=state.mincmistr?.level??'journeyman';
    form.elements.mincmistrDecks.value=state.mincmistr?.shared===false?'individual':'shared';
    form.elements.mincmistrTougher.checked=state.mincmistr?.tougher??false;
    form.elements.events.checked=state.players.length>2&&usesEvents(state);
    form.elements.starter.value='0';
    fillTableOptions();
    byId('guild-side').value=String(state.side);
    fillSetup(false);
  }
  byId(`${kind}-dialog`).showModal();
}
byId('setup-form').addEventListener('submit',event=>{
  event.preventDefault();
  if (busy) return;
  if (saveConflict) {
    byId('setup-dialog').close();
    byId('load-saved-game').focus();
    return;
  }
  const form=new FormData(event.currentTarget);
  const playerCount=Number(form.get('playerCount'));
  const setup=Number(form.get('setup'));
  const side=Number(form.get('side'));
  const next=createGame({
    playerCount,setup,side,events:form.has('events'),seed:form.get('seed'),tabletop:TABLETOP_BUILD,
    starter:Number(form.get('starter')),difficulty:form.get('difficulty'),
    mincmistr:{level:form.get('mincmistrLevel'),shared:form.get('mincmistrDecks')!=='individual',tougher:form.has('mincmistrTougher')},
    orders:[guildOrders(GUILD_SETUPS_BY_COUNT[playerCount][setup][side])[Number(form.get('rows'))]],
  });
  changeGame(async()=>{
    const applied=await storePosition({state:next,rivalReport:[],review:null},{replace:true});
    byId('setup-dialog').close();
    if (applied && !saveFailed) say('New game ready.');
  },{focus:true});
});
byId('guild-side').addEventListener('change',()=>fillSetup(false));
byId('guild-setup').addEventListener('change',()=>fillSetup());
byId('player-count').addEventListener('change',fillTableOptions);
byId('rival-difficulty').addEventListener('change',fillMincmistrOptions);
byId('mincmistr-level').addEventListener('change',fillMincmistrOptions);
byId('file').addEventListener('change',async event=>{
  const file=event.currentTarget.files[0];
  event.currentTarget.value='';
  if (!file || busy) return;
  const previous=state;
  try {
    if (file.size>4_000_000) throw Error('That save is larger than 4 MB.');
    const next=readPosition(await file.text());
    checkEdition(next);
    if (busy || saveConflict || state!==previous) throw Error('The game changed while the file was opening. Try importing again.');
    await changeGame(async()=>{
      const applied=await storePosition(next,{replace:true});
      if (applied && !saveFailed) say('Save imported.');
    },{focus:true});
  } catch (error) {say(error instanceof SyntaxError?'This file does not contain valid save data.':error.message,true);}
});
document.addEventListener('change',event=>{
  if (event.target.id==='action-option') {
    choice=Number(event.target.value);
    render();
    byId('action-option')?.focus({preventScroll:true});
  }
});
byId('digital-game').addEventListener('click',event=>{
  const button=event.target.closest('button[data-do]');
  if (!button||button.disabled) return;
  const {do:action,value}=button.dataset;
  if (busy && !['dialog','close','journal','player-board','export','export-unreadable','report'].includes(action)) return;
  try {
    switch(action) {
      case 'dialog': openDialog(value); break;
      case 'player-board':
        boardSeat=Number(value);
        renderPlayerBoard();
        byId('player-board-dialog').showModal();
        break;
      case 'inspect': inspectTile(value,button); break;
      case 'plan-card': showPlanCard(value); break;
      case 'rule': openReference(value); break;
      case 'locate-plan-change': {
        const cell=byId(`plan-change-${value}`);
        cell?.scrollIntoView?.({block:'center'});
        cell?.focus({preventScroll:true});
        break;
      }
      case 'close': button.closest('dialog').close(); break;
      case 'seed': byId('setup-form').elements.seed.value=randomSeed(); break;
      case 'card': changeAction(...value.split('/')); break;
      case 'joker': cardPick.as=value; choice=0; selectionGroup=null; render(); break;
      case 'tile': selectionGroup=value; choice=0; render(); break;
      case 'option': choice=Number(value); render(); break;
      case 'commit': commit(); break;
      case 'rival': runRival(); break;
      case 'rival-step': runRival(true); break;
      case 'undo': {
        const previous=undo.at(-1);
        if (!previous) return;
        changeGame(async()=>{
          const applied=await storePosition(previous,{undoing:true});
          if (applied && !saveFailed) say('Last move undone.');
        },{focus:true});
        break;
      }
      case 'load-saved': {
        const loaded=restoreAutosave();
        if (loaded) clearMineDraft();
        render();
        if (loaded) say('Saved game loaded.');
        else if (!saveFailed && unreadableSave===null) say('There is no saved game in this browser.');
        byId('turn-title').focus({preventScroll:true});
        break;
      }
      case 'journal': allJournal=!allJournal; renderJournal(); break;
      case 'report-before': {
        const before=importedReport?.before;
        if (!before) break;
        const position={state:before.state,rivalReport:[],review:null,playtestNote:noteInput.value,importedReport:reportVersions()};
        changeGame(async()=>{
          const applied=await storePosition(position,{replace:true});
          if (applied && !saveFailed) say('Position before the reported step loaded.');
        },{focus:true});
        break;
      }
      case 'report': {
        const time=new Date();
        const seed=state.seed.replace(/[^a-z0-9._-]+/gi,'-');
        const stamp=time.toISOString().replace(/[:.]/g,'-');
        const contents=writePlaytestReport(currentPosition(),undo.at(-1),noteInput.value,time);
        downloadJson(contents,`Kutna_Hora_Game_Report_v${VERSION}_${seed}_${stamp}.json`);
        break;
      }
      case 'export': downloadJson(writeSave(state),'Kutna_Hora_Solo_Save.json'); break;
      case 'export-digital-save': {
        const previous=storageSlot(DIGITAL_STORAGE).read();
        if (previous!==null) downloadJson(previous,'Kutna_Hora_v1.0_Save.json');
        break;
      }
      case 'export-unreadable':
        if (unreadableSave!==null) downloadJson(unreadableSave,'Kutna_Hora_Unreadable_Save.json');
        break;
      case 'import': byId('file').click(); break;
    }
  } catch (error) {say(error.message,true);}
});

let drawerStarted=false;
function showMode() {
  const digital=byId('digital-game');
  const drawer=byId('draw-only');
  const drawOnly=location.hash==='#draw-only';
  const changed=drawer.hidden===drawOnly;
  if (changed) {
    const leaving=drawOnly?digital:drawer;
    leaving.querySelector('dialog[open]')?.close();
    if (byId('paper-reference').open) byId('paper-reference').close();
  }
  digital.hidden=drawOnly;
  drawer.hidden=!drawOnly;
  if (drawOnly) {
    if (!drawerStarted) {
      startPaperDrawer();
      drawerStarted=true;
    }
  } else {
    startDigitalGame();
  }
  if (changed) byId(drawOnly?'paper-title':'digital-title').focus();
}
window.addEventListener('hashchange',showMode);
byId('physical-guide').hidden=!TABLETOP_BUILD;
byId('physical-setup').hidden=!TABLETOP_BUILD;
if (TABLETOP_BUILD) {
  const checklist=byId('physical-setup-steps').content;
  for (const target of document.querySelectorAll('[data-physical-steps]')) {
    target.append(checklist.cloneNode(true));
  }
}
connectReference();
showMode();
