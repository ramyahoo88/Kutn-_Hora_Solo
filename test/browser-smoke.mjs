// Run against the shipped HTML. Pass firefox or webkit for another engine.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {VERSION} from '../src/data.mjs';
import {createGame,createPlanDeck,drawPlan} from '../src/engine.mjs';
import {playMincmistr} from '../src/mincmistr.mjs';
import {writeSave} from '../src/save.mjs';

const playwright=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browserName=process.argv[2]??'chromium';
assert.ok(['chromium','firefox','webkit'].includes(browserName),'Choose chromium, firefox or webkit.');
const htmlPath=fileURLToPath(new URL('../Kutna_Hora_Solo.html',import.meta.url));
const html=await readFile(htmlPath);
const GAME='kutna-hora-solo-v1';
const PAPER='kutna-hora-mincmistr-deck-v1';
const server=createServer((request,response)=>{
  if (request.url!=='/') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);
});
const errors=[];
let browser;

function observe(page) {
  page.on('pageerror',error=>errors.push(error.message));
  return page;
}
const raw=(page,key)=>page.evaluate(key=>localStorage.getItem(key),key);
const saved=async (page,key)=>JSON.parse(await raw(page,key));
const game=async page=>(await saved(page,GAME)).state;
async function click(page,selector) {
  await page.locator(selector).click();
}
async function enabled(page,selector) {
  await page.locator(`${selector}:enabled`).waitFor();
}
async function importGame(page,contents) {
  const [chooser]=await Promise.all([
    page.waitForEvent('filechooser'),
    click(page,'footer [data-do="import"]'),
  ]);
  await chooser.setFiles({name:'Position.json',mimeType:'application/json',buffer:Buffer.from(contents)});
  await page.getByText('Save imported.',{exact:true}).waitFor();
}

