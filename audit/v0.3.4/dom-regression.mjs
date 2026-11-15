// Synthetic DOM execution of the unmodified shipped HTML. Not browser rendering QA.
const {JSDOM,VirtualConsole}=await import(process.env.JSDOM_MODULE??'jsdom');
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,transition,legalActions} from '../../src/engine.mjs';
import {writeSave,readSave} from '../../src/save.mjs';
import {botAction} from '../../src/bot.mjs';
import {playMincmistr} from '../../src/mincmistr.mjs';
const html=fs.readFileSync(new URL('../../Kutna_Hora_Solo.html',import.meta.url),'utf8');
const KEY='kutna-hora-solo-v1', results=[];
function boot(saved,{failure=false}={}){
 const errors=[],downloads=[];
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://synthetic-audit.invalid/',runScripts:'dangerously',virtualConsole,beforeParse(w){
  // Browser API stubs only; shipped code and handlers are unchanged.
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:audit';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  if(saved!==undefined)w.localStorage.setItem(KEY,saved);
  if(failure)w.Storage.prototype.setItem=function(){throw new w.DOMException('Simulated quota exceeded','QuotaExceededError');};
 }});
 const w=dom.window,d=w.document;
 return {dom,w,d,errors,downloads,click(selector){const el=d.querySelector(selector);assert.ok(el,selector);assert.ok(!el.disabled,selector+' enabled');const modal=d.querySelector('dialog[open]');assert.ok(!modal||modal.contains(el),selector+' available during dialog');el.click();},save(){return w.localStorage.getItem(KEY);},game(){return readSave(w.localStorage.getItem(KEY));},close(){dom.window.close();}};
}
async function test(name,fn){if(process.env.ONLY_TEST&&!name.includes(process.env.ONLY_TEST))return;try{results.push({name,passed:true,detail:await fn()});}catch(e){results.push({name,passed:false,error:e.stack});}}
const blobText=(a,blob)=>new Promise((resolve,reject)=>{const reader=new a.w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsText(blob);});
const settle=()=>new Promise(r=>setTimeout(r,0));
function choose(a,s){a.click(`[data-do="card"][data-value="${s}"]`);}
async function importText(a,text){const file=a.d.getElementById('file');Object.defineProperty(file,'files',{value:[{size:text.length,text:async()=>text}],configurable:true});file.dispatchEvent(new a.w.Event('change',{bubbles:true}));await settle();}

