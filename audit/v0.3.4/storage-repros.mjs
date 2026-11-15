// Executes the unmodified shipped HTML in jsdom; shared Storage models two same-origin tabs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const {JSDOM,VirtualConsole}=await import(process.env.JSDOM_MODULE??'jsdom');
import {createGame,createPlanDeck,drawPlan} from '../../src/engine.mjs';
import {writeSave,readSave} from '../../src/save.mjs';
const html=readFileSync(new URL('../../Kutna_Hora_Solo.html',import.meta.url),'utf8');
const P='kutna-hora-mincmistr-deck-v1',G='kutna-hora-solo-v1';
const findings=[];
function boot(store,hash='',blocked={value:false}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const {window:w}=new JSDOM(html,{url:'https://audit.invalid/'+hash,runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.Storage.prototype.getItem=function(k){if(blocked.value)throw new w.DOMException('temporarily blocked','SecurityError');return store.get(k)??null;};
  w.Storage.prototype.setItem=function(k,v){if(blocked.value)throw new w.DOMException('temporarily blocked','SecurityError');store.set(k,String(v));};
 }});
 return {w,errors,click:s=>w.document.querySelector(s).click(),text:s=>w.document.querySelector(s).textContent,close:()=>w.close()};
}
// Finding A: stale tabs silently rewind both modes.
{
 const deck=createPlanDeck('astra034-tabs',1);drawPlan(deck);const store=new Map([[P,JSON.stringify({deck,previous:null})]]);
 const a=boot(store,'#draw-only'),b=boot(store,'#draw-only');
 a.click('#paper-draw');a.click('#paper-draw');const newer=store.get(P);
 assert.equal(JSON.parse(newer).deck.discard.length,3);
 b.click('#paper-draw');const stale=store.get(P);
 assert.equal(JSON.parse(stale).deck.discard.length,2);
 assert.notEqual(stale,newer);assert.equal(b.w.document.querySelector('#paper-warning').hidden,true);
 findings.push({case:'two-paper-tabs',seed:'astra034-tabs',before:JSON.parse(newer).deck.discard.map(i=>i+1),after:JSON.parse(stale).deck.discard.map(i=>i+1),warning:b.text('#paper-warning')});
 a.close();b.close();
}
{
 const start=writeSave(createGame({seed:'astra034-tabs'}));const store=new Map([[G,start]]);const a=boot(store),b=boot(store);
 a.click('[data-do="card"][data-value="0/mine"]');a.click('[data-do="commit"]');a.click('[data-do="commit"]');
 const newer=store.get(G);assert.equal(readSave(newer).mine.filter(c=>c?.owner===0).length,1);
 b.click('[data-do="card"][data-value="0/mine"]');b.click('[data-do="commit"]');
 const stale=store.get(G);assert.equal(readSave(stale).mine.filter(c=>c?.owner===0).length,0);
 assert.equal(readSave(stale).pending[0].kind,'mine-place');
 findings.push({case:'two-digital-tabs',seed:'astra034-tabs',minesBefore:1,minesAfter:0,warning:b.text('#save-warning')});
 writeFileSync(new URL('./positions/two-tabs-before.json',import.meta.url),newer);writeFileSync(new URL('./positions/two-tabs-after.json',import.meta.url),stale);
 a.close();b.close();
}
// Finding B: a temporarily unreadable existing paper deck is replaced on the first draw after access returns.
{
 const deck=createPlanDeck('astra034-recovery',1);for(let i=0;i<8;i++)drawPlan(deck);
 const original=JSON.stringify({deck,previous:null}),store=new Map([[P,original]]),blocked={value:true};const a=boot(store,'#draw-only',blocked);
 assert.match(a.text('#paper-warning'),/could not be opened/);
 blocked.value=false;a.click('#paper-draw');
 assert.notEqual(store.get(P),original);assert.equal(JSON.parse(store.get(P)).deck.discard.length,1);
 assert.equal(a.w.document.querySelector('#paper-warning').hidden,true);
 findings.push({case:'paper-read-recovery',seed:'astra034-recovery',drawsBefore:8,drawsAfter:1,warning:a.text('#paper-warning')});
 a.close();
 // Nearby control: the full game retains a temporarily inaccessible prior save.
 const old=writeSave(createGame({seed:'astra034-protected'})),st=new Map([[G,old]]),fail={value:true};const b=boot(st,'',fail);
 fail.value=false;b.click('[data-do="card"][data-value="0/mine"]');b.click('[data-do="commit"]');assert.equal(st.get(G),old);assert.match(b.text('#save-warning'),/paused/);b.close();
}
writeFileSync(new URL('./results/storage-repros.json',import.meta.url),JSON.stringify(findings,null,2));
console.log(JSON.stringify(findings,null,2));
