import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {MINE_FIELDS,MINES} from '../src/data.mjs';
import {createGame,legalActions,physicalPrompt,recordPhysicalDraw,transition} from '../src/engine.mjs';
import {playMincmistr} from '../src/mincmistr.mjs';
import {readSave,writeSave} from '../src/save.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const path=new URL('../Kutna_Hora_Solo.html',import.meta.url);
const html=await readFile(path);
const server=createServer((_,res)=>res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html));
const tabletopKey='kutna-hora-tabletop-v1';
const digitalKey='kutna-hora-solo-v1';
const digital=writeSave(createGame());
const errors=[];
let browser;

const face=id=>Object.fromEntries(MINE_FIELDS.map(field=>[field,MINES[id][field]]));

async function fillFace(form,index,id) {
  for (const [field,value] of Object.entries(face(id))) {
    await form.locator(`[name="${field}-${index}"]`).fill(String(value));
  }
}

function rivalMineSeed() {
  for (let i=0;i<50;i++) {
    const seed=`physical-rival-${i}`;
    const opening=createGame({tabletop:true,seed,difficulty:'mincmistr',starter:1});
    const turn=recordPhysicalDraw(opening,'cathedral');
    if (physicalPrompt(playMincmistr(turn))?.kind==='mine-draw') return seed;
  }
  throw Error('No mine opening found.');
}

