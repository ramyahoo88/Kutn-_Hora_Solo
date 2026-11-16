import {createPlanDeck,drawPlan,validPlanDeck} from './engine.mjs';
import {describePlan,PLAN_DECK,PLAN_GOALS,PLAN_PRIORITIES} from './mincmistr.mjs';
import {downloadJson,storageSlot} from './storage.mjs';

const STORAGE = 'kutna-hora-mincmistr-deck-v1';
const DECK_FILE_KIND = 'kutna-hora-mincmistr-deck';
const UNDO_LIMIT = 5;
const RECENT_LIMIT = 5;
const byId = id => document.getElementById(id);
const goalText = {
  C: '<ol><li>Build if it holds a right and a plot.</li><li>Otherwise claim a plot if it holds more rights than plots and has fewer than three plots.</li><li>Otherwise buy an eligible guild right if it holds fewer than two rights.</li></ol>',
  M: 'Use a miner from its pool. If the pool is empty, pay for one permit and recruit as many available reserve miners as possible, up to two. With an empty pool, Mine is unavailable if it cannot pay or has no reserve miners. Otherwise, draw the normal number of tiles for the current technology level. Keep the most stars + ore + VP, then the most stars, then the first drawn. Place it using the mine choice aid (rule 6.4).',
  S: 'Spend a pelican and resolve the current St. Barbara tile.',
};

export function setPlanFace(face, plan) {
  const index = plan.number - 1;
  face.style.backgroundPosition = `${index % 3 * 50}% ${Math.floor(index / 3) * 25}%`;
}

export function showPlan(view, plan) {
  const face = view.querySelector('.printed-plan-face');
  setPlanFace(face,plan);
  face.setAttribute('aria-label', describePlan(plan));
  const {cash,pelicans,prizeTiles} = PLAN_PRIORITIES;
  const arrow = plan.arrow === 'low'
    ? '◀ Earliest space. Read from the top row down, left to right.'
    : '▶ Latest space. Read from the bottom row up, right to left.';
  view.querySelector('.plan-text').innerHTML = `<p><strong>Plan ${plan.number} of ${PLAN_DECK.length}</strong></p>
    <ol>
      <li>Take Income if it has fewer than ${cash} groschen.</li>
      <li>Take St. Barbara if it has at least ${pelicans} pelicans, or one on prize tile ${prizeTiles.slice(0,-1).join(', ')} or ${prizeTiles.at(-1)}.</li>
      <li>Try the goals below in order. Stop at the first possible goal.
        <ol>${plan.goals.map(goal => `<li><strong>${PLAN_GOALS[goal]}.</strong> ${goalText[goal]}</li>`).join('')}</ol>
      </li>
      <li>If neither goal is possible, take Income if possible. Otherwise, take a Mine action. If neither action is possible, discard the leftmost remaining action card with no effect.</li>
    </ol>
    <p><strong>Space ties.</strong> ${arrow}</p>
    <p>Skip any unavailable step. Use the leftmost matching action card. Never use the Joker. Keep this Plan for the entire action and its bonuses. Bonuses use no additional action card.</p>`;
}

function deckSnapshot(deck, recent = deck.discard.slice(-RECENT_LIMIT)) {
  return {deck,recent};
}

function freshDeck() {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return deckSnapshot(createPlanDeck(`paper-${seed.toString(36)}`,1));
}

function readSnapshot(record) {
  if (!validPlanDeck(record?.deck)) throw Error('Invalid saved Plan deck.');
  const {deck,recent} = record;
  const visible = deck.discard.slice(-RECENT_LIMIT);
  const validRecent = Array.isArray(recent) && visible.length > 0 &&
    recent.length >= visible.length && recent.length <= RECENT_LIMIT &&
    recent.every(id => Number.isInteger(id) && !!PLAN_DECK[id]) &&
    visible.every((id,i) => id === recent[recent.length - visible.length + i]);
  return validRecent ? {deck,recent} : deckSnapshot(deck);
}

