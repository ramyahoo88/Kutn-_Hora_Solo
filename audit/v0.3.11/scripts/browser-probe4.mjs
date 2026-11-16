// Play whole games with "Play one Plan" for every Mincmistr step and compare each review's
// "Changed by this Plan" list and marked spaces with an independent diff of the saved positions.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = new URL('../results/browser/', import.meta.url).pathname;
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const E = await import(ROOT + 'src/engine.mjs');
const {writeSave} = await import(ROOT + 'src/save.mjs');
const GAME = 'kutna-hora-solo-v1';
const browser = await playwright.chromium.launch();
const errors = [], results = [];
const raw = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
async function human(page) {
  const before = await raw(page, GAME);
  if (!(await page.locator('#decisions [data-do="commit"]:enabled').count())) {
    const half = page.locator('#decisions .card-action:enabled').first();
    if (await half.count()) await half.click();
    else { await page.locator('#decisions details.pass summary').click(); await page.locator('#decisions details.pass [data-do="card"]').first().click(); }
  }
  await page.locator('#decisions [data-do="commit"]:enabled').click();
  await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, before]);
}
for (const opts of [
  {seed: 'probe4-a', playerCount: 2, difficulty: 'mincmistr', mincmistr: {level: 'master'}, events: true},
  {seed: 'probe4-b', playerCount: 4, difficulty: 'mincmistr', mincmistr: {level: 'grandmaster', shared: false}, events: true, starter: 2},
]) {
  const ctx = await browser.newContext(); ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + ROOT + 'Kutna_Hora_Solo.html');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('footer [data-do="import"]').click()]);
  await chooser.setFiles({name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(writeSave(E.createGame(opts)))});
  await page.getByText('Save imported.', {exact: true}).waitFor();
  const t = {plans: 0, bonusSteps: 0, compared: 0, withRoundEnd: 0, bad: [], shownMismatch: 0};
  for (let guard = 0; guard < 900; guard++) {
    const saved = JSON.parse(await raw(page, GAME)); const s = saved.state;
    if (s.phase === 'end') break;
    if (s.actor === 0) { await human(page); continue; }
    const step = page.locator('#decisions [data-do="rival-step"]:enabled');
    if (!(await step.count())) { // tax-only steps have no Plan to review
      const before = await raw(page, GAME);
      await page.locator('#decisions [data-do="rival"]:enabled').click();
      await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, before]); continue;
    }
    const before = await raw(page, GAME);
    await step.click();
    await page.waitForFunction(([k, v]) => localStorage.getItem(k) !== v, [GAME, before]);
    const now = JSON.parse(await raw(page, GAME)); const n = now.state, review = now.review;
    if (!review?.plan) { t.bonusSteps++; continue; }
    t.plans++;
    const seat = s.actor, a = s.players[seat], b = n.players[seat];
    // The review covers the whole Plan, bonuses included; with no round end the saved positions bracket it exactly.
    if (review.roundEnd) { t.withRoundEnd++; continue; }
    const expect = [];
    const cmp = (label, x, y, unit = '') => { if (x !== y) expect.push(`${label} ${x} → ${y}${unit}`); };
    cmp('Coins', a.coins, b.coins, ' g'); cmp('Reputation', a.rep, b.rep); cmp('Earned points', a.vp, b.vp, ' VP'); cmp('Pelicans', a.pelicans, b.pelicans);
    cmp('Miner pool', a.pool, b.pool); cmp('Miner reserve', a.reserve, b.reserve);
    const got = review.changes.summary.filter(l => /^(Coins|Reputation|Earned points|Pelicans|Miner pool|Miner reserve) /.test(l));
    const town = s.city.flatMap((c, i) => JSON.stringify(c) === JSON.stringify(n.city[i]) ? [] : [i]);
    const mine = s.mine.flatMap((c, i) => JSON.stringify(c) === JSON.stringify(n.mine[i]) ? [] : [i]);
    t.compared++;
    if (JSON.stringify(got) !== JSON.stringify(expect) || JSON.stringify(town) !== JSON.stringify(review.changes.town) || JSON.stringify(mine) !== JSON.stringify(review.changes.mine))
      t.bad.push({round: s.round, seat, expect, got, town, shownTown: review.changes.town, mine, shownMine: review.changes.mine});
    // What is on screen equals what was saved.
    const shown = await page.locator('.plan-changes .change-list li').allInnerTexts();
    if (shown.length !== review.changes.summary.length + town.length + mine.length) t.shownMismatch++;
    const marks = await page.locator('.plan-changed').count();
    if (marks !== town.length + mine.length) t.shownMismatch++;
  }
  const final = JSON.parse(await raw(page, GAME)).state;
  assert.equal(final.phase, 'end');
  const ok = !t.bad.length && !t.shownMismatch;
  results.push({game: `${opts.playerCount}p ${opts.mincmistr.level}`, ...t, bad: t.bad.slice(0, 3), ok});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${opts.playerCount}p ${opts.mincmistr.level}: ${t.plans} Plans reviewed, ${t.compared} compared with an independent diff, ${t.withRoundEnd} with round-end effects (not compared), ${t.bad.length} differences, ${t.shownMismatch} display mismatches`);
  if (t.bad.length) console.log(JSON.stringify(t.bad.slice(0, 2), null, 1));
  await ctx.close();
}
console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'No page errors');
await writeFile(OUT + 'results4.json', JSON.stringify({results, errors}, null, 1));
await browser.close();
