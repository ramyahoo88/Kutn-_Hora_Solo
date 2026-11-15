import {
  BARBARA, BUILDINGS, CARDS, CITY, CITY_EDGE, COMMODITY, GOODS, GUILDS,
  GUILD_SETUPS, HOUSE_EFFECTS, LABEL, MINE_ENTRANCES, MINES, PATRICIANS,
} from './data.mjs';
import {
  SEATS, applyKnownAction, canBuildGuild, copyState, coordinate, createGame, currentBarbara, eventNow, income, legalActions,
  marketOffer, mineRow, patricianBase, plotCount, price, scoreBreakdown, transition,
} from './engine.mjs';
import {actionRationale,botAction} from './bot.mjs';
import {readSave,writeSave} from './save.mjs';

const STORAGE='kutna-hora-solo-v1';
const FIRST_SEED='silver-1308';
const byId=id=>document.getElementById(id);
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>`${n} g`;
const dotLabels={b:'blue',r:'red',y:'yellow',s:'silver',o:'orange'};
const signs={wood:'⌂',food:'✣',beer:'◈',ore:'⬟',silver:'◇',permit:'▤'};
const cap=text=>text[0].toUpperCase()+text.slice(1);
let state;
let unreadableSave=null;
let storageReadFailed=false;
let saveFailed=false;
let mayReplaceAutosave=false;
try {
  const saved=localStorage.getItem(STORAGE);
  if (saved!==null) {
    try {state=readSave(saved);} catch {unreadableSave=saved;}
  }
} catch {
  storageReadFailed=true;
  saveFailed=true;
}
state ??= createGame({seed:FIRST_SEED});
let undo=[];
let selections=[];
let cardPick=null;
let choice=0;
let detailsOpen=false;
let busy=false;
let allJournal=false;
let rivalReport=[];
let flashTimer;
let selectionGroup=null;
let boardSeat=0;

function writeLocal(replace=false) {
  if (replace) mayReplaceAutosave=true;
  if (unreadableSave!==null && !mayReplaceAutosave) return;
  try {
    if (storageReadFailed && !mayReplaceAutosave) {
      // Storage may become accessible after launch. Keep any prior game intact.
      unreadableSave=localStorage.getItem(STORAGE);
      storageReadFailed=false;
      if (unreadableSave!==null) {
        saveFailed=false;
        return;
      }
    }
    localStorage.setItem(STORAGE,writeSave(state));
    unreadableSave=null;
    storageReadFailed=false;
    saveFailed=false;
  } catch {
    if (!saveFailed) say('Autosave is unavailable. Export your current game to keep your progress.',true);
    saveFailed=true;
  }
}
function renderSaveStatus() {
  const protectedSave=unreadableSave!==null;
  let warning='';
  if (saveFailed) warning='Autosave is unavailable. Export your current game to keep your progress.';
  if (protectedSave) {
    warning += `${warning?' ':''}Your previous autosave could not be opened.`;
    if (!mayReplaceAutosave) warning += ' Autosave is paused. Start a new game or import a save to resume it.';
  }
  if (byId('save-warning').textContent!==warning) byId('save-warning').textContent=warning;
  byId('save-status').hidden=!warning;
  byId('export-unreadable').hidden=!protectedSave;
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
    case 'plot': return `Town ${coordinate(a.space,6)} · ${money(a.cost)}`;
    case 'rights': return `${BUILDINGS[a.id].name} · ${money(a.cost)}`;
    case 'build': return `${BUILDINGS[a.id].name} at ${coordinate(a.space,6)} · ${money(a.cost)}`;
    case 'income': return a.color ? `Collect ${money(a.gross)} and seat ${a.color} · 10 g` : `Collect ${money(a.gross)}`;
    case 'mine': return a.refill ? `Recruit ${a.refill} · ${money(a.cost)}, then draw` : 'Draw without buying a permit';
    case 'place-mine': case 'technology': return `${MINES[a.id].name} at mine ${coordinate(a.space,5)} · ${money(a.cost)}`;
    case 'barbara': return `Spend one pelican · ${BARBARA[currentBarbara(state)][0]}`;
    case 'house': return `Remove a ${GUILDS[a.id]} house`;
    case 'patrician': return `Seat ${a.color} directly`;
    case 'score-building': return `Score ${BUILDINGS[state.city[a.space].id].name} at ${coordinate(a.space,6)}`;
    case 'tax': return `Pay ${money(a.cost)}`;
    case 'penalty': return `Take −${a.loss} reputation`;
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
  if (a.kind==='barbara') return `<span>${BARBARA[currentBarbara(state)][1]}</span>`;
  return '';
}
function publicLink(id) {
  const rank=PATRICIANS.indexOf(id);
  return ['public neighbours','pairs of used pelicans','mines in every row','empty columns of houses'][rank];
}

