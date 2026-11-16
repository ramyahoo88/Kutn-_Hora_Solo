// Run the shipped controls in a DOM harness. Browser layout and native dialogs
// are covered separately by browser-smoke.mjs.
import assert from 'node:assert/strict';
import {createGame,createPlanDeck,drawPlan,legalActions,transition} from '../src/engine.mjs';
import {playMincmistr} from '../src/mincmistr.mjs';
import {readPosition,readSave,writeSave} from '../src/save.mjs';
import {digitalSmokeHtml} from './digital-smoke-html.mjs';

const {JSDOM,VirtualConsole}=await import(process.env.JSDOM_MODULE??'jsdom');
const html=digitalSmokeHtml().toString('utf8');
const GAME='kutna-hora-solo-v1';
const PAPER='kutna-hora-mincmistr-deck-v1';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function boot(store=new Map(),{hash='',fail={read:false,write:false},locks}={}) {
  const errors=[],writes=[],reads=[],downloads=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error.message));
  const dom=new JSDOM(html,{url:'https://audit.invalid/'+hash,runScripts:'dangerously',virtualConsole,beforeParse(w) {
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    w.Storage.prototype.getItem=function(key){
      reads.push(key);
      if (fail.read) throw new w.DOMException('Read disabled in test','SecurityError');
      return store.get(key)??null;
    };
    w.Storage.prototype.setItem=function(key,value){
      if (fail.write) throw new w.DOMException('Write disabled in test','QuotaExceededError');
      writes.push(key);
      store.set(key,value);
    };
    w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:fixture';};
    w.URL.revokeObjectURL=()=>{};
    w.HTMLAnchorElement.prototype.click=function(){};
    w.print=()=>{};
    if (locks) Object.defineProperty(w.navigator,'locks',{value:locks});
  }});
  const w=dom.window,d=w.document;
  const get=selector=>d.querySelector(selector);
  return {
    w,d,get,writes,reads,downloads,
    text:selector=>get(selector)?.textContent,
    visible:selector=>!!get(selector) && !get(selector).closest('[hidden]'),
    game:()=>readSave(store.get(GAME)),
    deck:()=>JSON.parse(store.get(PAPER)),
    event:key=>w.dispatchEvent(new w.StorageEvent('storage',{key})),
    async click(selector) {
      const element=get(selector);
      assert.ok(element && !element.disabled && !element.closest('[hidden]'),selector+' is available');
      assert.ok(!get('dialog[open]') || get('dialog[open]').contains(element),selector+' is available within the dialog');
      element.click();
      await delay(0);
    },
    close() {assert.deepEqual(errors,[]);dom.window.close();},
  };
}

async function until(observed,check) {
  for (let i=0;i<100;i++) {
    if (check()) return;
    await delay(15);
  }
  assert.fail(observed);
}

async function selectMine(ui) {
  await ui.click('[data-value="0/mine"]');
  await ui.click('[data-do="commit"]');
}

async function downloadPosition(ui,selector) {
  await ui.click(selector);
  const contents=await new Promise((resolve,reject)=>{
    const reader=new ui.w.FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error);
    reader.readAsText(ui.downloads.at(-1));
  });
  return readPosition(contents);
}

// F1, digital game. Omit the storage event to exercise the pre-write check.
{
  const start=writeSave(createGame({seed:'astra034-tabs'}));
  const store=new Map([[GAME,start]]);
  const a=boot(store),b=boot(store);
  await selectMine(a);
  const drawn=a.game();
  assert.equal(drawn.pending[0].kind,'mine-place');
  await a.click('[data-do="commit"]');
  const placed=a.game(),newest=store.get(GAME);
  assert.ok(placed.mine.some(tile=>tile?.owner===0));
  await selectMine(b);
  assert.equal(store.get(GAME),newest);
  assert.deepEqual(b.writes,[]);
  assert.equal(b.get('[data-do="commit"]').disabled,true);
  assert.equal(b.visible('#load-saved-game'),true);
  await b.click('#load-saved-game');
  b.event(GAME); // Delayed notification for the value already loaded.
  assert.equal(b.visible('#save-status'),false);
  assert.equal(b.text('#flash'),'Saved game loaded.');
  b.close();a.close();
  const reloaded=boot(store);
  await reloaded.click('#undo');
  assert.deepEqual(reloaded.game(),drawn);
  await reloaded.click('#undo');
  assert.equal(writeSave(reloaded.game()),start);
  assert.equal(reloaded.get('#undo').disabled,true);
  reloaded.close();
  console.log('PASS stale digital tab, explicit recovery and two Undo steps after reload');
}

