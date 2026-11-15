// Synthetic DOM execution of the unmodified shipped HTML. Not browser rendering QA.
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,transition,legalActions} from '../../src/engine.mjs';
import {writeSave,readSave} from '../../src/save.mjs';
import {botAction} from '../../src/bot.mjs';
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
 return {dom,w,d,errors,downloads,click(selector){const el=d.querySelector(selector);assert.ok(el,selector);assert.ok(!el.disabled,selector+' enabled');el.click();},save(){return w.localStorage.getItem(KEY);},game(){return readSave(w.localStorage.getItem(KEY));},close(){dom.window.close();}};
}
async function test(name,fn){try{results.push({name,passed:true,detail:await fn()});}catch(e){results.push({name,passed:false,error:e.stack});}}
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
 form.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(a.game().seed,'audit-new');assert.equal(a.game().actor,1);a.click('#undo');assert.equal(a.save(),initial);a.close();
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
 const g=a.game();const act=legalActions(g).find(x=>x.kind==='build'&&x.id==='tavern'&&!x.as);assert.ok(act);choose(a,`${act.card}/build`);
 const info=a.d.querySelector('.choice-info').textContent;assert.match(info,/Reputation \+3/);a.click('[data-do="commit"]');assert.equal(a.game().players[0].rep,4);
 const built=a.save();assert.match(a.d.getElementById('player-board-body').textContent,/\+4 reputation/);
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
 const fixture=fs.readFileSync(new URL('../../test/fixtures/Ius_Regale_Short_Stack.json',import.meta.url),'utf8');await importText(a,fixture);
 const before=a.game();a.d.querySelector('.pass').open=true;a.d.querySelector('.pass button[data-do="card"]').click();a.click('[data-do="commit"]');
 assert.equal(a.game().round,2);assert.equal(a.game().ore,before.ore+2);assert.equal(a.game().mineDeck.length,0);
 assert.match(a.d.getElementById('journal-body').textContent,/Ius Regale Montanorum discarded 3 mine tiles\./);
 const b=boot(a.save());assert.match(b.d.getElementById('journal-body').textContent,/discarded 3 mine tiles/);assert.deepEqual(a.errors,[]);a.close();b.close();
 return {setupLabel:true,actualDiscardCount:3,reloadPreservesJournal:true};
});
await test('QoL observation: Undo history is lost on reload although game state survives',()=>{
 const a=boot(writeSave(createGame({seed:'astra-v022-undo'})));choose(a,'0/mine');a.click('[data-do="commit"]');assert.equal(a.d.getElementById('undo').disabled,false);
 const b=boot(a.save());assert.deepEqual(b.game(),a.game());assert.equal(b.d.getElementById('undo').disabled,true);a.close();b.close();return {savedStateRestored:true,undoDisabledAfterReload:true};
});
await test('QoL observation: tile 7 gives generic text, not computed reputation',()=>{
 const g=createGame({seed:'astra-v022-tile7'});g.barbara=7;g.players[0].pelicans=1;
 const ids=['smelter','pump','st-george'];for(const row of g.market)for(const st of row)st.tiles=st.tiles.filter(id=>!ids.includes(id));g.market=g.market.map(row=>row.filter(st=>st.tiles.length));
 g.city[2]={id:'smelter',owner:0};g.city[3]={id:'st-george',owner:null};g.city[9]={id:'pump',owner:0};
 const save=writeSave(g);readSave(save);fs.writeFileSync(new URL('./fixtures/Barbara_7_Preview.json',import.meta.url),save);
 const a=boot(save);choose(a,'5/barbara');const info=a.d.querySelector('.choice-info').textContent;assert.doesNotMatch(info,/Reputation \+2|\+2 reputation/i);
 a.click('[data-do="commit"]');assert.equal(a.game().players[0].rep,g.players[0].rep+2);a.close();return {seed:g.seed,info,actualReputationGain:2};
});
await test('QoL observation: ordinary market entries expose effects only in hover title',()=>{
 const a=boot(writeSave(createGame({seed:'silver-1308'})));const entry=a.d.querySelector('.offer-grid .offer');assert.equal(entry.tagName,'DIV');assert.equal(entry.hasAttribute('tabindex'),false);
 assert.match(entry.title,/production|patrician/);assert.doesNotMatch(entry.textContent,/production|patrician/);
 const detail={tag:entry.tagName,title:entry.title,visibleText:entry.textContent};a.close();return detail;
});
await test('QoL observation: tax penalty has no preview of VP lost below the reputation floor',()=>{
 const a=boot(fs.readFileSync(new URL('./fixtures/Tax_At_Reputation_Floor.json',import.meta.url),'utf8'));
 const before=a.game();const options=legalActions(before);const i=options.findIndex(x=>x.kind==='penalty');assert.ok(i>=0);
 const select=a.d.getElementById('action-option');if(select){select.value=String(i);select.dispatchEvent(new a.w.Event('change',{bubbles:true}));}else a.click(`[data-do="option"][data-value="${i}"]`);
 const info=a.d.querySelector('.choice-info').textContent;assert.equal(info,'');assert.match(a.d.getElementById('decisions').textContent,/Take −3 reputation/);
 a.click('[data-do="commit"]');assert.equal(a.game().players[0].rep,-5);assert.equal(a.game().players[0].vp-before.players[0].vp,-6);a.close();return {seed:before.seed,round:6,rep:-5,preview:info,actualVpLoss:6};
});
fs.writeFileSync(new URL('./evidence/dom-results.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
if(results.some(x=>!x.passed))process.exitCode=1;
