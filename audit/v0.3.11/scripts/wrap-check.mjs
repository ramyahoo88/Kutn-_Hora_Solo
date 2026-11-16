// Count board labels whose single words wrap mid-word, by viewport width and table size.
import {readFile} from 'node:fs/promises';
const ROOT = new URL('../../../', import.meta.url).pathname;
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const E = await import(ROOT + 'src/engine.mjs');
const {writeSave} = await import(ROOT + 'src/save.mjs');
const {botAction} = await import(ROOT + 'src/bot.mjs');
const browser = await playwright.chromium.launch();
const out = [];
for (const width of [360, 390, 430]) for (const count of [2, 4]) {
  const ctx = await browser.newContext({viewport: {width, height: 800}, isMobile: true, hasTouch: true});
  const page = await ctx.newPage();
  await page.goto('file://' + ROOT + 'Kutna_Hora_Solo.html');
  let s = E.createGame({seed: `wrap-${count}`, playerCount: count, difficulty: 'standard'});
  while (s.round < (count === 4 ? 5 : 6)) s = E.transition(s, botAction(s, 'quick'));
  while (s.actor !== 0 || s.phase !== 'action') s = E.transition(s, botAction(s, 'quick'));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('footer [data-do="import"]').click()]);
  await chooser.setFiles({name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(writeSave(s))});
  await page.getByText('Save imported.').waitFor();
  const broken = await page.evaluate(() => {
    const found = {town: new Set(), mine: new Set()};
    for (const b of document.querySelectorAll('.cell b')) {
      const node = b.firstChild; if (!node || node.nodeType !== 3) continue;
      const text = node.textContent; const re = /[^\s\-–]+/g; let m;
      while ((m = re.exec(text))) {
        const r = document.createRange(); r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].map(x => Math.round(x.top)));
        if (tops.size > 1) found[b.closest('#boards .panel:nth-of-type(1)') || /Town/.test(b.closest('.cell').title) ? 'town' : 'mine'].add(m[0]);
      }
    }
    return {town: [...found.town], mine: [...found.mine]};
  });
  out.push({width, players: count, townWordsSplit: broken.town, mineWordsSplit: broken.mine});
  if (width === 360 && count === 4) await page.locator('#boards').screenshot({path: new URL('../results/browser/phone-360-boards-4p.png', import.meta.url).pathname});
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
