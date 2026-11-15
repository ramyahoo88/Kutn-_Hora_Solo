import os, pathlib
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
HTML = (HERE.parents[1] / 'Kutna_Hora_Solo.html').as_uri()
CHROME = os.environ.get('CHROME')  # optional Chrome/Chromium path if Playwright's bundled browser is not installed
with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
    page = b.new_page(viewport={'width':1440,'height':1000})
    page.goto(HTML); page.wait_for_timeout(200)
    page.set_input_files('#file',str(HERE / 'Kutna_Audit_HouseRow3.json')); page.wait_for_timeout(300)
    print('flash:', page.locator('#flash').inner_text())
    page.click('button[data-do="player-board"][data-value="0"]')
    print('board houses:', [r for r in page.locator('#player-board-body').inner_text().split('\n') if 'Innkeepers' in r])
    page.click('#player-board-dialog button[data-do="close"]')
    page.click('button[data-do="card"][data-value="2/build"]'); page.wait_for_timeout(100)
    print('build preview:', page.locator('.choice-info').inner_text().replace('\n',' | '))
    page.click('button[data-do="commit"]'); page.wait_for_timeout(100)
    print('after: reputation shown =', page.locator('.player.seat-0 .player-values span:nth-child(3) b').inner_text())
    b.close()
