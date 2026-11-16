// Exercise the digital build. Pass firefox or webkit for another engine.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {MINCMISTR_RULES_VERSION,VERSION} from '../src/data.mjs';
import {botAction} from '../src/bot.mjs';
import {createGame,createPlanDeck,drawPlan,legalActions,taxCost,transition} from '../src/engine.mjs';
import {playMincmistr} from '../src/mincmistr.mjs';
import {readPosition,writeSave} from '../src/save.mjs';
import {digitalSmokeHtml} from './digital-smoke-html.mjs';

const playwright=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browserName=process.argv[2]??'chromium';
assert.ok(['chromium','firefox','webkit'].includes(browserName),'Choose chromium, firefox or webkit.');
const html=digitalSmokeHtml();
const GAME='kutna-hora-solo-v1';
const PAPER='kutna-hora-mincmistr-deck-v1';
const PLAYTEST_REPORT='.journal [data-do="report"]';
const RECOVERY_EXPORT='#save-status [data-do="report"]';
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
async function chooseFile(page,selector,contents,name) {
  const [chooser]=await Promise.all([
    page.waitForEvent('filechooser'),
    click(page,selector),
  ]);
  await chooser.setFiles({name,mimeType:'application/json',buffer:Buffer.from(contents)});
}
async function importGame(page,contents) {
  await page.locator('#flash').evaluate(el=>{el.textContent='';});
  await chooseFile(page,'footer [data-do="import"]',contents,'Position.json');
  await page.getByText('Save imported.',{exact:true}).waitFor();
}
async function downloadFile(page,selector) {
  const [download]=await Promise.all([page.waitForEvent('download'),click(page,selector)]);
  return {name:download.suggestedFilename(),text:await readFile(await download.path(),'utf8')};
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
  assert.doesNotMatch(await a.locator('#digital-game').innerText(),/playtest/i);
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

  const draft='This observation belongs to the current game.';
  await click(a,'.report-note summary');
  await a.locator('#playtest-note').fill(draft);
  await a.waitForFunction(({key,draft})=>JSON.parse(localStorage.getItem(key)).playtestNote===draft,{key:GAME,draft});
  await a.reload();
  assert.equal(await a.locator('#playtest-note').inputValue(),draft);
  await b.locator('#load-saved-game').waitFor();
  await click(b,'#load-saved-game');
  assert.equal(await b.locator('#playtest-note').inputValue(),draft);
  const otherGame=createGame({seed:drawn.seed,starter:1});
  await importGame(b,writeSave(otherGame));
  await a.locator('#load-saved-game').waitFor();
  const staleDraft='Extra detail from the older tab.';
  await a.locator('#playtest-note').fill(staleDraft);
  const staleCopy=readPosition((await downloadFile(a,RECOVERY_EXPORT)).text);
  assert.deepEqual(staleCopy.state,drawn);
  assert.equal(staleCopy.playtestNote,staleDraft);
  assert.deepEqual(await game(b),otherGame);
  await click(a,'#load-saved-game');
  assert.deepEqual(await game(a),otherGame);
  assert.equal(await a.locator('#playtest-note').inputValue(),'');
  assert.equal(JSON.parse((await downloadFile(a,PLAYTEST_REPORT)).text).playtest.note,'');
  await click(a,'#undo');
  await a.getByRole('heading',{name:'Place a mine',exact:true}).waitFor();
  assert.equal(await a.locator('#playtest-note').inputValue(),draft);
  assert.deepEqual(await game(a),drawn);
  console.log('PASS notes persist through reload, export from a stale tab and follow the loaded game or Undo');

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
  assert.equal(await a.locator('.review-rule').textContent(),'Rule 4.3 · Goal 1 Mine');
  assert.equal(await a.locator('#journal-body .journal-rule').textContent(),'Rule 4.3 · Goal 1 Mine');
  await click(a,'.review-plan');
  await a.locator('#plan-dialog[open]').waitFor();
  await click(a,'#plan-dialog summary');
  await a.getByText('Keep this Plan for the entire action and its bonuses.',{exact:false}).waitFor();
  await click(a,'#plan-dialog [data-do="close"]');
  await a.reload();
  await a.getByRole('heading',{name:'Rival 1 · Plan 4',exact:true}).waitFor();
  assert.equal(await a.locator('.review-rule').textContent(),'Rule 4.3 · Goal 1 Mine');
  await click(a,'#undo');
  await a.locator('#review-title').waitFor({state:'detached'});
  assert.deepEqual(await game(a),opening);
  await click(a,'[data-do="rival"]');
  await a.getByRole('heading',{name:'Your turn',exact:true}).waitFor();
  assert.ok((await game(a)).mincmistr.decks[0].discard.length>1);
  console.log('PASS one Plan includes its mine bonus, review, replay and fast rival batch');

  const roundEnd=await readFile(new URL('./fixtures/Round_End_Plan.json',import.meta.url),'utf8');
  await importGame(a,roundEnd);
  await click(a,'[data-do="rival-step"]');
  await a.getByRole('heading',{name:'Rival · Plan 13',exact:true}).waitFor();
  const planDelta=await a.locator('.plan-changes').textContent();
  assert.match(planDelta,/Ore 9 → 12/);
  assert.match(planDelta,/Ore production 2 → 5/);
  assert.match(planDelta,/Miner pool 0 → 1/);
  assert.match(planDelta,/Miner reserve 6 → 4/);
  assert.doesNotMatch(planDelta,/Pelicans|Ore 9 → 14/);
  const endReview=a.locator('.round-end-review');
  assert.match(await endReview.textContent(),/Cathedral Construction resolved/);
  assert.match(await endReview.textContent(),/Hammer Works/);
  assert.doesNotMatch(await a.locator('.review-actions').textContent(),/Cathedral Construction|Hammer Works/);
  assert.match(await endReview.textContent(),/Ore 12 → 14/);
  assert.match(await endReview.textContent(),/Rival · Pelicans 1 → 2/);
  await a.reload();
  assert.match(await endReview.textContent(),/Rival · Pelicans 1 → 2/);
  await click(a,'#undo');
  await endReview.waitFor({state:'detached'});
  assert.deepEqual(await game(a),JSON.parse(roundEnd).state);

  const marketExpansion=await readFile(new URL('./fixtures/Market_Expansion_Plan.json',import.meta.url),'utf8');
  const marketRemoval='The town expands silver supply and removes Smelter from the offer.';
  await importGame(a,marketExpansion);
  await click(a,'[data-do="rival-step"]');
  await a.locator('.review-actions').getByText(marketRemoval,{exact:true}).waitFor();
  await a.reload();
  await a.locator('.review-actions').getByText(marketRemoval,{exact:true}).waitFor();

  for (const [tile,expected] of [
    [3,['Beer production 0 → 2','Houses removed · Innkeepers 0 → 1']],
    [6,['Green patricians seated 0 → 1']],
  ]) {
    const position=createGame({seed:'browser-track-delta',playerCount:4,starter:1,difficulty:'mincmistr'});
    position.barbara=tile;
    position.players[1].pelicans=2;
    await importGame(a,writeSave(position));
    await click(a,'[data-do="rival-step"]');
    await a.locator('.plan-changes').waitFor();
    const delta=await a.locator('.plan-changes').textContent();
    for (const line of expected) assert.ok(delta.includes(line),line);
  }
  console.log('PASS Plan and round-end effects display their own market removals and resource changes');

  let lastPlan=createGame({seed:'zero-tax-with-surcharges',playerCount:4,starter:0,difficulty:'mincmistr',events:false});
  while (lastPlan.turn<11) {
    const actions=legalActions(lastPlan);
    const plot=lastPlan.turn===1 && actions.find(action=>action.kind==='plot' && !action.as);
    lastPlan=transition(lastPlan,plot || actions.find(action=>action.kind==='skip'));
  }
  lastPlan.players[3].coins=19;
  const beforeZero=playMincmistr(lastPlan);
  assert.equal(beforeZero.phase,'tax');
  assert.equal(beforeZero.actor,0);
  assert.deepEqual(beforeZero.players.map((_,i)=>taxCost(beforeZero,i)),[0,3,0,0]);
  const beforeSurcharge=transition(beforeZero,{kind:'tax',cost:0});
  await importGame(a,writeSave(lastPlan));
  await click(a,'[data-do="rival-step"]');
  await a.getByRole('heading',{name:'Rival 1 taxes',exact:true}).waitFor();
  assert.deepEqual(await game(a),beforeSurcharge);
  assert.match(await a.locator('.round-end-review').textContent(),/You · Paid 0 g in taxes/);
  await a.reload();
  await click(a,'#undo');
  await a.getByRole('heading',{name:'Rival 3 turn',exact:true}).waitFor();
  assert.deepEqual(await game(a),lastPlan);
  await importGame(a,writeSave(beforeZero)); // A save from before zero bills were automatic.
  assert.deepEqual(await game(a),beforeSurcharge);
  await click(a,'[data-do="rival-step"]');
  await a.getByRole('heading',{name:'Rival 1 turn',exact:true}).waitFor();
  const taxPaid=await game(a);
  assert.equal(taxPaid.round,2);
  assert.equal(taxPaid.players[1].coins,lastPlan.players[1].coins-3);
  assert.equal(taxPaid.log.filter(entry=>entry.text==='Paid 0 g in taxes.').length,3);
  console.log('PASS zero bills clear in order around a nonzero surcharge, with reload, Undo and older saves');

  const digitalPosition=await raw(a,GAME);
  const mobile=await browser.newContext({viewport:{width:360,height:800},hasTouch:true,acceptDownloads:true,
    isMobile:browserName!=='firefox'});
  const phone=observe(await mobile.newPage());
  await phone.goto(origin);
  await click(phone,'#guide-open-reference');
  const reference=phone.locator('#paper-reference[open]');
  await reference.getByRole('heading',{name:'The Mincmistr',exact:true}).waitFor();
  assert.deepEqual(await reference.locator('[data-reference]').allTextContents(),[
    'Reference cards','Table reference','Mine choice aid','Full rules','Guide',
  ]);
  await reference.getByRole('button',{name:'Guide',exact:true}).click();
  await reference.getByRole('heading',{name:'Playing Kutná Hora Solo',exact:true}).waitFor();
  assert.ok(!await reference.locator('#paper-ref-rules').isVisible());
  assert.ok(await reference.locator('.reference-body').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await reference.getByRole('button',{name:'Read rule 9',exact:true}).click();
  assert.equal(await phone.evaluate(()=>document.activeElement.id),'mincmistr-rule-9');
  await click(phone,'#paper-reference-close');
  await phone.getByRole('button',{name:'New game',exact:true}).click();
  const planner=phone.locator('#rival-difficulty option[value="planner"]');
  assert.equal(await planner.textContent(),'Planner');
  await click(phone,'#setup-dialog [data-do="close"]');
  console.log('PASS Guide opens the rules at 360 px, the fifth tab links back to rule 9, and Planner has its final label');
  for (const count of [2,4]) {
    let board=createGame({seed:'wrap-'+count,playerCount:count,difficulty:'standard'});
    while (board.round<(count===4?5:6) || board.actor!==0 || board.phase!=='action') {
      assert.notEqual(board.phase,'end');
      board=transition(board,botAction(board,'quick'));
    }
    await importGame(phone,writeSave(board));
    for (const width of [360,390,430]) {
      await phone.setViewportSize({width,height:800});
      await phone.evaluate(()=>document.fonts.ready);
      assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      const technology=phone.getByRole('button',{name:/^Inspect Mine .+ · Technology/}).first();
      await technology.locator('.cell-label-short').waitFor();
      assert.match(await technology.locator('.cell-label-short').textContent(),/^Tech [1-4]$/);
      if (count===4) {
        const plot=phone.locator('.cell[title*="Reserved plot"] .cell-label-short').first();
        assert.equal(await plot.textContent(),'Plot');
        assert.ok(await plot.isVisible());
      }
    }
  }
  await phone.setViewportSize({width:360,height:800});
  console.log('PASS readable plot and technology labels with full names available at 360–430 px');

  const doubleMine=createGame({seed:'browser-playtest-report',difficulty:'mincmistr',starter:1,playerCount:4,
    mincmistr:{level:'grandmaster',shared:false}});
  doubleMine.barbara=9;
  doubleMine.players[1].pelicans=1;
  await importGame(phone,writeSave(doubleMine));
  await click(phone,'[data-do="rival-step"]');
  const highlights=phone.locator('.cell.plan-changed');
  await highlights.last().waitFor();
  assert.equal(await highlights.count(),2);
  assert.equal(await phone.locator('.plan-changes .changed-space').count(),2);
  assert.match(await phone.locator('.plan-changes').textContent(),/Pelicans 1 → 0/);
  assert.match(await phone.locator('.plan-changes').textContent(),/St\. Barbara tile 9 → tile 10/);
  await phone.locator('.plan-changes .changed-space').first().click();
  assert.ok(await phone.evaluate(()=>document.activeElement.matches('.cell.plan-changed')));
  await click(phone,'.rival-review .plan-explanation summary');
  assert.match(await phone.locator('.rival-review .plan-explanation').textContent(),/Plan arrow/);
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await click(phone,'.review-rule [data-do="rule"]');
  await phone.locator('#paper-reference[open] #paper-ref-rules').waitFor();
  assert.equal(await phone.evaluate(()=>document.activeElement.id),'mincmistr-rule-4.2');
  assert.ok(await phone.locator('[id="mincmistr-rule-4.2"]').evaluate(el=>{
    const box=el.getBoundingClientRect(),frame=el.closest('.reference-body').getBoundingClientRect();
    return box.top>=frame.top-1&&box.bottom<=frame.bottom+1;
  }));
  await click(phone,'#paper-reference-close');
  assert.ok(await phone.locator('.rival-review .plan-explanation').evaluate(el=>el.open));
  const afterDoubleMine=await game(phone);
  await phone.reload();
  assert.equal(await highlights.count(),2);
  await click(phone,'.rival-review .plan-explanation summary');
  assert.match(await phone.locator('.rival-review .plan-explanation').textContent(),/Mine row gain|mine row gain/);
  await click(phone,'.report-note summary');
  await phone.locator('#playtest-note').fill('Both free mines resolved.');
  await phone.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).playtestNote==='Both free mines resolved.',GAME);
  await phone.reload();
  assert.equal(await phone.locator('#playtest-note').inputValue(),'Both free mines resolved.');
  const report=await downloadFile(phone,PLAYTEST_REPORT);
  assert.ok(report.name.startsWith(`Kutna_Hora_Game_Report_v${VERSION}_browser-playtest-report_`));
  const decodedReport=JSON.parse(report.text);
  assert.equal(decodedReport.playtest.note,'Both free mines resolved.');
  assert.equal(decodedReport.playtest.appVersion,VERSION);
  assert.equal(decodedReport.playtest.mincmistrRulesVersion,MINCMISTR_RULES_VERSION);
  assert.equal(decodedReport.playtest.setup.sharedDeck,false);
  assert.deepEqual(decodedReport.playtest.before.state,doubleMine);
  assert.deepEqual(decodedReport.state,afterDoubleMine);
  await click(phone,'#undo');
  await highlights.last().waitFor({state:'detached'});
  assert.deepEqual(await game(phone),doubleMine);
  const earlierVersions={appVersion:'0.3.7',mincmistrRulesVersion:'1.2.3'};
  const earlierReport={...decodedReport,playtest:{...decodedReport.playtest,...earlierVersions}};
  await importGame(phone,JSON.stringify(earlierReport));
  assert.deepEqual(await game(phone),afterDoubleMine);
  assert.equal(await highlights.count(),2);
  assert.equal(await phone.locator('#playtest-note').inputValue(),'Both free mines resolved.');
  assert.match(await phone.locator('#report-source-title').textContent(),/App v0\.3\.7 · Mincmistr v1\.2\.3/);
  assert.ok(await phone.locator('#report-exported-with').isHidden());
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  for (let transfer=0;transfer<2;transfer++) {
    const reexport=await downloadFile(phone,PLAYTEST_REPORT);
    const {state,playtest}=JSON.parse(reexport.text);
    assert.equal(playtest.appVersion,VERSION);
    assert.equal(playtest.mincmistrRulesVersion,MINCMISTR_RULES_VERSION);
    assert.deepEqual(playtest.source,earlierVersions);
    assert.deepEqual(state,afterDoubleMine);
    assert.equal(playtest.note,'Both free mines resolved.');
    assert.deepEqual(playtest.before.state,doubleMine);
    await importGame(phone,reexport.text);
    await phone.getByRole('heading',{name:'Original report · App v0.3.7 · Mincmistr v1.2.3'}).waitFor();
    assert.equal(await phone.locator('#report-exported-with').innerText(),`Re-exported with App v${VERSION} · Mincmistr v${MINCMISTR_RULES_VERSION}`);
  }

  const beforeFailedWrite=await raw(phone,GAME);
  await phone.evaluate(key=>{
    const write=Storage.prototype.setItem;
    window.restoreTestStorage=()=>{Storage.prototype.setItem=write;};
    Storage.prototype.setItem=function(name,value) {
      if (name===key && this===localStorage) throw new DOMException('Simulated write failure','QuotaExceededError');
      return write.call(this,name,value);
    };
  },GAME);
  const latestDraft='  Both free mines resolved.\nAdded while storage was unavailable.  ';
  await phone.locator('#playtest-note').fill(latestDraft);
  await phone.getByText('Autosave is unavailable.',{exact:false}).waitFor();
  const recovered=await downloadFile(phone,RECOVERY_EXPORT);
  assert.deepEqual(readPosition(recovered.text),{...readPosition(beforeFailedWrite),playtestNote:latestDraft});
  assert.equal(await raw(phone,GAME),beforeFailedWrite);
  await phone.evaluate(()=>window.restoreTestStorage());
  await importGame(phone,recovered.text);
  await phone.reload();
  assert.equal(await phone.locator('#playtest-note').inputValue(),latestDraft);
  assert.equal(await phone.locator('#report-exported-with').innerText(),`Re-exported with App v${VERSION} · Mincmistr v${MINCMISTR_RULES_VERSION}`);
  await click(phone,'#report-before');
  await phone.getByText('Position before the reported step loaded.',{exact:true}).waitFor();
  assert.deepEqual(await game(phone),doubleMine);
  assert.ok(await phone.locator('#report-before').isHidden());
  await phone.reload();
  await click(phone,'#undo');
  await phone.locator('#report-before').waitFor();
  assert.deepEqual(await game(phone),afterDoubleMine);
  assert.equal(await phone.locator('#playtest-note').inputValue(),latestDraft);
  await click(phone,'#report-before');
  await phone.getByText('Position before the reported step loaded.',{exact:true}).waitFor();
  await click(phone,'[data-do="rival-step"]');
  await highlights.last().waitFor();
  assert.deepEqual(await game(phone),afterDoubleMine);
  console.log('PASS 360 px Plan review, offline rules, repeated report transfer, failed-write recovery and replay with Undo');

  await phone.setViewportSize({width:390,height:844});
  await phone.goto(origin+'/#draw-only');
  const phoneGame=await raw(phone,GAME);
  await mobile.setOffline(true);
  for (let i=1;i<=16;i++) {
    await phone.locator('#paper-draw').tap();
    const number=(i-1)%15+1;
    await phone.getByText(`Draw ${number} of 15`,{exact:true}).waitFor();
  }
  assert.equal(await raw(phone,GAME),phoneGame);
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
  await click(phone,'[aria-controls="paper-ref-table"]');
  await phone.getByRole('heading',{name:'Mincmistr table reference',exact:true}).waitFor();
  await click(phone,'#paper-print-table');
  await phone.emulateMedia({media:'print'});
  assert.ok(await phone.locator('#paper-ref-table').isVisible());
  assert.ok(!await phone.locator('#paper-ref-mine').isVisible());
  assert.ok(!await phone.locator('#paper-face').isVisible());
  const printPage=await phone.evaluate(()=>{
    const style=getComputedStyle(document.documentElement);
    return {scheme:style.colorScheme,background:style.backgroundColor};
  });
  assert.deepEqual(printPage,{scheme:'light',background:'rgb(255, 255, 255)'});
  await phone.emulateMedia({media:'screen'});
  await phone.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await click(phone,'[data-reference][aria-controls="paper-ref-rules"]');
  await phone.getByRole('heading',{name:'10. Two or three Mincmistrs',exact:true}).waitFor();
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  assert.ok(await phone.locator('.reference-body').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await click(phone,'#paper-reference-close');
  assert.equal(await phone.locator('#paper-status').textContent(),shown);
  assert.equal(await raw(phone,PAPER),paperSave);
  const portable=await downloadFile(phone,'#paper-export-deck');
  assert.equal(portable.name,'Mincmistr_Plan_Deck.json');
  await mobile.close();
  console.log('PASS 390 px touch layout, both printable aids, offline references, recent Plans and reshuffle Undo');

  const receiver=await browser.newContext();
  const transferred=observe(await receiver.newPage());
  await transferred.goto(origin);
  await importGame(transferred,writeSave(doubleMine));
  const receiverGame=await raw(transferred,GAME);
  await transferred.goto(origin+'/#draw-only');
  await chooseFile(transferred,'#paper-import-deck',portable.text,portable.name);
  await transferred.getByText('Plan deck imported.',{exact:true}).waitFor();
  assert.equal(await raw(transferred,PAPER),paperSave);
  assert.equal(await raw(transferred,GAME),receiverGame);
  for (const count of [15,14]) {
    await click(transferred,'#paper-undo');
    await transferred.getByText(`Draw ${count} of 15`,{exact:true}).waitFor();
  }
  for (const count of [15,1]) {
    await click(transferred,'#paper-draw');
    await transferred.getByText(`Draw ${count} of 15`,{exact:true}).waitFor();
  }
  assert.equal(await raw(transferred,PAPER),paperSave);
  await chooseFile(transferred,'#paper-import-deck',report.text,report.name);
  await transferred.getByText('Choose a Mincmistr deck JSON export from Draw only.',{exact:true}).waitFor();
  assert.equal(await raw(transferred,PAPER),paperSave);
  assert.equal(await raw(transferred,GAME),receiverGame);
  await receiver.close();
  console.log('PASS Draw only portability, identical reshuffle replay and wrong-file rejection');

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
  await offlineFile.goto(new URL('../Kutna_Hora_Solo.html#draw-only',import.meta.url).href);
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
