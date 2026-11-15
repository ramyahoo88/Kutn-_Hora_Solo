const {JSDOM,VirtualConsole}=await import(process.env.JSDOM_MODULE??'jsdom');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createGame} from '../../src/engine.mjs';
import {writeSave} from '../../src/save.mjs';

const html=readFileSync(new URL('../../Kutna_Hora_Solo.html',import.meta.url),'utf8');
const GAME='kutna-hora-solo-v1';
const PAPER='kutna-hora-mincmistr-deck-v1';
const save=writeSave(createGame({seed:'paper-mode-digital-isolation',starter:1,difficulty:'mincmistr'}));
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));

function boot(hash,saved={},blocked=false){
  const touched=[],errors=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error.message));
  let raw;
  const {window:w}=new JSDOM(html,{
    url:'https://synthetic-audit.invalid/'+hash,runScripts:'dangerously',virtualConsole,
    beforeParse(w){
      w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
      w.HTMLDialogElement.prototype.close=function(){this.open=false;};
      const methods=w.Storage.prototype;
      const get=methods.getItem,set=methods.setItem;
      raw=key=>get.call(w.localStorage,key);
      Object.entries(saved).forEach(([key,value])=>set.call(w.localStorage,key,value));
      methods.getItem=function(key){
        touched.push(['get',key]);
        if(blocked) throw new w.DOMException('Storage unavailable','SecurityError');
        return get.call(this,key);
      };
      methods.setItem=function(key,value){
        touched.push(['set',key]);
        if(blocked) throw new w.DOMException('Storage unavailable','SecurityError');
        return set.call(this,key,value);
      };
    },
  });
  const d=w.document;
  const qs=selector=>d.querySelector(selector);
  return {
    w,d,qs,raw,touched,errors,close(){w.close();},
    click(selector){
      const el=qs(selector);
      assert.ok(el&&!el.disabled&&!el.closest('[hidden]'),selector+' is available');
      const modal=qs('dialog[open]');
      assert.ok(!modal||modal.contains(el),selector+' is available with modal open');
      el.click();
    },
    deck(){return JSON.parse(raw(PAPER)).deck;},
    draw(){
      this.click('#paper-draw');
      const deck=this.deck(), id=deck.discard.at(-1);
      assert.match(qs('#paper-status').textContent,new RegExp('^Plan '+(id+1)+' · '));
      assert.equal(qs('#paper-face').hidden,false);
      assert.match(qs('#paper-face').getAttribute('aria-label'),new RegExp('^Plan '+(id+1)+' · '));
      assert.equal(qs('#paper-face').style.backgroundPosition,(id%3)*50+'% '+Math.floor(id/3)*25+'%');
      return id;
    },
  };
}

const a=boot('#draw-only',{[GAME]:save});
assert.equal(a.qs('#digital-game').hidden,true);
assert.equal(a.qs('#dashboard').children.length,0);
assert.equal(a.qs('#draw-only').hidden,false);
assert.equal(a.qs('#paper-status').textContent,'15 cards left');
assert.equal(a.qs('#paper-face').hidden,true);
assert.equal(a.qs('#paper-undo').disabled,true);
assert.deepEqual(a.touched,[['get',PAPER]]);
const sort=ids=>ids.toSorted((x,y)=>x-y);
const allIds=Array.from({length:15},(_,id)=>id);
assert.deepEqual(sort(Array.from({length:15},()=>a.draw())),allIds);
assert.match(a.qs('#paper-status').textContent,/0 cards left · Draw to reshuffle$/);
const exhausted=a.deck();
const next=a.draw();
const shuffled=a.raw(PAPER);
assert.equal(a.deck().draw.length,14);
assert.equal(a.deck().discard.length,1);
assert.equal(a.raw(GAME),save);
assert.ok(a.touched.every(([,key])=>key===PAPER));

const b=boot('#draw-only',{[GAME]:save,[PAPER]:shuffled});
assert.equal(b.qs('#paper-undo').disabled,false);
assert.match(b.qs('#paper-status').textContent,new RegExp('^Plan '+(next+1)+' · 14 cards left$'));
b.click('#paper-undo');
assert.deepEqual(b.deck(),exhausted);
assert.match(b.qs('#paper-status').textContent,/0 cards left · Draw to reshuffle$/);
assert.equal(b.draw(),next);
assert.equal(b.raw(PAPER),shuffled);
assert.deepEqual(sort([next,...Array.from({length:14},()=>b.draw())]),allIds);

const before=b.raw(PAPER);
b.click('#paper-new');
assert.ok(b.qs('#paper-confirm').open);
b.click('#paper-cancel');
assert.equal(b.raw(PAPER),before);
b.click('#paper-new');
b.click('#paper-reset');
assert.equal(b.qs('#paper-status').textContent,'15 cards left');
assert.equal(b.qs('#paper-face').hidden,true);
assert.equal(b.qs('#paper-undo').disabled,true);
assert.deepEqual(sort(b.deck().draw),allIds);
assert.deepEqual(b.deck().discard,[]);

b.click('#paper-new');
b.w.location.hash='#digital-game';
await settle();
assert.equal(b.qs('#paper-confirm').open,false);
assert.equal(b.qs('#draw-only').hidden,true);
assert.equal(b.qs('#digital-game').hidden,false);
assert.ok(b.qs('#dashboard').children.length>0);
assert.equal(b.raw(GAME),save);
b.click('a[href="#draw-only"]');
await settle();
assert.equal(b.qs('#digital-game').hidden,true);
assert.equal(b.qs('#draw-only').hidden,false);
assert.equal(b.qs('#paper-status').textContent,'15 cards left');
b.draw();
b.click('a[href="#digital-game"]');
await settle();
assert.equal(b.qs('#draw-only').hidden,true);
assert.equal(b.raw(GAME),save);
assert.deepEqual(b.touched.filter(([,key])=>key===GAME),[['get',GAME]]);
assert.deepEqual(a.errors,[]);
assert.deepEqual(b.errors,[]);
a.close();b.close();

const c=boot('#draw-only',{[PAPER]:'{bad'});
assert.match(c.qs('#paper-warning').textContent,/new deck/);
c.draw();
assert.equal(c.qs('#paper-warning').hidden,true);
c.close();
const d=boot('#draw-only',{},true);
d.click('#paper-draw');
assert.equal(d.qs('#paper-face').hidden,false);
assert.match(d.qs('#paper-warning').textContent,/until this page closes or reloads/);
assert.ok(d.touched.every(([,key])=>key===PAPER));
assert.deepEqual(d.errors,[]);
d.close();

const embedded=html.match(/\.printed-plan-face[^\n]+url\(data:image\/webp;base64,([A-Za-z0-9+/=]+)\)/);
assert.ok(embedded);
assert.deepEqual(Buffer.from(embedded[1],'base64'),readFileSync(new URL('../../src/assets/mincmistr-plans.webp',import.meta.url)));
console.log('Draw only verified in the shipped HTML. 30 draws, all 15 printed faces, reshuffle, exact undo after reload, confirmed reset, direct entry, mode switches, storage failure and digital save isolation.');
