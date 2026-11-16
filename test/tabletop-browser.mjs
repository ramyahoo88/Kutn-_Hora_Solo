import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {MINE_FIELDS,MINES} from '../src/data.mjs';
import {createGame,physicalPrompt,recordPhysicalDraw} from '../src/engine.mjs';
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
  const page=await browser.newPage({viewport:{width:360,height:820},hasTouch:true});
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({key,state})=>{if (!localStorage.getItem(key)) localStorage.setItem(key,state);},{key:digitalKey,state:digital});
  const raw=key=>page.evaluate(key=>localStorage.getItem(key),key);
  const state=async()=>readSave(await raw(tabletopKey));
  const input=page.locator('#physical-draw');
  await page.goto(`http://127.0.0.1:${server.address().port}`);
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
  for (const field of MINE_FIELDS) await input.locator(`[name="${field}-0"]`).fill(String(tile[field]));
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
  console.log('Physical draw confirmed, rejected, reloaded and undone without flipping another Plan.');

  await page.getByRole('link',{name:'Draw only',exact:true}).click();
  await page.getByRole('button',{name:'Draw Plan',exact:true}).click();
  await page.getByRole('link',{name:'Tabletop game',exact:true}).click();
  await page.getByRole('heading',{name:'Rival needs a mine draw'}).waitFor();
  assert.deepEqual(await state(),pending);
  const offline=await browser.newPage();
  await offline.goto(path.href);
  await offline.getByRole('heading',{name:'Reveal an event'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Separate save slots, Draw only and offline launch work.');
} finally {
  await browser?.close();
  server.close();
}