// F1, paper deck. Also check notifications and two serialized first writes.
{
  const deck=createPlanDeck('astra034-tabs',1);
  drawPlan(deck);
  const store=new Map([[PAPER,JSON.stringify({deck,previous:null})]]);
  const options={hash:'#draw-only'};
  const a=boot(store,options),b=boot(store,options);
  await a.click('#paper-draw');
  await a.click('#paper-draw');
  const newest=store.get(PAPER);
  assert.equal(a.deck().deck.discard.length,3);
  await b.click('#paper-draw');
  assert.equal(store.get(PAPER),newest);
  assert.equal(b.get('#paper-draw').disabled,true);
  await b.click('#paper-load');
  assert.equal(b.text('#paper-draw-count'),'Draw 3 of 15');
  await a.click('#paper-draw');
  b.event(PAPER);
  assert.ok(b.visible('#paper-load'));
  assert.equal(b.get('#paper-undo').disabled,true);
  assert.ok(a.reads.every(key=>key===PAPER));
  assert.ok(b.reads.every(key=>key===PAPER));
  b.close();a.close();

  let pending=Promise.resolve();
  const locks={request(_key,action) {const result=pending.then(action);pending=result;return result;}};
  const empty=new Map();
  const c=boot(empty,{...options,locks}),d=boot(empty,{...options,locks});
  await Promise.all([c.click('#paper-draw'),d.click('#paper-draw')]);
  assert.equal(c.writes.length+d.writes.length,1);
  assert.equal(d.visible('#paper-load'),true);
  assert.equal(c.deck().deck.discard.length,1);
  c.close();d.close();
  console.log('PASS stale Plan tab, notification and serialized first writes');
}

// F2. An unreadable slot must survive when storage later becomes accessible.
{
  const deck=createPlanDeck('astra034-recovery',1);
  for (let i=0;i<8;i++) drawPlan(deck);
  const before=JSON.stringify({deck,previous:null});
  const store=new Map([[PAPER,before]]),fail={read:true,write:false};
  const a=boot(store,{hash:'#draw-only',fail});
  assert.match(a.text('#paper-warning'),/storage is unavailable/);
  fail.read=false;
  await a.click('#paper-draw');
  assert.equal(store.get(PAPER),before);
  assert.match(a.text('#paper-warning'),/saved deck changed/);
  await a.click('#paper-load');
  assert.equal(a.text('#paper-draw-count'),'Draw 8 of 15');
  await a.click('#paper-draw');
  assert.equal(a.text('#paper-draw-count'),'Draw 9 of 15');
  assert.deepEqual(a.deck().deck.discard.slice(0,8),deck.discard);
  a.close();

  const broken=new Map([[PAPER,'{truncated']]);
  const b=boot(broken,{hash:'#draw-only'});
  await b.click('#paper-draw');
  assert.equal(broken.get(PAPER),'{truncated');
  assert.equal(b.visible('#paper-export-unreadable'),true);
  await b.click('#paper-export-unreadable');
  assert.equal(b.downloads.length,1);
  await b.click('#paper-new');
  await b.click('#paper-cancel');
  assert.equal(broken.get(PAPER),'{truncated');
  await b.click('#paper-new');
  await b.click('#paper-reset');
  assert.equal(b.deck().deck.draw.length,15);
  assert.equal(b.visible('#paper-save-status'),false);
  b.close();
  console.log('PASS temporarily blocked and corrupt decks preserve saved bytes');
}

// Draw history is independent, bounded, and exact across a reshuffle and reload.
{
  const digital=writeSave(createGame({seed:'deck-isolation'}));
  const store=new Map([[GAME,digital]]);
  const a=boot(store,{hash:'#draw-only'});
  let last;
  for (let i=0;i<17;i++) {
    await a.click('#paper-draw');
    if (i===14) assert.equal(new Set(a.deck().deck.discard).size,15);
    if (i===15) last=store.get(PAPER);
  }
  const deckAfter=store.get(PAPER);
  assert.equal(a.deck().recent.length,5);
  assert.equal(a.deck().history.length,5);
  a.close();
  const b=boot(store,{hash:'#draw-only'});
  await b.click('#paper-undo');
  assert.deepEqual(b.deck().deck,JSON.parse(last).deck);
  assert.deepEqual(b.deck().recent,JSON.parse(last).recent);
  assert.equal(b.deck().history.length,4);
  await b.click('#paper-undo');
  assert.equal(b.text('#paper-draw-count'),'Draw 15 of 15');
  await b.click('#paper-draw');
  await b.click('#paper-draw');
  assert.equal(store.get(PAPER),deckAfter);
  const shown=b.text('#paper-status');
  const claims=[...b.d.querySelectorAll('#paper-recent-list button')].map(button=>Number(button.textContent)-1);
  assert.deepEqual(claims,b.deck().recent);
  await b.click('#paper-recent-list button');
  assert.equal(b.get('#paper-plan-dialog').open,true);
  await b.click('#paper-plan-close');
  assert.equal(b.text('#paper-status'),shown);
  await b.click('#paper-open-reference');
  assert.equal(b.d.querySelectorAll('#paper-ref-cards .ref').length,3);
  await b.click('[aria-controls="paper-ref-mine"]');
  assert.equal(b.visible('#paper-ref-cards'),false);
  assert.ok(b.visible('#paper-ref-mine'));
  assert.deepEqual([...b.d.querySelectorAll('#paper-ref-mine tbody td:last-child')].map(td=>td.textContent),
    ['2 / 0','4 / 1','6 / 2','2 / 1 / 0','3 / 2 / 1','5 / 3 / 2']);
  await b.click('#paper-print-mine');
  assert.ok(b.d.body.classList.contains('print-mine-aid'));
  b.w.dispatchEvent(new b.w.Event('afterprint'));
  assert.ok(!b.d.body.classList.contains('print-mine-aid'));
  await b.click('[aria-controls="paper-ref-rules"]');
  assert.match(b.text('#paper-ref-rules'),/10\. Two or three Mincmistrs/);
  await b.click('#paper-reference-close');
  assert.match(b.text('#paper-current .plan-text'),/6, 7, 8, 9 or 11/);
  assert.equal(b.text('#paper-status'),shown);
  assert.equal(store.get(PAPER),deckAfter);
  assert.equal(store.get(GAME),digital);
  b.close();
  console.log('PASS legacy deck, five-step draw history, reshuffle, offline references and print controls');
}

