// Chromium probes of features added in v0.3.6–v0.3.11, on the shipped HTML.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = new URL('../results/browser/', import.meta.url).pathname;
await mkdir(OUT, {recursive: true});
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const E = await import(ROOT + 'src/engine.mjs');
const {writeSave} = await import(ROOT + 'src/save.mjs');
const {botAction} = await import(ROOT + 'src/bot.mjs');
const {playMincmistr} = await import(ROOT + 'src/mincmistr.mjs');
const html = await readFile(ROOT + 'Kutna_Hora_Solo.html');
const GAME = 'kutna-hora-solo-v1', PAPER = 'kutna-hora-mincmistr-deck-v1';
const server = createServer((q, r) => q.url === '/' ? r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}).end(html) : r.writeHead(404).end());
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch();
const results = [], errors = [];
const log = (name, ok, detail = '') => { results.push({name, ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); };
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); return p; };
const raw = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const stored = async page => JSON.parse(await raw(page, GAME));
const strip = s => { const {log: _l, ...rest} = s; return JSON.stringify(rest); };
async function importFile(page, button, text, name = 'p.json') {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator(button).click()]);
  await chooser.setFiles({name, mimeType: 'application/json', buffer: Buffer.from(text)});
}
async function download(page, locator) {
  const [dl] = await Promise.all([page.waitForEvent('download'), locator.click()]);
  return {name: dl.suggestedFilename(), text: await readFile(await dl.path(), 'utf8')};
}
// A mid-game position with a Mincmistr to act.
function midGame(opts, round) {
  let s = E.createGame(opts);
  while (s.round < round) s = s.actor === 0 ? E.transition(s, botAction(s, 'standard')) : playMincmistr(s);
  while (s.actor === 0 || s.pending.length || s.phase !== 'action') s = s.actor === 0 ? E.transition(s, botAction(s, 'standard')) : playMincmistr(s);
  return s;
}