await test('Normal move, pending move, Undo, reload and JSON export/import round trip',async()=>{
 const initial=writeSave(createGame({seed:'silver-1308'}));const a=boot(initial);
 choose(a,'0/mine');a.click('[data-do="commit"]');const pending=a.save();a.click('[data-do="commit"]');const placed=a.save();
 a.click('#undo');assert.equal(a.save(),pending);a.click('#undo');assert.equal(a.save(),initial);
 const b=boot(pending);assert.equal(b.d.querySelector('#turn-title').textContent,'Your turn');assert.match(b.d.querySelector('#decisions').textContent,/Place a mine/);
 b.click('[data-do="commit"]');assert.equal(b.save(),placed);
 b.click('[data-do="export"]');assert.equal(b.downloads.length,1);assert.equal(await blobText(b,b.downloads[0]),placed);
 await importText(b,initial);assert.equal(b.save(),initial);assert.equal(b.d.getElementById('flash').textContent,'Save imported.');
 const stable=b.save();await importText(b,'{broken');assert.equal(b.save(),stable);assert.match(b.d.getElementById('flash').textContent,/does not contain valid/);
 a.close();b.close();return {pendingReload:true,undoTwoSteps:true,exportBlobCreated:true,importValid:true,invalidImportPreservesState:true};
});
await test('Rival turn completes and Undo restores the entire rival turn',async()=>{
 const initial=writeSave(createGame({seed:'audit-rival-ui',starter:1}));const a=boot(initial);a.click('[data-do="rival"]');
 await new Promise(r=>setTimeout(r,200));assert.equal(a.game().actor,0);a.click('#undo');assert.equal(a.save(),initial);
 const detail={errors:a.errors,undoWholeTurn:true};a.close();return detail;
});
await test('New game setup controls work and Undo restores previous game',()=>{
 const initial=writeSave(createGame({seed:'audit-old'}));const a=boot(initial);a.click('[data-do="dialog"][data-value="setup"]');
 const form=a.d.getElementById('setup-form');form.elements.seed.value='audit-new';form.elements.starter.value='1';
 form.querySelector('button[type=submit]').click();assert.equal(a.game().seed,'audit-new');assert.equal(a.game().actor,1);a.click('#undo');assert.equal(a.save(),initial);a.close();
});
await test('Complete six-round game through shipped controls, every human apply agrees with engine',async()=>{
 const a=boot(writeSave(createGame({seed:'astra-v022-controls-full',setup:6,starter:1})));let count=0,human=0,rival=0,clicks=0;
 const trace=[];
 const click=selector=>{a.click(selector);clicks++;};
 while(a.game().phase!=='end'){
  assert.ok(++count<180);const g=a.game();
  if(g.actor===1){click('[data-do="rival"]');await new Promise(r=>setTimeout(r,80));assert.ok(a.save()!==writeSave(g));rival++;trace.push({round:g.round,actor:1,kind:'rival-turn'});continue;}
  const action=botAction(g,'builder');const expected=transition(g,action);let options=legalActions(g);
  if(g.phase==='action'&&!g.pending.length){
   click(`[data-do="card"][data-value="${action.card}/${action.as?'joker':action.kind}"]`);
   if(action.as)click(`[data-do="joker"][data-value="${action.as}"]`);
   options=options.filter(x=>x.card===action.card&&x.kind===action.kind&&(action.as?x.as:!x.as));
  }
  const tiles=a.d.querySelectorAll('[data-do="tile"]');
  if(tiles.length){
   const id=action.id??tiles[0].dataset.value;click(`[data-do="tile"][data-value="${id}"]`);
   options=options.filter(x=>x.kind==='skip'||x.id===id);
  }
  const index=options.findIndex(x=>JSON.stringify(x)===JSON.stringify(action));assert.ok(index>=0);
  const select=a.d.getElementById('action-option');
  if(select){select.value=String(index);select.dispatchEvent(new a.w.Event('change',{bubbles:true}));clicks++;}
  else if(a.d.querySelector(`[data-do="option"][data-value="${index}"]`))click(`[data-do="option"][data-value="${index}"]`);
  click('[data-do="commit"]');assert.deepEqual(a.game(),expected);human++;trace.push({round:g.round,actor:0,action});
 }
 assert.match(a.d.getElementById('decisions').textContent,/Final scoring/);assert.equal(a.errors.length,0);
 fs.writeFileSync(new URL('./evidence/controls-full-game.json',import.meta.url),JSON.stringify({trace,result:a.game().result,humanDecisions:human,rivalButtons:rival,inputOperations:clicks},null,2));
 fs.writeFileSync(new URL('./evidence/controls-final-save.json',import.meta.url),a.save());
 const detail={seed:a.game().seed,result:a.game().result,humanDecisions:human,rivalButtons:rival,inputOperations:clicks,errors:a.errors};a.close();return detail;
});

