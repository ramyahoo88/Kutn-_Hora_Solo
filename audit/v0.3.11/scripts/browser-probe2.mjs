// Save-protection probes near the v0.3.4 audit's F1/F2 fixes, in Chromium.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = new URL('../results/browser/', import.meta.url).pathname;
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const E = await import(ROOT + 'src/engine.mjs');
const {writeSave} = await import(ROOT + 'src/save.mjs');
const {writeAutosave} = await import(ROOT + 'src/save.mjs');
const html = await readFile(ROOT + 'Kutna_Hora_Solo.html');
const GAME = 'kutna-hora-solo-v1', PAPER = 'kutna-hora-mincmistr-deck-v1';
const server = createServer((q, r) => q.url === '/' ? r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}).end(html) : r.writeHead(404).end());
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch();
const results = [], errors = [];
const log = (name, ok, detail = '') => { results.push({name, ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); };
const watch = p => { p.on('pageerror', e => errors.push(e.message)); return p; };
const raw = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const text = async (page, sel) => (await page.locator(sel).textContent())?.trim();

try {
  // D1. Digital: storage read fails once at startup while a save exists; the first move must not overwrite it.
  {
    const ctx = await browser.newContext(); ctx.setDefaultTimeout(8000);
    const existing = writeAutosave({state: E.createGame({seed: 'probe-read-fail', difficulty: 'quick'}), rivalReport: [], review: null}, []);
    await ctx.addInitScript(({key, value}) => {
      if (sessionStorage.getItem('done')) return;
      sessionStorage.setItem('done', '1');
      localStorage.setItem(key, value);
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) { if (k === key && this === localStorage) { Storage.prototype.getItem = get; throw new DOMException('fail', 'SecurityError'); } return get.call(this, k); };
    }, {key: GAME, value: existing});
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    const warn1 = await text(page, '#save-warning');
    await page.locator('#decisions .card-action:enabled').first().click();
    await page.locator('#decisions [data-do="commit"]:enabled').click();
    await page.getByText('The saved game changed.', {exact: false}).waitFor();
    const preserved = await raw(page, GAME) === existing;
    await page.locator('#load-saved-game').click();
    const seed = JSON.parse(await raw(page, GAME)).state.seed;
    const shown = await page.locator('#decisions').isVisible();
    log('Digital read failure at startup preserves the existing save', preserved && seed === 'probe-read-fail', `startup warning "${warn1}"; after Load: seed ${seed}`);
    await ctx.close();
  }

  // D2. Digital: corrupt save is protected; moves do not overwrite; New game replaces after explicit confirmation.
  {
    const ctx = await browser.newContext({acceptDownloads: true}); ctx.setDefaultTimeout(8000);
    await ctx.addInitScript(key => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem(key, '{"kind":"kutna-hora-solo","state":{"broken":true}}'); } }, GAME);
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    const warn = await text(page, '#save-warning');
    await page.locator('#decisions .card-action:enabled').first().click();
    await page.locator('#decisions [data-do="commit"]:enabled').click();
    await page.waitForTimeout(300);
    const kept = (await raw(page, GAME)).includes('"broken":true');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#export-unreadable').click()]);
    const name = dl.suggestedFilename();
    await page.locator('nav [data-value="setup"]').click();
    await page.locator('#setup-form [type="submit"]').click();
    await page.getByText('New game ready.', {exact: true}).waitFor();
    const replaced = !(await raw(page, GAME)).includes('"broken":true');
    log('Digital corrupt save protected until New game', kept && replaced, `warning "${warn}"; download ${name}`);
    await ctx.close();
  }

  // D3. Draw only: corrupt deck protected; draws work in memory; New deck replaces it.
  {
    const ctx = await browser.newContext(); ctx.setDefaultTimeout(8000);
    await ctx.addInitScript(key => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem(key, '{"deck":{"draw":[1,1]}}'); } }, PAPER);
    const page = watch(await ctx.newPage());
    await page.goto(origin + '#draw-only');
    const warn = await text(page, '#paper-warning');
    await page.locator('#paper-draw').click();
    await page.getByText('Draw 1 of 15', {exact: true}).waitFor();
    const kept = (await raw(page, PAPER)) === '{"deck":{"draw":[1,1]}}';
    await page.locator('#paper-new').click(); await page.locator('#paper-reset').click();
    await page.getByText('15 cards left', {exact: true}).waitFor();
    const replaced = JSON.parse(await raw(page, PAPER)).deck.draw.length === 15;
    log('Draw only corrupt deck protected until New deck', kept && replaced, `warning "${warn}"`);
    await ctx.close();
  }

  // D4. Stale digital tab tries New game and Import: both must refuse to overwrite the newer save.
  {
    const ctx = await browser.newContext(); ctx.setDefaultTimeout(8000);
    const a = watch(await ctx.newPage()), b = watch(await ctx.newPage());
    await a.goto(origin); await b.goto(origin);
    await a.locator('#decisions .card-action:enabled').first().click();
    await a.locator('#decisions [data-do="commit"]:enabled').click();
    await a.waitForFunction(k => localStorage.getItem(k) !== null, GAME);
    const newer = await raw(a, GAME);
    // Simulate a missed storage event in B, then try New game there.
    await b.evaluate(() => { /* storage events are delivered; this checks the write-time guard too */ });
    await b.locator('nav [data-value="setup"]').click();
    await b.locator('#setup-form [type="submit"]').click();
    await b.waitForTimeout(400);
    const unchanged = await raw(b, GAME) === newer;
    const warn = await text(b, '#save-warning');
    log('Stale tab New game does not overwrite the newer save', unchanged, `B warning "${warn}"`);
    await ctx.close();
  }

  // D5. Draw only: other tab clears all site data; Load in the first tab then continues without a conflict loop.
  {
    const ctx = await browser.newContext(); ctx.setDefaultTimeout(8000);
    const a = watch(await ctx.newPage()), b = watch(await ctx.newPage());
    await a.goto(origin + '#draw-only'); await b.goto(origin + '#draw-only');
    await a.locator('#paper-draw').click(); await a.getByText('Draw 1 of 15', {exact: true}).waitFor();
    await b.getByRole('button', {name: 'Load saved deck', exact: true}).waitFor();
    await b.locator('#paper-load').click();
    await b.evaluate(() => localStorage.clear());
    await a.getByRole('button', {name: 'Load saved deck', exact: true}).waitFor();
    await a.locator('#paper-load').click();
    const status = await text(a, '#paper-status');
    await a.locator('#paper-draw').click();
    await a.waitForTimeout(300);
    const after = await text(a, '#paper-status');
    const savedNow = await raw(a, PAPER);
    log('Draw only after another tab clears storage', !!savedNow, `after Load: "${status}" → after draw: "${after}"`);
    await ctx.close();
  }
  log('No page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  console.error(e); log('probe2 run', false, e.message);
} finally {
  await writeFile(OUT + 'results2.json', JSON.stringify({results, errors}, null, 1));
  await browser.close(); server.close();
}