try {
  // N1. Playtest report: note, versions, previous position, replay and Undo.
  {
    const ctx = await browser.newContext({acceptDownloads: true}); ctx.setDefaultTimeout(10000);
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    const start = midGame({seed: 'probe3-report', playerCount: 3, difficulty: 'mincmistr', mincmistr: {level: 'master'}, starter: 1}, 3);
    await importFile(page, 'footer [data-do="import"]', writeSave(start));
    await page.getByText('Save imported.', {exact: true}).waitFor();
    await page.locator('[data-do="rival-step"]').click();
    await page.locator('#review-title').waitFor();
    const after = (await stored(page)).state;
    const note = 'Probe note: expected a Plot here. ' + 'x'.repeat(40);
    await page.locator('#playtest-note').evaluate(el => { el.closest('details').open = true; });
    await page.locator('#playtest-note').fill(note);
    await page.waitForFunction(([k, n]) => JSON.parse(localStorage.getItem(k)).playtestNote === n, [GAME, note]);
    await page.reload();
    const noteAfterReload = await page.locator('#playtest-note').inputValue();
    const report = await download(page, page.locator('.journal [data-do="report"], [data-do="report"]').last());
    const data = JSON.parse(report.text);
    const p = data.playtest;
    assert.equal(p.appVersion, '0.3.11'); assert.equal(p.mincmistrRulesVersion, '1.2.5'); assert.equal(p.note, note);
    assert.equal(strip(p.before.state), strip(start));
    // Fresh browser profile: import the report, replay the step.
    const ctx2 = await browser.newContext(); ctx2.setDefaultTimeout(10000);
    const page2 = watch(await ctx2.newPage());
    await page2.goto(origin);
    await importFile(page2, 'footer [data-do="import"]', report.text, report.name);
    await page2.getByText('Save imported.', {exact: true}).waitFor();
    const title = await page2.locator('#report-source-title').textContent();
    const note2 = await page2.locator('#playtest-note').inputValue();
    await page2.locator('#report-before').click();
    await page2.getByText('Position before the reported step loaded.', {exact: true}).waitFor();
    const before2 = (await stored(page2)).state;
    await page2.locator('[data-do="rival-step"]').click();
    await page2.locator('#review-title').waitFor();
    const replay = (await stored(page2)).state;
    await page2.locator('#undo').click();
    await page2.waitForFunction(([k, v]) => JSON.stringify(JSON.parse(localStorage.getItem(k)).state) !== v, [GAME, JSON.stringify(replay)]);
    await page2.locator('#undo').click();
    await page2.waitForTimeout(400);
    const undone = (await stored(page2)).state;
    const ok = noteAfterReload === note && note2 === note && strip(before2) === strip(start) && JSON.stringify(replay) === JSON.stringify(after) && JSON.stringify(undone) === JSON.stringify(after);
    log('Playtest report: note, versions, earlier position, identical replay, Undo back to the import', ok,
      `${report.name}; "${title}"; replay identical=${JSON.stringify(replay) === JSON.stringify(after)}; two Undos return to imported position=${JSON.stringify(undone) === JSON.stringify(after)}`);
    await ctx.close(); await ctx2.close();
  }

  // N2. "Why this move?" in the review and journal; rule links open the offline rule; changed spaces are marked.
  {
    const ctx = await browser.newContext(); ctx.setDefaultTimeout(10000);
    const page = watch(await ctx.newPage());
    await page.setViewportSize({width: 1280, height: 1000});
    await page.goto(origin);
    let s = midGame({seed: 'probe3-why', playerCount: 2, difficulty: 'mincmistr', mincmistr: {level: 'journeyman'}, starter: 1}, 2);
    // Advance to a position where the next Plan builds or mines (changes a board space).
    for (let guard = 0; guard < 80; guard++) {
      const n = playMincmistr(s);
      const changed = n.city.some((c, i) => c !== s.city[i] && JSON.stringify(c) !== JSON.stringify(s.city[i])) || n.mine.some((c, i) => JSON.stringify(c) !== JSON.stringify(s.mine[i]));
      if (changed && s.phase === 'action' && !s.pending.length) break;
      s = n; while (s.actor === 0 && s.phase !== 'end') s = E.transition(s, botAction(s, 'standard'));
    }
    await importFile(page, 'footer [data-do="import"]', writeSave(s));
    await page.getByText('Save imported.', {exact: true}).waitFor();
    await page.locator('[data-do="rival-step"]').click();
    await page.locator('#review-title').waitFor();
    const state = (await stored(page)).state;
    const entry = state.log.findLast(e => e.explanation);
    const shownRule = (await page.locator('.review-rule').innerText()).trim();
    await page.locator('.rival-review details.plan-explanation summary').click();
    const lines = await page.locator('.rival-review details.plan-explanation li').allInnerTexts();
    const marks = await page.locator('.plan-changed').count();
    const links = await page.locator('.rival-review [data-do="locate-plan-change"]').count();
    await page.locator('.rival-review [data-do="locate-plan-change"]').first().click();
    const focused = await page.evaluate(() => document.activeElement?.id ?? '');
    await page.screenshot({path: OUT + 'why-this-move.png'});
    // Every rule number cited opens its heading in the offline reference.
    const cited = [...new Set(entry.explanation.map(x => x.rule))];
    const opened = [];
    for (const rule of cited) {
      await page.locator(`.rival-review details.plan-explanation [data-do="rule"][data-value="${rule}"]`).first().click();
      await page.locator('#paper-reference[open]').waitFor();
      const target = await page.evaluate(r => { const el = document.getElementById(`mincmistr-rule-${r}`); const b = el?.getBoundingClientRect(); return {focus: document.activeElement === el, visible: !!b && b.height > 0 && b.top >= 0 && b.top < innerHeight, text: el?.textContent.slice(0, 30)}; }, rule);
      opened.push({rule, ...target});
      await page.locator('#paper-reference-close').click();
    }
    const ok = lines.length === entry.explanation.length && shownRule === entry.rule && marks >= 1 && links >= 1 && focused.startsWith('plan-change-') && opened.every(o => o.focus && o.visible);
    log('Why this move?: review matches the journal record, rule links open the cited rule, changed spaces are marked', ok,
      `${entry.rule}; ${lines.length} checks; rules ${opened.map(o => o.rule + (o.focus && o.visible ? '✓' : '✗')).join(' ')}; ${marks} marked space(s); focus ${focused}`);
    await ctx.close();
  }

  // N3. Deck export/import across profiles; wrong files are rejected both ways.
  {
    const ctx = await browser.newContext({acceptDownloads: true}); ctx.setDefaultTimeout(10000);
    const page = watch(await ctx.newPage());
    await page.goto(origin + '#draw-only');
    for (let i = 1; i <= 17; i++) { await page.locator('#paper-draw').click(); await page.getByText(`Draw ${i > 15 ? i - 15 : i} of 15`, {exact: true}).waitFor(); }
    const savedDeck = JSON.parse(await raw(page, PAPER));
    const file = await download(page, page.locator('#paper-export-deck'));
    const ctx2 = await browser.newContext(); ctx2.setDefaultTimeout(10000);
    const page2 = watch(await ctx2.newPage());
    await page2.goto(origin + '#draw-only');
    await importFile(page2, '#paper-import-deck', file.text, file.name);
    await page2.waitForFunction(k => localStorage.getItem(k) !== null, PAPER);
    const imported = JSON.parse(await raw(page2, PAPER));
    const same = JSON.stringify(imported.deck ?? imported.current) === JSON.stringify(savedDeck.deck ?? savedDeck.current);
    // Continue identically on both devices.
    const next = [];
    for (const p of [page, page2]) { await p.locator('#paper-draw').click(); await p.getByText('Draw 3 of 15', {exact: true}).waitFor(); next.push(await p.locator('#paper-face').getAttribute('aria-label')); }
    // Wrong files.
    const before = await raw(page2, PAPER);
    await importFile(page2, '#paper-import-deck', writeSave(E.createGame({seed: 'not-a-deck'})));
    await page2.waitForTimeout(300);
    const deckMsg = (await page2.locator('#paper-message').textContent()).trim();
    const deckKept = await raw(page2, PAPER) === before;
    const page3 = watch(await ctx2.newPage());
    await page3.goto(origin);
    const gameBefore = await raw(page3, GAME);
    await importFile(page3, 'footer [data-do="import"]', file.text, file.name);
    await page3.waitForTimeout(300);
    const gameMsg = (await page3.locator('#flash').textContent()).trim();
    const gameKept = await raw(page3, GAME) === gameBefore;
    log('Deck export/import: same deck and next draw on a second device; wrong files rejected', same && next[0] === next[1] && deckKept && gameKept,
      `${file.name}; next draw "${next[0]}" on both; game-as-deck → "${deckMsg}"; deck-as-game → "${gameMsg}"`);
    await ctx.close(); await ctx2.close();
  }

  // N4. 360 px: digital review with explanation open, journal open, Draw only reference.
  {
    const ctx = await browser.newContext({viewport: {width: 360, height: 740}, hasTouch: true, isMobile: true}); ctx.setDefaultTimeout(10000);
    const page = watch(await ctx.newPage());
    await page.goto(origin);
    const s = midGame({seed: 'probe3-phone', playerCount: 4, difficulty: 'mincmistr', mincmistr: {level: 'grandmaster'}, starter: 2, events: true}, 4);
    await importFile(page, 'footer [data-do="import"]', writeSave(s));
    await page.getByText('Save imported.', {exact: true}).waitFor();
    await page.locator('[data-do="rival-step"]').click();
    await page.locator('#review-title').waitFor();
    await page.locator('.rival-review details.plan-explanation summary').click();
    await page.locator('#journal-toggle').click();
    const measure = () => page.evaluate(() => ({doc: document.documentElement.scrollWidth, win: innerWidth,
      wide: [...document.querySelectorAll('main *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !el.closest('[hidden]'); }).slice(0, 6).map(el => `${el.tagName}.${el.className}`),
      clipped: [...document.querySelectorAll('.cell b')].filter(el => /\w/.test(el.textContent) && el.getClientRects().length > 1 && !el.textContent.includes(' ')).map(el => el.textContent)}));
    const digital = await measure();
    await page.screenshot({path: OUT + 'phone-360-review.png', fullPage: true});
    await page.goto(origin + '#draw-only'); await page.reload();
    await page.locator('#paper-open-reference').click();
    const tabs = [];
    for (const id of ['paper-ref-cards', 'paper-ref-table', 'paper-ref-mine', 'paper-ref-rules']) {
      await page.locator(`[aria-controls="${id}"]`).click();
      const w = await page.evaluate(i => { const d = document.getElementById('paper-reference'); const el = document.getElementById(i); return {over: d.scrollWidth - d.clientWidth, body: el.scrollWidth - el.clientWidth}; }, id);
      tabs.push(`${id.slice(10)}:${w.over}/${w.body}`);
    }
    log('360 px: review with explanation, open journal and reference tabs fit the width', digital.doc <= digital.win && tabs.every(t => t.endsWith(':0/0')),
      `scrollWidth ${digital.doc}/${digital.win}; overflowing ${digital.wide.join(', ') || 'none'}; single words split across lines: ${[...new Set(digital.clipped)].join(', ') || 'none'}; reference overflow ${tabs.join(' ')}`);
    await ctx.close();
  }

  // N5. Print views: table reference and mine aid, Letter and A4.
  {
    const ctx = await browser.newContext(); ctx.setDefaultTimeout(10000);
    const page = watch(await ctx.newPage());
    await page.goto(origin + '#draw-only');
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#paper-open-reference').click();
    const out = [];
    for (const [tab, button, name] of [['paper-ref-table', '#paper-print-table', 'table-reference'], ['paper-ref-mine', '#paper-print-mine', 'mine-aid']]) {
      await page.locator(`[aria-controls="${tab}"]`).click();
      await page.locator(button).click();
      await page.emulateMedia({media: 'print'});
      for (const format of ['Letter', 'A4']) { await page.pdf({path: `${OUT}${name}-${format.toLowerCase()}.pdf`, format}); out.push(`${name}-${format.toLowerCase()}.pdf`); }
      await page.emulateMedia({media: 'screen'});
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    }
    log('Print views written', true, out.join(', '));
    await ctx.close();
  }
  log('No page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
} catch (e) {
  console.error(e); log('probe3 run', false, e.message.split('\n')[0]);
} finally {
  await writeFile(OUT + 'results3.json', JSON.stringify({results, errors}, null, 1));
  await browser.close(); server.close();
}