await test('Mine preview includes population and ore; applied result agrees',()=>{
 const a=boot(writeSave(createGame({seed:'silver-1308'})));choose(a,'0/mine');a.click('[data-do="commit"]');
 const info=a.d.querySelector('.choice-info').textContent;assert.match(info,/Population \+1/);assert.match(info,/Ore deck \+2/);
 const before=a.game();a.click('[data-do="commit"]');assert.equal(a.game().pop,before.pop+1);assert.equal(a.game().ore,before.ore+2);
 assert.deepEqual(a.errors,[]);a.close();return {info};
});
await test('Tavern regression: house-row preview, reputation 1 to 4, Undo and reload',async()=>{
 const fixture=fs.readFileSync(new URL('./fixtures/Tavern_House_Row_3.json',import.meta.url),'utf8');
 const a=boot();await importText(a,fixture);assert.equal(a.d.getElementById('flash').textContent,'Save imported.');
 a.click('[data-do="player-board"][data-value="0"]');assert.match(a.d.getElementById('player-board-body').textContent,/\+3 reputation/);
 a.click('#player-board-dialog [data-do="close"]');
 const g=a.game();const act=legalActions(g).find(x=>x.kind==='build'&&x.id==='tavern'&&!x.as);assert.ok(act);choose(a,`${act.card}/build`);
 const info=a.d.querySelector('.choice-info').textContent;assert.match(info,/Reputation \+3/);a.click('[data-do="commit"]');assert.equal(a.game().players[0].rep,4);
 const built=a.save();a.click('[data-do="player-board"][data-value="0"]');assert.match(a.d.getElementById('player-board-body').textContent,/\+4 reputation/);
 a.click('#player-board-dialog [data-do="close"]');
 const b=boot(built);assert.equal(b.game().players[0].rep,4);b.close();a.click('#undo');assert.equal(a.game().players[0].rep,1);
 assert.deepEqual(a.errors,[]);a.close();return {info,from:1,to:4,undo:1,reload:4};
});
await test('Unreadable autosave is protected, recoverable and visibly warned',async()=>{
 const damaged='{"kind":"kutna-hora-solo","state":';const a=boot(damaged);
 assert.match(a.d.getElementById('save-warning').textContent,/could not be opened/);assert.equal(a.save(),damaged);
 choose(a,'0/mine');a.click('[data-do="commit"]');assert.equal(a.save(),damaged);
 a.click('[data-do="export-unreadable"]');assert.equal(a.downloads.length,1);assert.equal(await blobText(a,a.downloads[0]),damaged);assert.deepEqual(a.errors,[]);a.close();
 return {oldBytesPreserved:true,recoveryBlobCreated:true,warning:true};
});
await test('Failed autosave warns and leaves old save intact',()=>{
 const initial=writeSave(createGame({seed:'silver-1308'}));const a=boot(initial,{failure:true});choose(a,'0/mine');a.click('[data-do="commit"]');
 assert.equal(a.save(),initial);assert.match(a.d.getElementById('save-warning').textContent,/Autosave is unavailable/);assert.match(a.d.getElementById('decisions').textContent,/Place a mine/);
 assert.deepEqual(a.errors,[]);a.close();return {visibleWarning:true,oldSavePreserved:true};
});
await test('New Game identifies seeded rival rows and Ius logs its actual discard count',async()=>{
 const a=boot();a.click('[data-do="dialog"][data-value="setup"]');
 for(const [id,value] of [['guild-setup','6'],['guild-side','1']]){const el=a.d.getElementById(id);el.value=value;el.dispatchEvent(new a.w.Event('change',{bubbles:true}));}
 assert.match(a.d.getElementById('opening-note').textContent,/row order set by seed/);
 a.click('#setup-dialog [data-do="close"]');
 const fixture=fs.readFileSync(new URL('../../test/fixtures/Ius_Regale_Short_Stack.json',import.meta.url),'utf8');await importText(a,fixture);
 const before=a.game();a.d.querySelector('.pass').open=true;a.d.querySelector('.pass button[data-do="card"]').click();a.click('[data-do="commit"]');
 assert.equal(a.game().round,2);assert.equal(a.game().ore,before.ore+2);assert.equal(a.game().mineDeck.length,0);
 assert.match(a.d.getElementById('journal-body').textContent,/Ius Regale Montanorum discarded 3 mine tiles\./);
 const b=boot(a.save());assert.match(b.d.getElementById('journal-body').textContent,/discarded 3 mine tiles/);assert.deepEqual(a.errors,[]);a.close();b.close();
 return {setupLabel:true,actualDiscardCount:3,reloadPreservesJournal:true};
});
const position=name=>fs.readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url),'utf8');
const details=a=>Object.fromEntries([...a.d.querySelectorAll('#tile-facts dt')].map(term=>[term.textContent,term.nextElementSibling.textContent]));
const closeTile=a=>a.click('#tile-dialog [data-do="close"]');
const nextHouse=(a,row)=>a.d.querySelectorAll('.house-track')[row].querySelector('.next');

