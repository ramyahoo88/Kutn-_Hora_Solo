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
async function test(name,fn){try{results.push({name,passed:true,detail:await fn()});}catch(e){results.push({name,passed:false,error:e.stack});}}
const blobText=(a,blob)=>new Promise((resolve,reject)=>{const reader=new a.w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsText(blob);});
const settle=()=>new Promise(r=>setTimeout(r,0));
function choose(a,s){a.click(`[data-do="card"][data-value="${s}"]`);}
async function importText(a,text){const file=a.d.getElementById('file');Object.defineProperty(file,'files',{value:[{size:text.length,text:async()=>text}],configurable:true});file.dispatchEvent(new a.w.Event('change',{bubbles:true}));await settle();}


import {createGame as oldGame, transition as oldTransition} from '../../src/engine.mjs';
import {playMincmistr as oldMincmistr} from '../../src/mincmistr.mjs';
import {botAction as oldBot} from '../../src/bot.mjs';
import {writeSave as oldSave} from '../../src/save.mjs';

const embedded=html.match(/\.printed-plan-face[^\n]+url\(data:image\/webp;base64,([A-Za-z0-9+/=]+)\)/);
assert.ok(embedded,'The card art is bundled inline');
assert.deepEqual(Buffer.from(embedded[1],'base64'),fs.readFileSync(new URL('../../src/assets/mincmistr-plans.webp',import.meta.url)));
const fresh=boot();
assert.equal(fresh.d.querySelectorAll('[data-do="plan-card"]').length,0);
fresh.close();
const opening=oldSave(oldGame({difficulty:'mincmistr',seed:'mincmistr-faces',starter:1,playerCount:4, mincmistr:{level:'grandmaster'}}));
const a=boot(opening);
const faceLink='[data-do="plan-card"]';
assert.equal(a.d.querySelectorAll(faceLink).length,0,'No card face before a draw');
assert.equal(a.d.querySelectorAll('#rival-hand .rival-plan').length,4);
function inspectCard(ui,selector,seat,number){
  const stored=ui.save();
  assert.equal(ui.d.querySelector(selector).getAttribute('aria-haspopup'),'dialog');
  ui.click(selector);
  const dialog=ui.d.getElementById('plan-dialog');
  const face=ui.d.getElementById('printed-plan-face');
  assert.equal(dialog.open,true);
  assert.equal(ui.d.getElementById('plan-title').textContent,'Rival '+seat+'’s Plan '+number);
  assert.match(face.getAttribute('aria-label'),new RegExp('^Plan '+number+' · '));
  assert.equal(face.style.backgroundPosition,((number-1)%3)*50+'% '+Math.floor((number-1)/3)*25+'%');
  ui.click('#plan-dialog [data-do="close"]');
  assert.equal(dialog.open,false);
  assert.equal(ui.save(),stored,'Viewing leaves the save intact');
}
a.click('[data-do="rival"]');
for(let i=0;i<100&&a.game().actor!==0;i++)await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(a.game().actor,0,a.d.getElementById('flash').textContent);
const saved=a.save();
const state=a.game();
const expected=state.mincmistr.lastPlans;
assert.equal(a.d.querySelectorAll('#rival-hand '+faceLink).length,3);
for(const [index,plan] of expected.entries()){
  inspectCard(a,'#rival-hand '+faceLink+'[data-value="'+(index+1)+'/'+(plan+1)+'"]',index+1,plan+1);
}
a.click('#journal-toggle');
assert.equal(a.d.querySelectorAll('#journal-body '+faceLink).length,6);
const firstFlip=state.log.find(entry=>entry.actor===1&&/^Plan /.test(entry.text));
const firstNumber=Number(firstFlip.text.split(' ')[1]);
assert.notEqual(expected[0]+1,firstNumber);
inspectCard(a,'#journal-body '+faceLink+'[data-value="1/'+firstNumber+'"]',1,firstNumber);
a.click('#undo');
assert.equal(a.save(),opening);
assert.equal(a.d.querySelectorAll(faceLink).length,0);
a.click('[data-do="rival"]');
for(let i=0;i<100&&a.game().actor!==0;i++)await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(a.save(),saved,'Undo and replay draw the same cards');
assert.deepEqual(a.errors,[]);
a.close();

const b=boot();
let final=oldGame({difficulty:'mincmistr',seed:'mincmistr-faces-history',starter:1,playerCount:4,mincmistr:{level:'grandmaster'}});
while(final.phase!=='end')final=final.actor===0?oldTransition(final,oldBot(final,'quick')):oldMincmistr(final);
const archived=oldSave(final);
await importText(b,archived);
assert.equal(b.save(),archived,'v0.3.2 save imports unchanged');
b.click('#journal-toggle');
const all=[...b.d.querySelectorAll('#journal-body '+faceLink)].map(el=>el.dataset.value);
assert.equal(all.length,90);
assert.equal(new Set(all.map(value=>value.split('/')[1])).size,15);
for(let number=1;number<=15;number++){
  const match=all.find(value=>value.split('/')[1]===String(number));
  inspectCard(b,'#journal-body '+faceLink+'[data-value="'+match+'"]',Number(match.split('/')[0]),number);
}
assert.deepEqual(b.errors,[]);
b.close();
console.log('All 15 printed faces open correctly. Three latest Plan links, all 90 legacy journal draws, exact Undo and replay, and the offline image verified.');
