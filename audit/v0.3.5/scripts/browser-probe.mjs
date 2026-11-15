// Extra Chromium probes of the shipped HTML (beyond test/browser-smoke.mjs).
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = new URL('../results/browser/', import.meta.url).pathname;
await mkdir(OUT, {recursive: true});
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const E = await import(ROOT + 'src/engine.mjs');
const {writeSave, readSave} = await import(ROOT + 'src/save.mjs');
const {PLAN_DECK} = await import(ROOT + 'src/mincmistr.mjs');
const html = await readFile(ROOT + 'Kutna_Hora_Solo.html');
const GAME = 'kutna-hora-solo-v1', PAPER = 'kutna-hora-mincmistr-deck-v1';
const server = createServer((q, r) => q.url === '/' ? r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}).end(html) : r.writeHead(404).end());
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch();
const results = [];
const errors = [];
const log = (name, ok, detail = '') => { results.push({name, ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); };
const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); return page; };
const raw = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const stored = async page => JSON.parse(await raw(page, GAME));
async function importSave(page, text) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('footer [data-do="import"]').click()]);
  await chooser.setFiles({name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(text)});
  await page.getByText('Save imported.', {exact: true}).waitFor();
}
// Drive one human decision through the visible controls: pick the first enabled card half, commit.
async function humanStep(page) {
  const before = await raw(page, GAME);
  const commit = page.locator('#decisions [data-do="commit"]:enabled');
  if (!(await commit.count())) {
    const half = page.locator('#decisions .card-action:enabled').first();
    if (await half.count()) await half.click();
    else {
      // Nothing playable: open "Play a card with no effect".
      await page.locator('#decisions details.pass summary').click();
      await page.locator('#decisions details.pass [data-do="card"]').first().click();
    }
  }
  try {
    await page.locator('#decisions [data-do="commit"]:enabled').click();
    await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, before]);
  } catch (e) {
    const warn = await page.locator('#save-warning').textContent();
    const flash = await page.locator('#flash').textContent();
    await page.screenshot({path: OUT + 'humanstep-fail.png', fullPage: true});
    throw Error(`humanStep failed: warning="${warn}" flash="${flash}" ${e.message.split('\n')[0]}`);
  }
}
async function rivalStep(page) {
  const before = await raw(page, GAME);
  await page.locator('#decisions [data-do="rival"]:enabled').click();
  await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, before]);
}