function renderDashboard() {
  const event=eventNow(state);
  const title=state.phase==='end'?'Game complete':`Round ${state.round} of 6`;
  const rounds=Array.from({length:6},(_,i)=>`<span title="Round ${i+1}" class="round-dot ${i+1===state.round?'now':''} ${i+1<state.round?'done':''}"></span>`).join('');
  byId('dashboard').innerHTML=`<div class="round-label"><strong>${title}</strong><span class="round-dots" aria-hidden="true">${rounds}</span></div>
    <div class="event"><strong>${event?'Current event':'Town council'} · ${event?event.name:'Final round'}</strong><span>${event?event.detail:'Patricians score after taxes, followed by final scoring.'}</span></div>
    <div class="tax-label"><span>Tax rate</span><strong>${money(state.tax)}</strong></div>`;
}
function renderOverview() {
  const output=state.players.map((p,seat)=>{
    const {total}=scoreBreakdown(state,seat);
    return `<article class="player panel seat-${seat} ${state.actor===seat&&state.phase!=='end'?'on-move':''}">
      <div class="player-title"><span class="seat-mark" aria-hidden="true"></span><h2>${SEATS[seat]}</h2><span class="guild-line">${p.guilds.map(id=>GUILDS[id]).join(' · ')}</span></div>
      <div class="player-values">
        <span><b>${p.coins}</b><small><span class="metric-long">Groschen</span><span class="metric-short" aria-hidden="true">Cash</span></small></span><span><b>${income(state,seat)}</b><small>Income</small></span>
        <span><b>${p.rep}</b><small><span class="metric-long">Reputation</span><span class="metric-short" aria-hidden="true">Rep</span></small></span><span><b>${p.vp}</b><small><span class="metric-long">Earned VP</span><span class="metric-short" aria-hidden="true">VP</span></small></span>
      </div>
      <div class="player-foot"><span>${p.pelicans} unused pelican${p.pelicans===1?'':'s'} · ${p.pool} ready ${p.pool===1?'miner':'miners'}</span><span>${total} VP ${state.phase==='end'?'final':'if scored now'}</span></div>
      <button type="button" class="link board-link" data-do="player-board" data-value="${seat}" aria-label="View ${seat===0?'your':'the rival’s'} player board">Player board</button>
    </article>`;
  });
  byId('overview').innerHTML=output.join('')+`<section class="panel economy" aria-label="Commodity prices">
    <div class="economy-copy"><strong>Market prices</strong><small>Population ${state.pop} · Ore ${state.ore}</small></div>
    <div class="prices">${GOODS.map(g=>`<span class="price"><span class="commodity-sign commodity-${g}" aria-hidden="true">${signs[g]}</span><span>${COMMODITY[g]}</span><b>${price(state,g)}</b></span>`).join('')}</div>
  </section>`;
}
function nextHouseReward(row,removed) {
  const reward=HOUSE_EFFECTS[row][removed];
  if (!reward) return 'No houses left';
  const effects=[];
  if (reward.public) effects.push('Free public rights');
  if (reward.pelicans) effects.push(`${reward.pelicans} pelican`);
  if (reward.rep) effects.push(`+${reward.rep} reputation`);
  if (reward.vp) effects.push(`${reward.vp} VP`);
  return effects.join(' · ');
}
function renderPlayerBoard() {
  const p=state.players[boardSeat];
  byId('player-board-title').textContent=boardSeat===0?'Your player board':'Rival player board';
  const goods=GOODS.map(key=>`<tr><th scope="row">${COMMODITY[key]}</th><td>${p.production[key]}</td><td>${money(price(state,key))}</td><td>${money(p.production[key]*price(state,key))}</td></tr>`).join('');
  const houses=p.guilds.map((key,row)=>`<tr><th scope="row">${GUILDS[key]}</th><td>${4-p.houses[row]}</td><td>${nextHouseReward(row,p.houses[row])}</td></tr>`).join('');
  byId('player-board-body').innerHTML=`
    <table class="score-table" aria-label="Production and income">
      <thead><tr><th scope="col">Commodity</th><th scope="col">Production</th><th scope="col">Price</th><th scope="col">Income</th></tr></thead>
      <tbody>${goods}</tbody>
    </table>
    <table class="score-table" aria-label="Guild houses">
      <thead><tr><th scope="col">Guild</th><th scope="col">Houses left</th><th scope="col">Next build reward</th></tr></thead>
      <tbody>${houses}</tbody>
    </table>
    <p class="muted">Miners · ${p.pool} ready · ${p.reserve} in reserve</p>
    <p class="muted">Pelicans · ${p.pelicans} unused · ${p.usedPelicans} used</p>`;
}
function renderRivalHand() {
  const hand=state.players[1].hand;
  const cards=CARDS.filter((_,index)=>hand&(1<<index));
  const open=byId('rival-hand')?.open??true;
  return `<details id="rival-hand" class="panel rival-hand" ${open?'open':''}>
    <summary>Rival action cards <span class="fine">${cards.length} in hand</span></summary>
    <ul aria-label="Cards in the rival’s hand">${cards.map(pair=>`<li>${pair.map(kind=>LABEL[kind]).join(' / ')}</li>`).join('')}</ul>
  </details>`;
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
    const name=(MINES[id]??BUILDINGS[id]).name;
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
    return `<button type="button" class="card-action ${isPicked?'selected':''}" data-do="card" data-value="${card}/${kind}" aria-pressed="${isPicked}" ${available?'':'disabled'}>${LABEL[kind]}</button>`;
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
  const {scores,winner}=state.result;
  const title=winner===null?'A draw':winner===0?'You won':'The rival won';
  const tied=scores[0].total===scores[1].total && winner!==null;
  const lines=[['earned','Earned during play'],['town','Town adjacency'],['mines','Mine rows'],['income','Final income'],['reputation','Reputation'],['extras','Unused pieces'],['total','Total VP'],['coins','Groschen']];
  return `<h3 class="result-title">${title}</h3>${tied?'<p class="muted">Groschen decided the tie.</p>':''}<table class="score-table">
    <thead><tr><th scope="col">Score</th><th scope="col">You</th><th scope="col">Rival</th></tr></thead>
    <tbody>${lines.map(([key,label])=>`<tr class="${key==='total'?'total':''}"><th scope="row">${label}</th><td>${scores[0][key]}</td><td>${scores[1][key]}</td></tr>`).join('')}</tbody>
    </table><button type="button" class="primary fill" data-do="dialog" data-value="setup">New game</button>`;
}
function renderDecisions() {
  selections=[];
  let title='Your turn';
  let tag=state.phase==='action'?`${state.left} ${state.left===1?'card':'cards'} left`:'';
  let content='';
  if (state.phase==='end') {
    title='Final scoring';
    content=renderResult();
  } else if (state.actor===1) {
    title=state.phase==='tax'?'Rival taxes':'Rival turn';
    const what=state.phase==='tax'?'Resolve rival taxes':'Play rival turn';
    content=`<p class="muted">${state.phase==='tax'?'The rival decides whether to pay its taxes.':'The rival checks legal actions and plans what to do with its remaining cards.'}</p><button type="button" class="primary fill" data-do="rival" ${busy?'disabled aria-busy="true"':''}>${busy?'Rival is planning…':what}</button>`;
  } else if (state.phase==='tax') {
    title='Your taxes';
    content=renderChoices(legalActions(state),'Pay or lose reputation','Your choices include any plot surcharges.');
  } else if (state.pending.length) {
    tag='Resolve effect';
    content=renderPending(legalActions(state));
  } else content=renderCardChoices(legalActions(state));
  const last = state.log.filter(x=>x.actor===1).slice(-4).reverse();
  byId('decisions').innerHTML=`<section class="panel decision" aria-label="Turn actions"><div class="panel-head"><h2 id="turn-title" tabindex="-1">${title}</h2>${tag?`<span class="turn-tag">${tag}</span>`:''}</div>
    <div class="panel-body">${content}</div></section>
    ${state.phase==='end'?'':renderRivalHand()}
    ${rivalReport.length||last.length?`<section class="panel rival-report"><div class="panel-head"><h2>Rival notes</h2></div><ul>${(rivalReport.length?rivalReport.slice(0,6):last.map(x=>x.text)).map(row=>`<li>${safe(row)}</li>`).join('')}</ul></section>`:''}`;
}

