// Finding P1 in the shipped HTML: import the card-play position and press Play one Plan.
import {readFile} from 'node:fs/promises';
const ROOT = new URL('../../../', import.meta.url).pathname;
const POS = new URL('../positions/House_Right_No_Public_Card_Play.json', import.meta.url).pathname;
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await playwright.chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 1000}});
await page.goto('file://' + ROOT + 'Kutna_Hora_Solo.html');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('footer [data-do="import"]').click()]);
await chooser.setFiles({name: 'p.json', mimeType: 'application/json', buffer: await readFile(POS)});
await page.getByText('Save imported.').waitFor();
await page.locator('[data-do="rival-step"]').click();
await page.locator('#review-title').waitFor();
const review = await page.locator('.rival-review').innerText();
const state = JSON.parse(await page.evaluate(() => localStorage.getItem('kutna-hora-solo-v1'))).state;
console.log(JSON.stringify({review, held: state.players[1].held, houses: state.players[1].houses, pending: state.pending}, null, 1));
await page.locator('.rival-review').screenshot({path: new URL('../results/browser/house-right-review.png', import.meta.url).pathname});
await browser.close();