try {
  const ctx = await browser.newContext({acceptDownloads: true});
  ctx.setDefaultTimeout(10000);

  // P1. Full games through the shipped controls; final table must equal the engine result of the stored state.
  for (const opts of [
    {seed: 'probe-full-2m', playerCount: 2, difficulty: 'mincmistr', mincmistr: {level: 'master'}},
    {seed: 'probe-full-4s', playerCount: 4, difficulty: 'standard', events: true},
    {seed: 'probe-full-3g', playerCount: 3, difficulty: 'mincmistr', mincmistr: {level: 'grandmaster', shared: false}},
  ]) {
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    await importSave(page, writeSave(E.createGame(opts)));
    let clicks = 0, undoChecks = 0;
    for (let guard = 0; guard < 600; guard++) {
      const s = (await stored(page)).state;
      if (s.phase === 'end') break;
      if (s.actor !== 0) await rivalStep(page);
      else { await humanStep(page); clicks++; }
      // Every 25th human click: Undo then replay the same move to check Undo restores the stored position exactly.
      if (clicks && clicks % 25 === 0 && s.actor === 0) {
        const after = await raw(page, GAME);
        await page.locator('#undo').click();
        await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, after]);
        const back = (await stored(page)).state;
        assert.deepEqual(back, s);
        await humanStep(page);
        undoChecks++;
        clicks++;
      }
    }
    const final = (await stored(page)).state;
    assert.equal(final.phase, 'end');
    const table = await page.locator('.final-score tr.total td').allTextContents();
    const engine = E.finalResult(final).scores.map(x => String(x.total));
    assert.deepEqual(table, engine);
    log(`full game via controls (${opts.playerCount}p ${opts.difficulty}${opts.mincmistr ? ' ' + opts.mincmistr.level : ''})`, true, `${clicks} human clicks, ${undoChecks} undo/replay checks, totals ${table.join('/')}`);
    await page.close();
  }

  // P2. Undo depth after reload is exactly five, and in-memory depth before reload is larger.
  {
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    await importSave(page, writeSave(E.createGame({seed: 'probe-undo', playerCount: 4, difficulty: 'quick', starter: 0})));
    for (let i = 0; i < 9; i++) {
      const s = (await stored(page)).state;
      if (s.actor !== 0) await rivalStep(page);
      else await humanStep(page);
    }
    await page.reload();
    let undos = 0;
    while (await page.locator('#undo').isEnabled()) {
      const before = await raw(page, GAME);
      await page.locator('#undo').click();
      await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, before]);
      undos++;
      if (undos > 10) break;
    }
    log('Undo depth after reload', undos === 5, `${undos} steps`);
    await page.close();
  }

  // P3. Undo immediately after New game: what happens?
  {
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    const old = E.createGame({seed: 'probe-old-game'});
    await importSave(page, writeSave(old));
    await page.locator('nav [data-value="setup"]').click();
    await page.locator('#setup-form [type="submit"]').click();
    await page.getByText('New game ready.', {exact: true}).waitFor();
    const fresh = (await stored(page)).state.seed;
    const enabled = await page.locator('#undo').isEnabled();
    let restored = null;
    if (enabled) {
      await page.locator('#undo').click();
      await page.waitForFunction(([k, s]) => JSON.parse(localStorage.getItem(k)).state.seed !== s, [GAME, fresh]);
      restored = (await stored(page)).state.seed;
    }
    log('Undo after New game', true, `undo enabled=${enabled}; restored seed=${restored} (old=${old.seed})`);
    await page.close();
  }

  // P4. Printed Plan faces in the app match the PDF crops for all 15 Plans.
  {
    const page = watch(await ctx.newPage());
    await page.setViewportSize({width: 1200, height: 1000});
    await page.goto(origin + '#draw-only');
    const shots = [];
    for (let i = 0; i < 15; i++) {
      await page.evaluate(([key, i]) => {
        const order = [i, ...Array.from({length: 15}, (_, k) => k).filter(k => k !== i)];
        localStorage.setItem(key, JSON.stringify({deck: {rng: {rng: 1}, draw: order, discard: []}, history: []}));
      }, [PAPER, i]);
      await page.reload();
      await page.locator('#paper-draw').click();
      await page.getByText('Draw 1 of 15', {exact: true}).waitFor();
      const label = await page.locator('#paper-face').getAttribute('aria-label');
      const pos = await page.locator('#paper-face').evaluate(el => getComputedStyle(el).backgroundPosition);
      await page.locator('#paper-face').screenshot({path: `${OUT}plan-${i + 1}.png`});
      shots.push({plan: i + 1, label, pos});
      assert.ok(label.startsWith(`Plan ${i + 1} ·`));
    }
    await writeFile(OUT + 'plan-faces.json', JSON.stringify(shots, null, 1));
    log('15 Plan faces rendered in Draw only', true, 'screenshots saved for comparison');
    await page.close();
  }

  // P5. Draw only Undo depth: five, then disabled; New deck clears it; cancel keeps it.
  {
    const page = watch(await ctx.newPage());
    await page.goto(origin + '#draw-only');
    await page.evaluate(k => localStorage.removeItem(k), PAPER);
    await page.reload();
    for (let i = 1; i <= 7; i++) { await page.locator('#paper-draw').click(); await page.getByText(`Draw ${i} of 15`, {exact: true}).waitFor(); }
    await page.reload();
    let n = 0;
    while (await page.locator('#paper-undo').isEnabled()) { await page.locator('#paper-undo').click(); n++; await page.getByText(`Draw ${7 - n} of 15`, {exact: true}).or(page.getByText('15 cards left', {exact: true})).first().waitFor(); if (n > 8) break; }
    const status = await page.locator('#paper-status').textContent();
    log('Draw only undo depth after reload', n === 5, `${n} undos, now "${status}"`);
    await page.locator('#paper-new').click();
    await page.locator('#paper-cancel').click();
    const kept = await page.locator('#paper-status').textContent();
    await page.locator('#paper-new').click();
    await page.locator('#paper-reset').click();
    await page.getByText('15 cards left', {exact: true}).waitFor();
    log('Draw only New deck cancel/confirm', kept === status && await page.locator('#paper-undo').isDisabled(), `cancel kept "${kept}", reset leaves Undo disabled`);
    await page.close();
  }

  // P6. 390 px digital game at 4 players: horizontal overflow and tap targets.
  {
    const mobile = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    const page = watch(await mobile.newPage());
    await page.goto(origin);
    await importSave(page, writeSave(E.createGame({seed: 'probe-phone', playerCount: 4, difficulty: 'mincmistr', mincmistr: {level: 'master'}, starter: 1})));
    const overflow = await page.evaluate(() => ({doc: document.documentElement.scrollWidth, win: window.innerWidth,
      wide: [...document.querySelectorAll('#play *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 8).map(el => el.tagName + '.' + el.className + '#' + el.id)}));
    const small = await page.evaluate(() => [...document.querySelectorAll('button:not([hidden]), a[href], select, summary')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24);
    }).map(el => `${el.tagName}:${(el.textContent || '').trim().slice(0, 24)}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
    await page.screenshot({path: OUT + 'phone-4p.png', fullPage: true});
    log('390 px digital 4-player layout', overflow.doc <= overflow.win, `scrollWidth ${overflow.doc} vs ${overflow.win}; overflowing: ${overflow.wide.join(', ') || 'none'}; <24px targets: ${small.length}`);
    await writeFile(OUT + 'small-targets.json', JSON.stringify(small, null, 1));
    await mobile.close();
  }

  // P7. Print the mine aid to PDF from the real print stylesheet.
  {
    const page = watch(await ctx.newPage());
    await page.goto(origin + '#draw-only');
    await page.locator('#paper-open-reference').click();
    await page.locator('[aria-controls="paper-ref-mine"]').click();
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#paper-print-mine').click();
    await page.emulateMedia({media: 'print'});
    await page.pdf({path: OUT + 'mine-aid-letter.pdf', format: 'Letter'});
    await page.pdf({path: OUT + 'mine-aid-a4.pdf', format: 'A4'});
    log('Print mine aid to PDF', true, 'Letter and A4 PDFs written');
    await page.close();
  }

  // P8. Long-seed individual decks through the New game dialog.
  {
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    await page.locator('nav [data-value="setup"]').click();
    await page.locator('#player-count').selectOption('4');
    await page.locator('#rival-difficulty').selectOption('mincmistr');
    await page.locator('#setup-form [name="mincmistrDecks"]').selectOption('individual');
    await page.locator('#setup-form [name="seed"]').fill('A'.repeat(64));
    await page.locator('#setup-form [type="submit"]').click();
    await page.getByText('New game ready.', {exact: true}).waitFor();
    const s = (await stored(page)).state;
    const orders = new Set(s.mincmistr.decks.map(d => d.draw.join(',')));
    log('64-character seed gives three different individual decks', orders.size === 3, [...orders].map(o => o.split(',').slice(0, 5).join('-')).join(' | '));
    await page.close();
  }

  log('No page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await ctx.close();
} catch (e) {
  console.error('PROBE ERROR', e);
  log('probe run', false, e.message);
} finally {
  await writeFile(OUT + 'results.json', JSON.stringify({results, errors}, null, 1));
  await browser.close();
  server.close();
}