function mapCell(value, i, columns, area) {
  const id=coordinate(i,columns);
  const tile=area==='town'?BUILDINGS[value?.id]:MINES[value?.id];
  const selectedAction=selections[choice];
  const matching=selections.findIndex(a=>a.space===i&&(
    area==='town'?['plot','build','score-building'].includes(a.kind):['place-mine','technology'].includes(a.kind)));
  const active=matching>=0&&selectedAction?.space===i;
  const owner=value?.owner!==undefined?value.owner:value?.plot;
  const tokenClass=owner===0?'human':owner===1?'rival':value?'neutral':'open';
  const classes=[`cell ${tokenClass}`,matching>=0?'target':'',active?'selected':'',value?.rock?'rock':'',
    area==='mine'&&MINE_ENTRANCES.includes(i)&&!value?'entrance':''].join(' ');
  const name=value?.rock?`Rock`:tile?.name??(value?'Reserved plot':area==='mine'&&MINE_ENTRANCES.includes(i)?'Entrance':'Open space');
  const title=`${area==='town'?'Town':'Mine'} ${id} · ${name}${owner===0?' · You':owner===1?' · Rival':''}${value?.rock?` · ${value.stars} ★`:''}`;
  const edge=area==='town'&&CITY_EDGE[i];
  const edgeMark=edge?`<span class="cell-edge" title="Board edge · ${dotLabels[edge]}"><span class="sr-only">Board edge</span>${dots({dots:edge})}</span>`:'';
  const details=area==='town'?dots(tile)+edgeMark:
    value?`<small>${value.stars} ★${tile?` · ${tile.extend}w`:''}</small>`:'';
  const prefix=matching>=0?`<button type="button" class="${classes}" data-do="option" data-value="${matching}" aria-label="${safe(`${title} · ${actionLabel(selections[matching])}`)}" aria-pressed="${active}"`:
    `<div class="${classes}"`;
  return `${prefix} title="${safe(title)}"><span class="cell-id">${id}</span>${value||area==='mine'&&MINE_ENTRANCES.includes(i)?`<b>${safe(name)}</b>`:''}${details}</${matching>=0?'button':'div'}>`;
}
function renderBoards() {
  const town=state.city.map((v,i)=>CITY[i]?mapCell(v,i,6,'town'):'<div class="void" aria-hidden="true"></div>').join('');
  const mine=state.mine.map((v,i)=>mapCell(v,i,5,'mine')).join('');
  const rows=Array.from({length:4},(_,i)=>{
    const row=mineRow(state,i);
    return `<span title="Row ${i+1}, ${row.total} total stars"><small>Row ${i+1}</small><b>${row.vp[0]} / ${row.vp[1]}</b></span>`;
  }).join('');
  byId('boards').innerHTML=`<section class="panel board" aria-label="Town board"><div class="panel-head"><h2>Town</h2><div class="legend"><span class="you-dot">You</span><span class="rival-dot">Rival</span><span class="public-dot">Public</span></div></div><div class="town-grid">${town}</div></section>
    <section class="panel board" aria-label="Mine board"><div class="panel-head"><h2>Mines</h2><span class="fine">Draw ${state.technology+1} · ${state.mineDeck.length} in stack</span></div>
    <div class="mine-grid">${mine}</div><div class="mine-scores"><span class="fine">Row VP<br>You / Rival</span>${rows}</div></section>`;
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
    return match>=0?`<button type="button" ${attributes} data-do="option" data-value="${match}" aria-label="${safe(title)}" aria-pressed="${selected}">${fields}</button>`:`<div ${attributes}>${fields}</div>`;
  }).join(''));
  const held=state.players.map((p,seat)=>`<div class="held-row"><span>${SEATS[seat]}</span><b>${p.held.length?p.held.map(id=>BUILDINGS[id].name).join(' · '):'—'}</b></div>`).join('');
  const baseValues=state.players.map((_,seat)=>patricianBase(state,seat));
  const patricians=PATRICIANS.map(color=>`<div title="Scores ${publicLink(color)}" class="council-row"><span class="patrician-${color}">${cap(color)}</span><span>${state.patrons[color]}</span><span>${state.council[color]}</span><strong>${baseValues[0][color]*state.council[color]} / ${baseValues[1][color]*state.council[color]}</strong></div>`).join('');
  const number=currentBarbara(state);
  byId('town-hall').innerHTML=`<section class="panel" aria-label="Building offer"><div class="panel-head"><h2>Town hall</h2><span class="fine">Available rights</span></div>
    <div class="market"><span class="sr-only">Tiles list the wood cost and stack count.</span>${heading}<div class="offer-grid">${rows.join('')}</div></div>
    <div class="holdings"><h3>Held rights</h3>${held}</div></section>
    <section class="panel council"><div class="panel-head"><h2>Council</h2><span class="fine">Scoring rounds 4–6</span></div><div class="panel-body">
    <div class="council-row council-head"><span>Patrician</span><span>Pool</span><span>Seated</span><span>VP¹</span></div>${patricians}<small class="fine">¹ You / Rival at current standing</small></div></section>
    <section class="panel cathedral"><div class="panel-head"><h2>St. Barbara</h2><span class="fine">${number===12?'Complete':`Tile ${number} of 11`}</span></div>
    <div class="panel-body"><strong>${BARBARA[number][0]}</strong><p>${BARBARA[number][1]}</p></div></section>`;
}
function renderJournal() {
  const button=byId('journal-toggle');
  button.textContent=allJournal?'Show recent':'Show all';
  button.setAttribute('aria-expanded',String(allJournal));
  const entries=(allJournal?state.log:state.log.slice(-6)).slice().reverse();
  byId('journal-body').innerHTML=`<ol class="log-list">${entries.map(item=>`<li><span class="log-round">R${item.round}</span><span class="log-seat seat-${item.actor}">${item.actor===null?'Town':SEATS[item.actor]}</span><span>${safe(item.text)}</span></li>`).join('')}</ol>`;
}
function render() {
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
  byId('undo').disabled=busy||undo.length===0;
  if (focused && !focus.isConnected) {
    const next=[...document.querySelectorAll('[data-do]')].find(el=>el.dataset.do===focused.action&&el.dataset.value===focused.value&&!el.disabled);
    if (next) next.focus({preventScroll:true});
  }
}
function saveUndo() {
  undo.push({state,rivalReport});
  if (undo.length>20) undo.shift();
}
function commit() {
  const a=selections[choice];
  if (!a || busy || state.actor!==0) return;
  const next=transition(state,a);
  saveUndo();
  state=next;
  resetSelection();
  writeLocal();
  render();
  byId('turn-title').focus({preventScroll:true});
}
function runRival() {
  if (busy||state.actor!==1||state.phase==='end') return;
  busy=true;
  render();
  const start=state;
  setTimeout(()=>{
    try {
      let next=start;
      const notes=[];
      let limit=20;
      while (limit-- && next.actor===1&&next.phase!=='end'&&next.round===start.round&&next.phase===start.phase&&next.turn===start.turn) {
        const action=botAction(next);
        if (!action) throw Error('No legal rival action.');
        const why=actionRationale(next,action);
        const previousEntries=next.log.length;
        next=transition(next,action);
        const entries=next.log.slice(previousEntries).filter(entry=>entry.actor===1).map(entry=>entry.text);
        if (entries.length) notes.push(...entries);
        if (why && ['rights','build','place-mine','technology','income'].includes(action.kind)) notes.push(why);
      }
      if (limit<0) throw Error('The rival’s turn did not finish.');
      saveUndo();
      state=next;
      rivalReport=notes;
      resetSelection();
      writeLocal();
    } catch (error) {
      say(error.message,true);
    } finally {
      busy=false;
      render();
      byId('turn-title').focus({preventScroll:true});
    }
  },24);
}
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
function fillSetup(changeSide=true) {
  const card=Number(byId('guild-setup').value);
  const select=byId('guild-side');
  const old=select.value||'0';
  if (changeSide) select.innerHTML=GUILD_SETUPS[card].map((guilds,i)=>`<option value="${i}">${guilds.map(id=>GUILDS[id]).join(' · ')}</option>`).join('');
  select.value=old;
  const guilds=GUILD_SETUPS[card][Number(select.value)];
  byId('guild-rows').innerHTML=guildOrders(guilds).map((order,i)=>`<option value="${i}">${order.map(id=>GUILDS[id]).join(' → ')}</option>`).join('');
  byId('opening-note').textContent=`Rival guild set (row order set by seed) · ${GUILD_SETUPS[card][1-Number(select.value)].map(id=>GUILDS[id]).join(' · ')}`;
}
function openDialog(kind) {
  if (kind==='setup') {
    const form=byId('setup-form');
    byId('guild-setup').innerHTML=Object.keys(GUILD_SETUPS).map(key=>`<option ${Number(key)===state.setup?'selected':''} value="${key}">Card ${key}</option>`).join('');
    form.elements.seed.value=randomSeed();
    form.elements.difficulty.value=state.difficulty;
    form.elements.starter.value='0';
    fillSetup();
    byId('guild-side').value=String(state.side);
    fillSetup(false);
  }
  byId(`${kind}-dialog`).showModal();
}
function downloadSave(contents,filename) {
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
  link.href=url;
  link.download=filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

byId('setup-form').addEventListener('submit',event=>{
  event.preventDefault();
  if (busy) return;
  const form=new FormData(event.currentTarget);
  const setup=Number(form.get('setup'));
  const side=Number(form.get('side'));
  saveUndo();
  state=createGame({setup,side,seed:form.get('seed'),starter:Number(form.get('starter')),difficulty:form.get('difficulty'),
    orders:[guildOrders(GUILD_SETUPS[setup][side])[Number(form.get('rows'))]],
  });
  rivalReport=[];
  resetSelection();
  writeLocal(true);
  byId('setup-dialog').close();
  render();
  if (!saveFailed) say('New game ready.');
});
byId('guild-side').addEventListener('change',()=>fillSetup(false));
byId('guild-setup').addEventListener('change',()=>fillSetup());
byId('file').addEventListener('change',async event=>{
  const file=event.currentTarget.files[0];
  event.currentTarget.value='';
  if (!file || busy) return;
  const previous=state;
  try {
    if (file.size>1_000_000) throw Error('That save is larger than 1 MB.');
    const next=readSave(await file.text());
    if (busy || state!==previous) throw Error('The game changed while the file was opening. Try importing again.');
    saveUndo();
    state=next;
    rivalReport=[];
    resetSelection();
    writeLocal(true);
    render();
    if (!saveFailed) say('Save imported.');
  } catch (error) {say(error instanceof SyntaxError?'This file does not contain valid save data.':error.message,true);}
});
document.addEventListener('change',event=>{
  if (event.target.id==='action-option') {
    choice=Number(event.target.value);
    render();
    byId('action-option')?.focus({preventScroll:true});
  }
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-do]');
  if (!button||button.disabled) return;
  const {do:action,value}=button.dataset;
  if (busy && !['dialog','close','journal','player-board','export','export-unreadable'].includes(action)) return;
  try {
    switch(action) {
      case 'dialog': openDialog(value); break;
      case 'player-board':
        boardSeat=Number(value);
        renderPlayerBoard();
        byId('player-board-dialog').showModal();
        break;
      case 'close': button.closest('dialog').close(); break;
      case 'seed': byId('setup-form').elements.seed.value=randomSeed(); break;
      case 'card': changeAction(...value.split('/')); break;
      case 'joker': cardPick.as=value; choice=0; selectionGroup=null; render(); break;
      case 'tile': selectionGroup=value; choice=0; render(); break;
      case 'option': choice=Number(value); render(); break;
      case 'commit': commit(); break;
      case 'rival': runRival(); break;
      case 'undo': {
        const previous=undo.pop();
        if (!previous) return;
        ({state,rivalReport}=previous);
        resetSelection();
        writeLocal();
        render();
        if (!saveFailed) say('Last move undone.');
        break;
      }
      case 'journal': allJournal=!allJournal; renderJournal(); break;
      case 'export': downloadSave(writeSave(state),'Kutna_Hora_Solo_Save.json'); break;
      case 'export-unreadable':
        if (unreadableSave!==null) downloadSave(unreadableSave,'Kutna_Hora_Unreadable_Save.json');
        break;
      case 'import': byId('file').click(); break;
    }
  } catch (error) {say(error.message,true);}
});
render();