// One Plan includes every nested choice, persists its explanation, and can be replayed.
for (const barbara of [1,9]) {
  const opening=createGame({seed:`review-dig-${barbara}`,playerCount:4,starter:1,difficulty:'mincmistr'});
  const deck=opening.mincmistr.decks[0];
  deck.draw=[3,...deck.draw.filter(id=>id!==3)];
  opening.barbara=barbara;
  if (barbara===9) opening.players[1].pelicans=1;
  const store=new Map([[GAME,writeSave(opening)]]);
  let expected=playMincmistr(opening);
  assert.ok(expected.pending.length);
  while (expected.pending.length) expected=playMincmistr(expected);
  const a=boot(store);
  await a.click('[data-do="rival-step"]');
  await until('single Plan completed',()=>a.get('#review-title'));
  assert.deepEqual(a.game(),expected);
  assert.equal(a.game().players[1].pool,barbara===9?1:0);
  assert.equal(a.game().mine.filter(tile=>tile?.owner===1).length,barbara===9?2:1);
  assert.equal(a.game().mincmistr.decks[0].discard.length,1);
  assert.match(a.text('#review-title'),/Rival 1 · Plan 4/);
  const reason=barbara===9?'Rule 4.2 · Pelicans → St. Barbara':'Rule 4.3 · Goal 1 Mine';
  assert.equal(a.text('.review-rule'),reason);
  assert.equal(a.text('#journal-body .journal-rule'),reason);
  await a.click('.review-plan');
  assert.match(a.text('#plan-dialog .plan-text'),/Keep this Plan for the entire action and its bonuses/);
  await a.click('#plan-dialog [data-do="close"]');
  const stepped=store.get(GAME);
  a.close();
  const b=boot(store);
  assert.equal(b.text('#review-title'),'Rival 1 · Plan 4');
  assert.equal(b.text('.review-rule'),reason);
  await b.click('#undo');
  assert.deepEqual(b.game(),opening);
  await b.click('[data-do="rival-step"]');
  await until('single Plan replayed',()=>b.get('#review-title'));
  assert.equal(store.get(GAME),stepped);
  assert.equal(b.text('.review-rule'),reason);
  await b.click('[data-do="rival"]');
  await until('rival batch returned to the player',()=>b.game().actor===0);
  let whole=expected;
  while (whole.actor!==0) whole=playMincmistr(whole);
  assert.deepEqual(b.game(),whole);
  b.close();
}
console.log('PASS one Plan, free double mine, continued rival batch and exact replay');

// If writing is unavailable, keep the original save and allow play plus export in this tab.
{
  const state=createGame({seed:'offline-quota'}),before=writeSave(state);
  const store=new Map([[GAME,before]]);
  const a=boot(store,{fail:{read:false,write:true}});
  await selectMine(a);
  assert.match(a.text('#decisions'),/Place a mine/);
  assert.match(a.text('#save-warning'),/Autosave is unavailable/);
  assert.equal(store.get(GAME),before);
  const after=await downloadPosition(a,'footer [data-do="export"]');
  assert.equal(a.downloads.length,1);
  assert.deepEqual(after.state,transition(state,legalActions(state).find(action=>action.kind==='mine'&&action.card===0)));
  a.close();

  const broken='{truncated';
  const protectedStore=new Map([[GAME,broken]]);
  const b=boot(protectedStore);
  const note=b.get('#playtest-note');
  note.value='A note typed while autosave was paused.';
  note.dispatchEvent(new b.w.Event('input'));
  const recovered=await downloadPosition(b,'#save-status [data-do="report"]');
  assert.deepEqual(recovered.state,createGame());
  assert.equal(recovered.playtestNote,note.value);
  assert.equal(protectedStore.get(GAME),broken);
  b.close();
  console.log('PASS recovery exports the current position and note while protecting unreadable or unwritable saves');
}
