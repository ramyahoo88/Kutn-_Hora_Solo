"""v0.2.2 playtest build through its controls: README Game 1, Game 2 and Safari steps (run here in Chromium)."""
import json, os, pathlib
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
HTML = (ROOT / 'Kutna_Hora_Solo.html').as_uri()
CHROME = os.environ.get('CHROME')  # optional Chrome/Chromium path if Playwright's bundled browser is not installed
FIX = str(ROOT / 'test' / 'fixtures' / 'Ius_Regale_Short_Stack.json')
OUT = HERE / 'shots'; OUT.mkdir(exist_ok=True)
KEY = 'kutna-hora-solo-v1'
def saved(page):
    return json.loads(page.evaluate(f"localStorage.getItem('{KEY}')"))['state']
def rival_line(page):
    return page.locator('.player.seat-1 .guild-line').inner_text()
def board_rows(page, seat):
    page.click(f'button[data-do="player-board"][data-value="{seat}"]')
    rows = [r.split('\t')[0] for r in page.locator('#player-board-body table:nth-of-type(2) tbody').inner_text().split('\n')]
    page.click('#player-board-dialog button[data-do="close"]')
    return rows
with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.goto(HTML); page.wait_for_timeout(250)
    print('version:', page.locator('.eyebrow').inner_text())
    print('G1 default game rival line:', rival_line(page), '| rival board rows:', board_rows(page, 1))
    print('G1 guide guild paragraph:', page.evaluate("[...document.querySelectorAll('#help-dialog p')].find(p=>p.textContent.startsWith('Set up your guilds'))?.textContent"))

    # Game 2 through the New game dialog
    page.click('header button[data-do="dialog"][data-value="setup"]')
    page.select_option('#guild-setup', '6'); page.wait_for_timeout(50)
    print('G2 card 6 sets:', page.locator('#guild-side option').all_inner_texts())
    page.select_option('#guild-side', '1'); page.wait_for_timeout(50)
    page.select_option('select[name="starter"]', '1')
    page.fill('input[name="seed"]', 'kutna-v022-playtest-2')
    print('G2 dialog note:', page.locator('#opening-note').inner_text())
    print('G2 your row options:', page.locator('#guild-rows option').all_inner_texts()[:2], '...')
    page.click('#setup-form button[type="submit"]'); page.wait_for_timeout(250)
    st = saved(page)
    print('G2 started: seed', st['seed'], 'setup', st['setup'], 'side', st['side'], 'starter', st['starter'], 'guilds', st['players'][0]['guilds'], st['players'][1]['guilds'])
    print('G2 rival line:', rival_line(page), '| rival board rows:', board_rows(page, 1), '| turn title:', page.locator('#turn-title').inner_text())
    page.click('button[data-do="rival"]'); page.wait_for_timeout(4000)
    print('G2 after rival turn:', page.locator('#turn-title').inner_text())
    with page.expect_download() as dl:
        page.click('footer button[data-do="export"]')
    path = OUT / 'g2.json'; dl.value.save_as(str(path))
    before = json.loads(path.read_text())['state']
    page.click('header button[data-do="dialog"][data-value="setup"]'); page.click('#setup-form button[type="submit"]'); page.wait_for_timeout(200)
    page.set_input_files('#file', str(path)); page.wait_for_timeout(300)
    after = saved(page)
    print('G2 export/import:', page.locator('#flash').inner_text(), '| identical state:', json.dumps(before, sort_keys=True) == json.dumps(after, sort_keys=True))

    # Safari steps (Ius Regale short stack)
    page.set_input_files('#file', FIX); page.wait_for_timeout(300)
    print('IUS import:', page.locator('#flash').inner_text(), '| event:', page.locator('#dashboard .event strong').inner_text(), '|', page.locator('#dashboard .event span').inner_text())
    print('IUS mines head:', page.locator('.mine-grid').locator('xpath=..').locator('.fine').first.inner_text())
    page.click('details.pass summary'); page.wait_for_timeout(100)
    skips = page.locator('details.pass button[data-do="card"]')
    print('IUS no-effect options:', skips.all_inner_texts())
    skips.first.click(); page.wait_for_timeout(100)
    print('IUS commit label:', page.locator('button[data-do="commit"]').inner_text())
    page.click('button[data-do="commit"]'); page.wait_for_timeout(250)
    st = saved(page)
    print('IUS after: round', st['round'], 'ore', st['ore'], 'deck', len(st['mineDeck']), 'discard', len(st['mineDiscard']), 'mixed', st['mineMixed'], '| title', page.locator('#turn-title').inner_text())
    print('IUS mines head:', page.locator('.mine-grid').locator('xpath=..').locator('.fine').first.inner_text())
    print('IUS journal:', [x for x in page.locator('#journal-body').inner_text().split('\n') if x.strip()][:6])
    page.click('button[data-do="card"][data-value="0/mine"]'); page.wait_for_timeout(100)
    print('IUS mine info:', page.locator('.choice-info').inner_text())
    page.click('button[data-do="commit"]'); page.wait_for_timeout(200)
    st = saved(page)
    print('IUS after draw: deck', len(st['mineDeck']), 'discard', len(st['mineDiscard']), 'mixed', st['mineMixed'], 'drawn', st['pending'][0]['drawn'] if st['pending'] else None)
    print('IUS mines head:', page.locator('.mine-grid').locator('xpath=..').locator('.fine').first.inner_text())
    page.click('#undo'); page.wait_for_timeout(150); st = saved(page)
    print('IUS undo draw -> deck', len(st['mineDeck']), 'mixed', st['mineMixed'])
    page.click('#undo'); page.wait_for_timeout(150); st = saved(page)
    print('IUS undo round end -> round', st['round'], 'ore', st['ore'], 'deck', len(st['mineDeck']))
    page.reload(); page.wait_for_timeout(300); st = saved(page)
    print('IUS reload -> round', st['round'], 'deck', len(st['mineDeck']), '| rival board rows', board_rows(page, 1))
    page.screenshot(path=str(OUT / 'ius.png'), full_page=True)
    print('errors:', errs)
    b.close()