await test('Tax shows the actual VP cost at, near and above the reputation floor',()=>{
 const cases=[{rep:-5,final:-5,vp:6},{rep:-4,final:-5,vp:4},{rep:0,final:-3,vp:0}];
 const observed=[];
 for(const {rep,final,vp} of cases) {
  const state=readSave(position('Tax_At_Reputation_Floor'));
  state.players[0].rep=rep;
  state.players[0].usedPelicans=2;
  state.bank.silver=2;
  state.council.silver=1;
  const a=boot(writeSave(state));
  a.click('[data-do="option"][data-value="1"]');
  const info=a.d.querySelector('.choice-info').textContent;
  const label=a.d.querySelector('[data-do="option"][data-value="1"]').textContent;
  if (vp) {
   assert.match(info,new RegExp('Lose '+vp+' VP for steps below −5'));
   assert.match(label,new RegExp('Lose '+vp+' VP'));
  } else {
   assert.match(info,/Reputation 0 → −3/);
   assert.match(info,/Final reputation score 0 → −1 VP/);
   assert.doesNotMatch(info,/steps below/);
  }
  if(rep===-5)assert.match(info,/Reputation stays at −5/);
  if(rep===-4)assert.match(info,/Reputation −4 → −5/);
  assert.doesNotMatch(info,/council/i);
  a.click('[data-do="commit"]');
  assert.equal(a.game().players[0].rep,final);
  assert.equal(a.game().players[0].vp,state.players[0].vp-vp+3);
  assert.deepEqual(a.errors,[]);
  observed.push({rep,info,label});a.close();
 }
 return observed;
});

await test('Tile 7 previews reputation, capped results, zero and the Joker fee',()=>{
 const cases=[{rep:0,gain:2,vp:0},{rep:8,gain:1,vp:2},{rep:9,gain:0,vp:4},{rep:0,gain:0,vp:0,zero:true},{rep:2,gain:1,vp:0,joker:true}];
 const results=[];
 for(const {rep,gain,vp,zero,joker} of cases) {
  const state=readSave(position('Barbara_7_Preview'));state.players[0].rep=rep;
  if(zero){state.city[27]=state.city[3];state.city[3]=null;}
  const a=boot(writeSave(state));
  if(joker){choose(a,'0/joker');a.click('[data-do="joker"][data-value="barbara"]');}else choose(a,'5/barbara');
  const info=a.d.querySelector('.choice-info').textContent;
  if(gain)assert.ok(info.includes('Reputation +'+gain),info);
  else assert.match(info,/Reputation stays at/);
  if(vp)assert.ok(info.includes('VP +'+vp),info);
  if(joker)assert.match(info,/Includes the Joker cost/);
  a.click('[data-do="commit"]');
  assert.equal(a.game().players[0].rep,rep+gain);
  assert.equal(a.game().players[0].vp,state.players[0].vp+vp);
  assert.deepEqual(a.errors,[]);a.close();results.push({rep,gain,vp,info});
 }
 return results;
});

await test('Market inspection uses a button and keeps the selected Rights target',()=>{
 const opening=writeSave(createGame({seed:'silver-1308'}));
 const a=boot(opening);
 const tile=a.d.querySelector('button[data-do="inspect"][data-value="market/bathhouse"]');
 assert.ok(tile);assert.equal(tile.getAttribute('aria-haspopup'),'dialog');
 tile.focus();assert.equal(a.d.activeElement,tile);tile.click();
 assert.equal(a.d.querySelector('#tile-dialog').open,true);
 assert.equal(a.d.querySelector('#tile-title').textContent,'Bathhouse');
 const before=details(a);
 assert.equal(before['Rights price'],'1 g');
 assert.match(before['Build cost'],/7 wood · 14 g/);
 assert.match(before['Printed effects'],/Beer production \+2/);
 assert.equal(before['Tiles in stack'],'4');
 assert.equal(a.save(),opening);closeTile(a);

 choose(a,'4/rights');
 const chosen=a.d.querySelector('.offer[data-do="option"][aria-pressed="true"]');
 assert.ok(chosen);
 const other=a.d.querySelector('.offer[data-do="option"][aria-pressed="false"]');
 assert.ok(other);
 const inspect=other.parentElement.querySelector('button[data-do="inspect"]');
 assert.ok(inspect);inspect.click();
 assert.equal(a.d.querySelector('#tile-title').textContent,other.querySelector('b').textContent);
 assert.equal(chosen.getAttribute('aria-pressed'),'true');
 assert.equal(other.getAttribute('aria-pressed'),'false');
 assert.equal(a.save(),opening);closeTile(a);
 const wanted=legalActions(a.game()).filter(act=>act.card===4&&act.kind==='rights')[Number(other.dataset.value)];
 other.click();a.click('[data-do="commit"]');
 assert.ok(a.game().players[0].held.includes(wanted.id));
 const held=a.d.querySelector(`button[data-value="held/0/${wanted.id}"]`);
 assert.ok(held);held.click();
 assert.equal(details(a)['Held by'],'You');
 assert.ok(!Object.hasOwn(details(a),'Rights price'));
 closeTile(a);
 assert.deepEqual(a.errors,[]);a.close();return {market:before,independentTarget:true,held:wanted.id};
});