function readDeck(raw, portable=false) {
  const saved = JSON.parse(raw);
  if (portable && (saved?.kind!==DECK_FILE_KIND || saved.version!==1 ||
      !Array.isArray(saved.history) || saved.history.length>UNDO_LIMIT)) {
    throw Error('Choose a Mincmistr deck JSON export from Draw only.');
  }
  const current = readSnapshot(saved);
  const history = [];
  if (Array.isArray(saved.history)) {
    for (const entry of saved.history.slice(-UNDO_LIMIT).reverse()) {
      try {
        history.unshift(readSnapshot(entry));
      } catch (error) {
        if (portable) throw error;
        break;
      }
    }
  } else if (validPlanDeck(saved.previous)) {
    // v0.3.4 saved only the deck immediately before the last draw.
    history.push(deckSnapshot(saved.previous));
    if (current.deck.discard.length === 1 && saved.previous.draw.length === 0) {
      current.recent = [...history[0].recent,current.recent[0]].slice(-RECENT_LIMIT);
    }
  }
  return {current,history};
}

function selectReference(section) {
  const dialog = byId('paper-reference');
  for (const button of dialog.querySelectorAll('[data-reference]')) {
    const id = button.getAttribute('aria-controls');
    button.setAttribute('aria-pressed',String(id===section));
    byId(id).hidden = id!==section;
  }
  dialog.querySelector('.reference-body').scrollTop = 0;
}

export function openReference(rule) {
  const dialog = byId('paper-reference');
  const target=rule?byId(`mincmistr-rule-${rule}`):null;
  if (target) selectReference('paper-ref-rules');
  if (!dialog.open) dialog.showModal();
  const body=dialog.querySelector('.reference-body');
  body.scrollTop=0;
  if (target) {
    body.scrollTop=target.getBoundingClientRect().top-body.getBoundingClientRect().top-12;
    target.focus({preventScroll:true});
  }
}

export function connectReference() {
  const dialog = byId('paper-reference');
  byId('paper-open-reference').addEventListener('click',() => openReference());
  for (const button of dialog.querySelectorAll('[data-reference]')) {
    button.addEventListener('click',() => selectReference(button.getAttribute('aria-controls')));
  }
  byId('paper-reference-close').addEventListener('click',() => dialog.close());
  const clearPrint=() => document.body.classList.remove('print-reference','print-mine-aid','print-table-reference');
  for (const [id,mode] of [['paper-print-mine','print-mine-aid'],['paper-print-table','print-table-reference']]) {
    byId(id).addEventListener('click',() => {
      clearPrint();
      document.body.classList.add('print-reference',mode);
      try { window.print(); } catch { clearPrint(); }
    });
  }
  dialog.addEventListener('close',clearPrint);
  window.addEventListener('afterprint',clearPrint);
}