try {
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE});
  const context=await browser.newContext({viewport:{width:360,height:820},hasTouch:true});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({key,state})=>{if (!localStorage.getItem(key)) localStorage.setItem(key,state);},{key:digitalKey,state:digital});
  const raw=key=>page.evaluate(key=>localStorage.getItem(key),key);
  const state=async()=>readSave(await raw(tabletopKey));
  const input=page.locator('#physical-draw');
  const url=`http://127.0.0.1:${server.address().port}`;
  async function importGame(game) {
    await page.locator('#file').setInputFiles({name:'Tabletop.json',mimeType:'application/json',buffer:Buffer.from(writeSave(game))});
    await page.getByText('Save imported.',{exact:true}).waitFor();
  }
  await page.goto(url);
  await page.getByRole('heading',{name:'Reveal an event'}).waitFor();
  await page.locator('#file').setInputFiles({name:'Digital.json',mimeType:'application/json',buffer:Buffer.from(digital)});
  await page.getByText('This edition uses physical draws.',{exact:false}).waitFor();
  assert.equal(await raw(digitalKey),digital);

  await page.getByRole('button',{name:'New game',exact:true}).click();
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button',{name:'Export previous digital save'}).click(),
  ]);
  assert.equal(await readFile(await download.path(),'utf8'),digital);
  const setup=page.locator('#setup-form');
  await setup.getByText('Physical setup checklist',{exact:true}).click();
  await setup.getByText('Match the top tiles and stack positions shown in Town hall.',{exact:false}).waitFor();
  await setup.getByText('Physical setup checklist',{exact:true}).click();
  await setup.locator('[name="starter"]').selectOption('1');
  await setup.locator('[name="difficulty"]').selectOption('mincmistr');
  await setup.locator('[name="seed"]').fill(rivalMineSeed());
  await setup.getByRole('button',{name:'Start game'}).click();
  await page.locator('#setup-dialog').waitFor({state:'hidden'});
  assert.equal((await state()).actor,1);
  assert.equal((await state()).difficulty,'mincmistr');
  await input.locator('[name="event"]').selectOption('cathedral');
  await input.getByRole('button',{name:'Confirm event'}).click();
  await input.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Play one Plan'}).click();
  await page.getByRole('heading',{name:'Rival needs a mine draw'}).waitFor();
  const pending=await state();
  assert.equal(pending.pending[0].kind,'mine-draw');
  assert.equal(pending.mincmistr.decks[0].discard.length,1);

  await page.reload();
  await page.getByRole('heading',{name:'Rival needs a mine draw'}).waitFor();
  assert.deepEqual(await state(),pending);
  for (const width of [320,360,390]) {
    await page.setViewportSize({width,height:820});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.ok((await input.locator('[name="stars-0"]').boundingBox()).height>=44);
  }
  const tile=MINES['m1-3'];
  await fillFace(input,0,tile.id);
  await input.locator('[name="extend-0"]').fill('9');
  await input.getByRole('button',{name:'Confirm mine draw'}).click();
  await page.getByText('Drawn tile 1 does not match an available tile.',{exact:false}).waitFor();
  assert.equal(await input.locator('[name="extend-0"]').inputValue(),'9');
  assert.deepEqual(await state(),pending);
  await input.locator('[name="extend-0"]').fill(String(tile.extend));
  await input.getByRole('button',{name:'Confirm mine draw'}).click();
  await page.locator('#physical-draw').waitFor({state:'detached'});
  const placed=await state();
  assert.equal(placed.mine.filter(cell=>cell?.id===tile.id).length,1);
  assert.deepEqual(placed.mincmistr.decks,pending.mincmistr.decks);
  assert.equal(JSON.parse(await raw(tabletopKey)).review.changes.mine.length,1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByRole('heading',{name:'Rival needs a mine draw'}).waitFor();
  assert.deepEqual(await state(),pending);
  assert.equal(await input.locator('[name="extend-0"]').inputValue(),'');
  console.log('Physical draw confirmed, rejected, reloaded and undone without flipping another Plan.');

  await page.getByRole('link',{name:'Draw only',exact:true}).click();
  await page.getByRole('button',{name:'Draw Plan',exact:true}).click();
  await page.getByRole('link',{name:'Tabletop game',exact:true}).click();
  await page.getByRole('heading',{name:'Rival needs a mine draw'}).waitFor();
  assert.deepEqual(await state(),pending);

  await page.getByRole('button',{name:'Guide',exact:true}).click();
  const guide=page.locator('#paper-reference');
  await guide.getByRole('button',{name:'Guide',exact:true}).click();
  await guide.getByRole('heading',{name:'Physical setup checklist',exact:true}).waitFor();
  await guide.getByRole('button',{name:'Close',exact:true}).click();

  const shortStack=readSave(await readFile(new URL('fixtures/Ius_Regale_Short_Stack.json',import.meta.url),'utf8'));
  shortStack.tabletop={events:true,unseenDiscards:[0,0,0]};
  shortStack.events=['code'];
  const beforeDiscard=transition(shortStack,legalActions(shortStack).find(move=>move.kind==='skip'));
  await importGame(beforeDiscard);
  const stackCount=page.locator('[aria-label="Mine board"] .panel-head .fine');
  assert.equal(await stackCount.textContent(),'Draw 1 · 3 in stack');
  await input.getByRole('button',{name:'Confirm discard'}).click();
  await page.getByRole('heading',{name:'Reveal an event'}).waitFor();
  assert.equal(await stackCount.textContent(),'Draw 1 · 0 in stack');
  await page.reload();
  assert.equal(await stackCount.textContent(),'Draw 1 · 0 in stack');
  await input.locator('[name="event"]').selectOption('abbey');
  await input.getByRole('button',{name:'Confirm event'}).click();
  await page.locator('[data-do="card"][data-value="0/mine"]').click();
  await page.locator('[data-do="commit"]').click();
  await input.getByText('Shuffle the discard pile, then draw 1 mine tile.',{exact:false}).waitFor();
  await fillFace(input,0,'m1-3');
  await input.getByRole('button',{name:'Confirm mine draw'}).click();
  await input.waitFor({state:'detached'});
  assert.equal(await stackCount.textContent(),'Draw 1 · 26 in stack');
  console.log('Mine-stack count follows a physical Ius Regale discard, reload and recycling.');

  const advanced=createGame({tabletop:true,playerCount:3,seed:'physical-entry-test'});
  advanced.technology=2;
  const draw=transition(advanced,legalActions(advanced).find(move=>move.kind==='mine'&&!move.as&&!move.refill));
  await importGame(draw);
  const ids=['m1-1','m1-2','m1-3'];
  await page.setViewportSize({width:320,height:820});
  const third=input.locator('.mine-entry').nth(2);
  const stars=third.getByRole('spinbutton',{name:'Stars',exact:true});
  const wood=third.getByRole('spinbutton',{name:'Wood beside or below'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal((await stars.boundingBox()).y,(await wood.boundingBox()).y);
  assert.ok((await wood.boundingBox()).width>=44);
  for (const [i,id] of ids.entries()) await fillFace(input,i,id);
  await wood.fill('9');
  const beforeEntry=await raw(tabletopKey);
  await page.reload();
  assert.equal(await raw(tabletopKey),beforeEntry);
  assert.equal(await wood.inputValue(),'9');
  await input.getByRole('button',{name:'Confirm mine draw'}).click();
  await third.getByText('Drawn tile 3 does not match an available tile.',{exact:false}).waitFor();
  assert.equal(await stars.evaluate(el=>el===document.activeElement),true);
  assert.equal(await raw(tabletopKey),beforeEntry);
  for (const [i,id] of ids.entries()) for (const [field,value] of Object.entries(face(id))) {
    assert.equal(await input.locator(`[name="${field}-${i}"]`).inputValue(),i===2&&field==='extend'?'9':String(value));
  }
  await stars.press('Enter');
  assert.equal(await third.getByRole('spinbutton',{name:'Ore production'}).evaluate(el=>el===document.activeElement),true);

  const other=await context.newPage();
  await other.goto(url);
  assert.equal(await other.locator('#physical-draw [name="extend-2"]').inputValue(),'');
  await other.locator('.report-note summary').click();
  await other.locator('#playtest-note').fill('Updated from a second tab.');
  await page.getByRole('button',{name:'Load saved game',exact:true}).waitFor();
  assert.equal(await input.getByRole('button',{name:'Confirm mine draw'}).isDisabled(),true);
  assert.equal(await wood.inputValue(),'9');
  await page.getByRole('button',{name:'Load saved game',exact:true}).click();
  assert.equal(await wood.inputValue(),'');
  await other.close();

  for (const [i,id] of ids.entries()) await fillFace(input,i,id);
  await wood.press('Enter');
  await input.waitFor({state:'detached'});
  assert.deepEqual((await state()).pending[0].drawn,ids);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await wood.waitFor();
  assert.equal(await wood.inputValue(),'');
  console.log('Mine drafts survive reload, focus the invalid tile, and clear on load or Undo.');

  const offline=await browser.newPage();
  await offline.goto(path.href);
  await offline.getByRole('heading',{name:'Reveal an event'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Separate save slots, Draw only and offline launch work.');
} finally {
  await browser?.close();
  server.close();
}