await test('Placed town and mine inspection shows ownership, scoring and printed effects',()=>{
 const state=readSave(position('Barbara_7_Preview'));
 state.barbara=10;
 state.city[2].id='furnace';
 state.city[3].id='st-mary';
 for(const stack of state.market.flat())stack.tiles=stack.tiles.map(id=>id==='furnace'?'smelter':id==='st-mary'?'st-george':id);
 const a=boot(writeSave(state));
 a.click('button[data-value="town/2"]');
 const town=details(a);assert.equal(town['Owner'],'You');assert.equal(town['Town score now'],'3 VP');assert.equal(town['Location'],'Town C1');closeTile(a);
 a.click('button[data-value="town/3"]');
 assert.equal(details(a)['Owner'],'Public');assert.equal(details(a)['Matching dots'],'Silver, Red, Red');closeTile(a);
 choose(a,'5/barbara');a.click('[data-do="commit"]');
 const target=a.d.querySelector('.town-grid .cell.target[title*="Furnace"]');
 assert.ok(target);
 target.parentElement.querySelector('[data-do="inspect"]').click();
 assert.equal(details(a)['Town score now'],'3 VP');closeTile(a);
 a.click('[data-do="commit"]');assert.equal(a.game().players[0].vp,3);assert.deepEqual(a.errors,[]);a.close();

 const b=boot(writeSave(createGame({seed:'silver-1308'})));
 choose(b,'0/mine');b.click('[data-do="commit"]');b.click('[data-do="commit"]');
 b.click('button[data-value="mine/1"]');
 const mine=details(b);
 assert.equal(mine['Owner'],'You');assert.equal(mine['Expansion value'],'4 wood');
 assert.match(mine['Printed effects'],/Ore production and ore deck \+2 · Population \+1/);
 closeTile(b);assert.deepEqual(b.errors,[]);b.close();return {town,mine};
});

await test('Both player boards show every house reward and move the next marker after building',async()=>{
 const a=boot();await importText(a,position('Tavern_House_Row_3'));
 a.click('[data-do="player-board"][data-value="0"]');
 const row=a.d.querySelectorAll('.house-track')[2];
 assert.equal(row.getAttribute('aria-label'),'Innkeepers house rewards');
 assert.deepEqual([...row.children].map(el=>el.querySelector('span').textContent),['+1 reputation','+3 reputation','+4 reputation','8 VP']);
 assert.equal(row.querySelectorAll('.removed').length,1);
 assert.match(nextHouse(a,2).textContent,/\+3 reputation/);
 a.click('#player-board-dialog [data-do="close"]');
 choose(a,'2/build');a.click('[data-do="commit"]');
 a.click('[data-do="player-board"][data-value="0"]');
 assert.match(nextHouse(a,2).textContent,/\+4 reputation/);
 assert.equal(a.d.querySelectorAll('.house-track')[2].querySelectorAll('.removed').length,2);
 a.click('#player-board-dialog [data-do="close"]');
 a.click('[data-do="player-board"][data-value="1"]');
 for(const r of a.d.querySelectorAll('.house-track'))assert.equal(r.children.length,4);
 assert.deepEqual(a.errors,[]);a.close();return {you:12,rival:12,markerUpdated:true};
});

await test('Unavailability reasons and Undo lifetime appear in the shipped controls',()=>{
 const a=boot(writeSave(createGame({seed:'silver-1308'})));
 const reason=value=>{
  const button=a.d.querySelector(`[data-do="card"][data-value="${value}"]`);
  assert.ok(button.disabled);
  return button.querySelector('.card-reason').textContent;
 };
 assert.equal(reason('2/build'),'Need a right and a plot');
 assert.equal(reason('5/barbara'),'Need a pelican');
 choose(a,'4/rights');a.click('[data-do="commit"]');
 assert.equal(reason('2/build'),'Need a plot');assert.equal(reason('4/rights'),'Already played');
 a.click('[data-do="dialog"][data-value="help"]');
 assert.match(a.d.querySelector('#help-dialog').textContent,/Reloading clears Undo history/);
 a.click('#help-dialog [data-do="close"]');
 assert.ok(!a.d.getElementById('undo').disabled);
 const b=boot(a.save());assert.ok(b.d.getElementById('undo').disabled);
 assert.deepEqual(b.game(),a.game());
 assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);a.close();b.close();
 return {visibleReasons:true,guide:true,reload:true};
});