export function startPaperDrawer() {
  const storage = storageSlot(STORAGE);
  const warning = byId('paper-warning');
  const draw = byId('paper-draw');
  const undo = byId('paper-undo');
  const confirm = byId('paper-confirm');
  const view = byId('paper-current');
  const recentList = byId('paper-recent-list');
  const recentView = byId('paper-plan-dialog');
  const deckFile = byId('paper-deck-file');
  const message = byId('paper-message');
  let current;
  let history = [];
  let unreadable = null;
  let unavailable = false;
  let conflict = false;
  let writing = false;

  function say(text,problem=false) {
    message.textContent=text;
    message.classList.toggle('error',problem);
  }

  function restore() {
    try {
      const raw = storage.read();
      unavailable = false;
      conflict = false;
      unreadable = null;
      if (raw === null) return;
      try { ({current,history} = readDeck(raw)); } catch { unreadable = raw; }
    } catch {
      unavailable = true;
    }
  }

  function renderStatus() {
    const message = conflict ? 'The saved deck changed. Load it before drawing or undoing.' :
      unavailable ? 'Deck storage is unavailable. Draws may be lost when you close or reload this tab.' :
      unreadable !== null ? 'The saved deck could not be opened. Import a deck or start a new one to resume autosave.' : '';
    if (warning.textContent !== message) warning.textContent = message;
    byId('paper-save-status').hidden = !message;
    byId('paper-load').hidden = !conflict && !unavailable;
    byId('paper-load').disabled = writing;
    byId('paper-export-unreadable').hidden = unreadable === null || conflict;
    draw.disabled = writing || conflict;
    undo.disabled = writing || conflict || history.length === 0;
    byId('paper-new').disabled = writing || conflict;
    byId('paper-import-deck').disabled = writing || conflict;
    byId('paper-export-deck').disabled = writing;
  }

  function render() {
    const {deck,recent} = current;
    const plan = PLAN_DECK[deck.discard.at(-1)];
    const count = deck.draw.length;
    byId('paper-status').textContent = `${plan?`Plan ${plan.number} · `:''}${count} ${count===1?'card':'cards'} left${count?'':' · Draw to reshuffle'}`;
    view.hidden = !plan;
    byId('paper-instruction').hidden = !!plan;
    if (plan) {
      byId('paper-draw-count').textContent = `Draw ${deck.discard.length} of ${PLAN_DECK.length}`;
      showPlan(view,plan);
    }
    recentList.innerHTML = recent.map((id,i) => {
      const number = PLAN_DECK[id].number;
      return `<li><button type="button" class="outline" data-recent="${i}" aria-haspopup="dialog" aria-label="View recent Plan ${number}">${number}</button></li>`;
    }).join('');
    byId('paper-recent').hidden = recent.length === 0;
    renderStatus();
  }

  async function update(next, nextHistory, replace = false) {
    if (conflict || writing) return false;
    const trigger = document.activeElement;
    writing = true;
    say('');
    renderStatus();
    const contents = unreadable !== null && !replace ? null : JSON.stringify({
      ...next,history:nextHistory,previous:nextHistory.at(-1)?.deck ?? null,
    });
    const result = await storage.write(contents,{replace});
    writing = false;
    conflict = result === 'conflict';
    if (conflict) {
      renderStatus();
      if (!byId('draw-only').hidden) byId('paper-load').focus();
      return false;
    }
    current = next;
    history = nextHistory;
    unavailable = result === 'unavailable';
    if (result === 'saved') unreadable = null;
    render();
    if (!byId('draw-only').hidden && [draw,undo,byId('paper-new')].includes(trigger) && document.activeElement === document.body) {
      (trigger.disabled?draw:trigger).focus({preventScroll:true});
    }
    return true;
  }

  restore();
  current ??= freshDeck();
  storage.watch(changed => {
    conflict = changed;
    renderStatus();
  });
  draw.addEventListener('click',() => {
    const {deck,recent} = current;
    const next = {rng:{...deck.rng},draw:[...deck.draw],discard:[...deck.discard]};
    const plan = drawPlan(next);
    update(deckSnapshot(next,[...recent,plan].slice(-RECENT_LIMIT)),[...history,current].slice(-UNDO_LIMIT));
  });
  undo.addEventListener('click',() => {
    if (history.length) update(history.at(-1),history.slice(0,-1));
  });
  byId('paper-load').addEventListener('click',() => {
    restore();
    render();
    if (!draw.disabled) draw.focus();
  });
  byId('paper-export-unreadable').addEventListener('click',() => {
    if (unreadable !== null) downloadJson(unreadable,'Mincmistr_Unreadable_Deck.json');
  });
  byId('paper-export-deck').addEventListener('click',() => {
    downloadJson(JSON.stringify({kind:DECK_FILE_KIND,version:1,...current,history}),'Mincmistr_Plan_Deck.json');
  });
  byId('paper-import-deck').addEventListener('click',() => deckFile.click());
  deckFile.addEventListener('change',async () => {
    const file=deckFile.files[0];
    deckFile.value='';
    if (!file || writing || conflict) return;
    const before=current;
    try {
      if (file.size>32_768) throw Error('That deck file is larger than 32 KB.');
      const imported=readDeck(await file.text(),true);
      if (writing || conflict || current!==before) throw Error('The deck changed while the file was opening. Try importing again.');
      if (await update(imported.current,imported.history,true)) {
        say('Plan deck imported.');
        if (!byId('draw-only').hidden) draw.focus();
      }
    } catch (error) {
      say(error instanceof SyntaxError?'This file does not contain valid deck data.':error.message,true);
    }
  });
  byId('paper-new').addEventListener('click',() => confirm.showModal());
  byId('paper-cancel').addEventListener('click',() => confirm.close());
  byId('paper-reset').addEventListener('click',() => {
    confirm.close();
    update(freshDeck(),[],true);
  });
  recentList.addEventListener('click',event => {
    const button = event.target.closest('button[data-recent]');
    if (!button) return;
    const plan = PLAN_DECK[current.recent[Number(button.dataset.recent)]];
    if (!plan) return;
    byId('paper-plan-title').textContent = `Plan ${plan.number}`;
    showPlan(recentView,plan);
    recentView.showModal();
  });
  byId('paper-plan-close').addEventListener('click',() => recentView.close());
  render();
}