try {
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  const launch={headless:process.env.HEADED!=='1'};
  if (process.env.BROWSER_EXECUTABLE) launch.executablePath=process.env.BROWSER_EXECUTABLE;
  browser=await playwright[browserName].launch(launch);
  const context=await browser.newContext({acceptDownloads:true});
  context.setDefaultTimeout(8000);
  const a=observe(await context.newPage());
  const b=observe(await context.newPage());
  await a.goto(origin);
  await b.goto(origin);
  assert.match(await a.locator('.eyebrow').textContent(),new RegExp(`v${VERSION.replaceAll('.','\\.')}$`));

  const initial=writeSave(createGame({seed:'browser-digital-conflict'}));
  await importGame(a,initial);
  await b.getByRole('button',{name:'Load saved game',exact:true}).waitFor();
  assert.ok(await b.locator('#undo').isDisabled());
  await click(b,'#load-saved-game');
  await click(a,'[data-value="0/mine"]');
  await click(a,'[data-do="commit"]');
  await a.getByRole('heading',{name:'Place a mine',exact:true}).waitFor();
  const drawn=await game(a);
  await click(a,'[data-do="commit"]');
  await a.locator('.action-prompt').waitFor();
  const placed=await raw(a,GAME);
  assert.ok((await game(a)).mine.some(tile=>tile?.owner===0));
  await b.getByText('The saved game changed.',{exact:false}).waitFor();
  assert.equal(await raw(b,GAME),placed);
  await click(b,'#load-saved-game');
  await b.reload();
  assert.ok(await b.locator('#undo').isEnabled());
  await click(b,'#undo');
  await b.getByRole('heading',{name:'Place a mine',exact:true}).waitFor();
  assert.deepEqual(await game(b),drawn);
  await a.getByRole('button',{name:'Load saved game',exact:true}).waitFor();
  await click(a,'#load-saved-game');
  const [download]=await Promise.all([
    a.waitForEvent('download'),
    click(a,'footer [data-do="export"]'),
  ]);
  assert.equal(download.suggestedFilename(),'Kutna_Hora_Solo_Save.json');
  const exported=await readFile(await download.path(),'utf8');
  assert.equal(exported,writeSave(drawn));
  await importGame(a,exported);
  console.log('PASS digital tabs, Undo after reload, file picker and save download');

  const opening=createGame({seed:'browser-mincmistr-bonus',difficulty:'mincmistr',starter:1,playerCount:4});
  const deck=opening.mincmistr.decks[0];
  deck.draw=[3,...deck.draw.filter(id=>id!==3)]; // Plan 4 starts with Mine.
  const pending=playMincmistr(opening);
  assert.equal(pending.pending[0].kind,'mine-place');
  await importGame(a,writeSave(opening));
  await click(a,'[data-do="rival-step"]');
  await a.getByRole('heading',{name:'Rival 1 · Plan 4',exact:true}).waitFor();
  const afterPlan=await game(a);
  assert.deepEqual(afterPlan,playMincmistr(pending));
  assert.equal(afterPlan.pending.length,0);
  assert.equal(afterPlan.mincmistr.decks[0].discard.length,1);
  await click(a,'.review-plan');
  await a.locator('#plan-dialog[open]').waitFor();
  await click(a,'#plan-dialog summary');
  await a.getByText('Keep this Plan for the entire action and its bonuses.',{exact:false}).waitFor();
  await click(a,'#plan-dialog [data-do="close"]');
  await a.reload();
  await a.getByRole('heading',{name:'Rival 1 · Plan 4',exact:true}).waitFor();
  await click(a,'#undo');
  await a.locator('#review-title').waitFor({state:'detached'});
  assert.deepEqual(await game(a),opening);
  await click(a,'[data-do="rival"]');
  await a.getByRole('heading',{name:'Your turn',exact:true}).waitFor();
  assert.ok((await game(a)).mincmistr.decks[0].discard.length>1);
  console.log('PASS one Plan includes its mine bonus, review, replay and fast rival batch');

  const digitalPosition=await raw(a,GAME);
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:browserName!=='firefox'});
  const phone=observe(await mobile.newPage());
  await phone.goto(origin+'/#draw-only');
  await mobile.setOffline(true);
  for (let i=1;i<=16;i++) {
    await phone.locator('#paper-draw').tap();
    const number=(i-1)%15+1;
    await phone.getByText(`Draw ${number} of 15`,{exact:true}).waitFor();
  }
  assert.equal(await raw(phone,GAME),null);
  const shown=await phone.locator('#paper-status').textContent();
  const paperSave=await raw(phone,PAPER);
  assert.equal((await saved(phone,PAPER)).history.length,5);
  assert.equal(await phone.locator('#paper-recent-list li').count(),5);
  await mobile.setOffline(false);
  await phone.reload();
  await click(phone,'#paper-undo');
  await phone.getByText('Draw 15 of 15',{exact:true}).waitFor();
  await click(phone,'#paper-undo');
  await phone.getByText('Draw 14 of 15',{exact:true}).waitFor();
  await click(phone,'#paper-draw');
  await phone.getByText('Draw 15 of 15',{exact:true}).waitFor();
  await click(phone,'#paper-draw');
  await phone.getByText('Draw 1 of 15',{exact:true}).waitFor();
  assert.equal(await phone.locator('#paper-status').textContent(),shown);
  assert.equal(await raw(phone,PAPER),paperSave);
  await phone.locator('#paper-recent-list button').first().click();
  await phone.locator('#paper-plan-dialog[open]').waitFor();
  await click(phone,'#paper-plan-close');
  await click(phone,'#paper-open-reference');
  assert.equal(await phone.locator('#paper-ref-cards .ref').count(),3);
  await click(phone,'[aria-controls="paper-ref-mine"]');
  await phone.getByRole('heading',{name:'Mincmistr mine choice aid',exact:true}).waitFor();
  assert.equal(await phone.locator('#paper-ref-mine tbody tr').count(),6);
  // Check the printed layout without invoking the OS print dialog.
  await phone.evaluate(()=>{window.print=()=>{};});
  await click(phone,'#paper-print-mine');
  await phone.emulateMedia({media:'print'});
  assert.ok(await phone.locator('#paper-ref-mine table').isVisible());
  assert.ok(!await phone.locator('#paper-face').isVisible());
  assert.ok(!await phone.locator('.reference-nav').isVisible());
  await phone.emulateMedia({media:'screen'});
  await phone.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await click(phone,'[aria-controls="paper-ref-rules"]');
  await phone.getByRole('heading',{name:'10. Two or three Mincmistrs',exact:true}).waitFor();
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  assert.ok(await phone.locator('.reference-body').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await click(phone,'#paper-reference-close');
  assert.equal(await phone.locator('#paper-status').textContent(),shown);
  assert.equal(await raw(phone,PAPER),paperSave);
  await mobile.close();
  console.log('PASS 390 px touch layout, offline references, recent Plans and reshuffle Undo');

  await a.goto(origin+'/#draw-only');
  await b.goto(origin+'/#draw-only');
  // Both pages observe the same empty deck slot before the first write.
  await a.getByText('15 cards left',{exact:true}).waitFor();
  await b.getByText('15 cards left',{exact:true}).waitFor();
  await click(a,'#paper-draw');
  await a.getByText('Draw 1 of 15',{exact:true}).waitFor();
  await b.getByRole('button',{name:'Load saved deck',exact:true}).waitFor();
  assert.ok(await b.locator('#paper-draw').isDisabled());
  const nextDeck=await raw(a,PAPER);
  await click(b,'#paper-load');
  await b.getByText('Draw 1 of 15',{exact:true}).waitFor();
  assert.equal(await raw(b,PAPER),nextDeck);
  assert.equal(await raw(b,GAME),digitalPosition);
  console.log('PASS Draw only tabs protect their own save slot');

  const recover=await browser.newContext();
  const recoveryDeck=createPlanDeck('browser-storage-recovery',1);
  for (let i=0;i<8;i++) drawPlan(recoveryDeck);
  const recoverySave=JSON.stringify({deck:recoveryDeck,previous:null});
  await recover.addInitScript(({key,value})=>{
    if (sessionStorage.getItem('read-failure-tested')) return;
    sessionStorage.setItem('read-failure-tested','yes');
    localStorage.setItem(key,value);
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(name) {
      if (name===key && this===localStorage) {
        Storage.prototype.getItem=get;
        throw new DOMException('Simulated read failure','SecurityError');
      }
      return get.call(this,name);
    };
  },{key:PAPER,value:recoverySave});
  const c=observe(await recover.newPage());
  await c.goto(origin+'/#draw-only');
  await c.getByText('Deck storage is unavailable.',{exact:false}).waitFor();
  await click(c,'#paper-draw');
  await c.getByText('The saved deck changed.',{exact:false}).waitFor();
  assert.equal(await raw(c,PAPER),recoverySave);
  await click(c,'#paper-load');
  await c.getByText('Draw 8 of 15',{exact:true}).waitFor();
  await click(c,'#paper-draw');
  await c.getByText('Draw 9 of 15',{exact:true}).waitFor();
  await enabled(c,'#paper-draw');
  await recover.close();
  console.log('PASS temporary storage failure preserves all eight existing draws');

  const offlineFile=observe(await context.newPage());
  await offlineFile.goto(pathToFileURL(htmlPath).href+'#draw-only');
  await click(offlineFile,'#paper-open-reference');
  await offlineFile.locator('#paper-ref-cards').waitFor();
  await click(offlineFile,'#paper-reference-close');
  await click(offlineFile,'#paper-draw');
  await offlineFile.getByText('Draw 1 of 15',{exact:true}).waitFor();
  assert.match(await offlineFile.locator('#paper-face').evaluate(el=>getComputedStyle(el).backgroundImage),/^url\("?data:image\/webp;base64,/);
  assert.deepEqual(errors,[]);
  console.log(`PASS standalone file and bundled artwork in ${browserName}`);
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