await test('v0.1.0 import still retains the original decks and corrects III-3',async()=>{
 const a=boot();
 const old=position('v0.1.0_III-3');await importText(a,old);
 assert.equal(a.d.querySelector('#flash').textContent,'Save imported.');
 assert.equal(a.game().mine.find(x=>x?.id==='m3-3').stars,2);
 assert.deepEqual(a.game().mineDeck,JSON.parse(old).state.mineDeck);
 assert.equal(a.game().setupVersion,1);assert.deepEqual(a.errors,[]);a.close();
});


function setField(a,field,value) {
 const el=a.d.getElementById('setup-form').elements[field];
 el.value=String(value);
 el.dispatchEvent(new a.w.Event('change',{bubbles:true}));
}
async function playNextRivals(a) {
 const initial=a.game();
 let expected=initial;
 const seats=new Set();
 while(expected.actor!==0&&expected.phase!=='end'){
   seats.add(expected.actor);
   expected=expected.mincmistr?playMincmistr(expected):transition(expected,botAction(expected));
 }
 a.click('[data-do="rival"]');
 for(let i=0;i<150&&a.game().actor!==0&&a.game().phase!=='end';i++)await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(a.game(),expected);
 return seats;
}

for(const [count,events,rounds,difficulty,level] of [[3,false,6,'quick'],[4,true,5,'planner'],[3,false,6,'mincmistr','master'],[4,true,5,'mincmistr','grandmaster']]) await test(`Complete a ${count}-player ${level??difficulty} game through the shipped controls`,async()=>{
 const a=boot();
 a.click('[data-do="dialog"][data-value="setup"]');
 setField(a,'playerCount',count);setField(a,'starter',1);setField(a,'setup',6);setField(a,'side',count-1);
 setField(a,'rows',2);setField(a,'seed',`app-table-${count}-${difficulty}`);setField(a,'difficulty',difficulty);
 if(level){
  assert.equal(a.d.getElementById('mincmistr-level-option').hidden,false);
  assert.equal(a.d.getElementById('mincmistr-deck-option').hidden,false);
  setField(a,'mincmistrLevel',level);
  setField(a,'mincmistrDecks',count===3?'individual':'shared');
  assert.equal(a.d.getElementById('mincmistr-tougher-option').hidden,count!==3);
  a.d.querySelector('#setup-form').elements.mincmistrTougher.checked=count===3;
 }
 assert.equal(a.d.querySelector('#setup-form').elements.starter.options.length,count);
 const eventBox=a.d.querySelector('#setup-form').elements.events;
 assert.equal(eventBox.disabled,false);
 eventBox.checked=events;
 a.click('#setup-form button[type=submit]');
 const opening=a.save();
 const game=a.game();
 assert.equal(game.players.length,count);
 assert.equal(game.difficulty,difficulty);
 if(level){
  assert.equal(game.mincmistr.level,level);
  assert.equal(game.mincmistr.shared,count===4);
  assert.equal(game.mincmistr.tougher,count===3);
  assert.match(a.d.querySelector('#rival-hand summary').textContent,/Mincmistr/);
  const cards=[...a.d.querySelectorAll('#rival-hand .rival-cards ul:first-of-type li')].slice(0,2).map(el=>el.textContent);
  assert.deepEqual(cards,['Mine / Joker','Rights / St. Barbara']);
 }
 assert.equal(game.side,count-1);
 assert.equal(game.events.length,events?rounds-1:0);
 assert.match(a.d.querySelector('#dashboard').textContent,new RegExp('Round 1 of '+rounds));
 assert.equal(a.d.querySelectorAll('#overview .player').length,count);
 assert.equal(a.d.querySelectorAll('.town-grid .cell').length,30);
 assert.equal(a.d.querySelectorAll('.mine-grid .cell').length,28);
 assert.equal(a.d.querySelectorAll('#rival-hand .rival-cards').length,count-1);
 assert.equal(a.d.querySelectorAll('.mine-scores tbody tr').length,count);
 for(let seat=1;seat<count;seat++){
  a.click(`[data-do="player-board"][data-value="${seat}"]`);
  assert.match(a.d.querySelector('#player-board-title').textContent,new RegExp('Rival '+seat+' player board'));
  assert.equal(a.d.querySelectorAll('.house-track li').length,12);
  a.click('#player-board-dialog [data-do="close"]');
 }
 const movers=await playNextRivals(a);
 if(level){
  assert.match(a.d.querySelector('#rival-hand').textContent,/Plan \d+ ·/);
  const alternative=boot(opening);
  await playNextRivals(alternative);
  assert.equal(alternative.save(),a.save());
  alternative.close();
 }
 assert.equal(movers.size,count-1);
 assert.equal(a.game().actor,0);
 a.click('#undo');
 assert.equal(a.save(),opening);
 let actions=0,batches=0;
 while(a.game().phase!=='end') {
  assert.ok(actions+batches<110,'No stalled turns');
  const g=a.game();
  if(g.actor!==0){await playNextRivals(a);batches++;continue;}
  let options=legalActions(g);
  const action=botAction(g,'builder');
  const expected=transition(g,action);
  if(g.phase==='action'&&!g.pending.length){
    choose(a,`${action.card}/${action.as?'joker':action.kind}`);
    if(action.as)a.click(`[data-do="joker"][data-value="${action.as}"]`);
    options=options.filter(x=>x.card===action.card&&x.kind===action.kind&&(action.as?x.as:!x.as));
  }
  const tileButtons=a.d.querySelectorAll('[data-do="tile"]');
  if(tileButtons.length){
    const id=action.id??tileButtons[0].dataset.value;
    a.click(`[data-do="tile"][data-value="${id}"]`);
    options=options.filter(x=>x.kind==='skip'||x.id===id);
  }
  const index=options.findIndex(x=>JSON.stringify(x)===JSON.stringify(action));
  assert.ok(index>=0);
  const select=a.d.getElementById('action-option');
  if(select) {
    select.value=String(index);
    select.dispatchEvent(new a.w.Event('change',{bubbles:true}));
  } else if(a.d.querySelector(`[data-do="option"][data-value="${index}"]`))a.click(`[data-do="option"][data-value="${index}"]`);
  a.click('[data-do="commit"]');
  assert.deepEqual(a.game(),expected);
  actions++;
 }
 assert.equal(a.game().round,rounds);
 if(level){
  const flips=a.game().log.filter(row=>/^Plan \d+ ·/.test(row.text));
  assert.equal(flips.length,count===3?68:90);
 }
 assert.equal(a.d.querySelectorAll('.final-score thead th').length,count+1);
 assert.equal(a.d.querySelectorAll('.final-score tbody .total td').length,count);
 assert.deepEqual(a.errors,[]);
 a.click('footer [data-do="export"]');
 const exported=await blobText(a,a.downloads[0]);
 assert.equal(exported,a.save());
 const b=boot();
 await importText(b,exported);
 assert.equal(b.d.querySelector('#flash').textContent,'Save imported.');
 assert.deepEqual(b.game(),a.game());
 assert.deepEqual(b.errors,[]);
 const result=a.game().result;
 a.close();b.close();
 return {count,rounds,actions,batches,scores:result.scores.map(s=>s.total),winners:result.winners};
});

await test('A real schema 2 game with a mine draw resumes from v0.2.3',async()=>{
 const original=fs.readFileSync(new URL('./fixtures/v0.2.3_Mine_Pending.json',import.meta.url),'utf8');
 const expected=JSON.parse(original).state;
 const a=boot();
 await importText(a,original);
 assert.equal(a.game().schema,3);
 assert.deepEqual(a.game(),{...expected,schema:3});
 assert.match(a.d.querySelector('#decisions').textContent,/Place a mine/);
 a.click('[data-do="commit"]');
 assert.equal(a.game().mine[1].owner,0);
 assert.deepEqual(a.errors,[]);
 a.close();
});

fs.writeFileSync(new URL(process.env.ONLY_TEST?'./evidence/dom-targeted-results.json':'./evidence/dom-results.json',import.meta.url),JSON.stringify(results,null,2));
for(const r of results) console.log(r.passed?'PASS':'FAIL',r.name,r.error??'');
if(results.some(x=>!x.passed))process.exitCode=1;
