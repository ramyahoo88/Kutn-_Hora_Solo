"""Drive the shipped offline HTML through its own controls with Playwright (Chromium)."""
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
HTML = (HERE.parents[1] / 'Kutna_Hora_Solo.html').as_uri()
CHROME = os.environ.get('CHROME')  # optional Chrome/Chromium path if Playwright's bundled browser is not installed
OUT = HERE / 'shots'; OUT.mkdir(exist_ok=True)
KEY = 'kutna-hora-solo-v1'

def saved(page):
    raw = page.evaluate(f"localStorage.getItem('{KEY}')")
    return json.loads(raw)['state'] if raw else None

def text(page, sel):
    return page.locator(sel).inner_text()

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto(HTML)
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / '01_start.png'), full_page=True)
    print('version tag:', text(page, '.eyebrow'))
    print('dashboard:', text(page, '#dashboard').replace('\n', ' | '))
    print('market head:', text(page, '.offer-head').replace('\n', ' | '))
    print('prices:', text(page, '.prices').replace('\n', ' '))
    print('autosave before any move:', saved(page) is not None)

    # --- Player board dialog (both seats)
    for seat in ('0', '1'):
        page.click(f'button[data-do="player-board"][data-value="{seat}"]')
        print(f'player board {seat}:', text(page, '#player-board-body').replace('\n', ' | ')[:900])
        page.screenshot(path=str(OUT / f'02_board_{seat}.png'))
        page.click('#player-board-dialog button[data-do="close"]')

    # --- Play Rights / Income card half "Rights", inspect preview text, commit
    page.click('button[data-do="card"][data-value="4/rights"]')
    page.wait_for_timeout(100)
    print('rights panel:', text(page, '.choices').replace('\n', ' | ')[:700])

    # --- Mine half of card 0; draw then place; compare preview with applied state
    page.click('button[data-do="card"][data-value="0/mine"]')
    page.click('button[data-do="commit"]')
    page.wait_for_timeout(100)
    before = saved(page)
    print('pending after draw:', before['pending'])
    preview = text(page, '.choice-info')
    label = page.locator('#action-option option:checked').inner_text() if page.locator('#action-option').count() else ''
    print('place preview:', label, '|', preview.replace('\n', ' | '))
    page.screenshot(path=str(OUT / '03_mine_preview.png'), full_page=True)
    page.click('button[data-do="commit"]')
    page.wait_for_timeout(100)
    after = saved(page)
    me0, me1 = before['players'][0], after['players'][0]
    print('applied: coins', me0['coins'], '->', me1['coins'], '| ore prod', me0['production']['ore'], '->', me1['production']['ore'],
          '| pop', before['pop'], '->', after['pop'], '| ore deck', before['ore'], '->', after['ore'], '| vp', me0['vp'], '->', me1['vp'])

    # --- Undo, then redo; reload restores autosave
    page.click('#undo')
    page.wait_for_timeout(100)
    undone = saved(page)
    print('undo restores pending draw:', undone['pending'] == before['pending'] and undone['players'] == before['players'])
    page.click('button[data-do="commit"]')
    page.wait_for_timeout(100)
    page.reload(); page.wait_for_timeout(300)
    print('reload restores state:', saved(page)['players'] == after['players'] and text(page, '#turn-title'))
    print('undo enabled after reload:', page.locator('#undo').is_enabled())

    # --- Second card: Rights, then rival turn
    page.click('button[data-do="card"][data-value="4/rights"]')
    page.click('button[data-do="commit"]')
    page.wait_for_timeout(100)
    print('turn title now:', text(page, '#turn-title'))
    page.click('button[data-do="rival"]')
    page.wait_for_timeout(4000)
    print('after rival:', text(page, '#turn-title'), '| notes:', text(page, '.rival-report').replace('\n', ' | ')[:500] if page.locator('.rival-report').count() else '-')
    print('rival hand:', text(page, '#rival-hand').replace('\n', ' | '))

    # --- Export, then import the exported file
    with page.expect_download() as dl:
        page.click('footer button[data-do="export"]')
    path = OUT / 'export.json'; dl.value.save_as(str(path))
    exported = json.loads(path.read_text())
    print('export kind/schema:', exported['kind'], exported['state']['schema'], 'round', exported['state']['round'])
    page.set_input_files('#file', str(path))
    page.wait_for_timeout(300)
    print('import flash:', text(page, '#flash'))

    # --- Import a corrupted save
    bad = dict(exported); bad['state'] = dict(exported['state']); bad['state']['tax'] = 99
    (OUT / 'bad.json').write_text(json.dumps(bad))
    page.set_input_files('#file', str(OUT / 'bad.json'))
    page.wait_for_timeout(300)
    print('bad import flash:', text(page, '#flash'))

    # --- Corrupt autosave then reload: recovery path
    page.evaluate(f"localStorage.setItem('{KEY}', '{{not json')")
    page.reload(); page.wait_for_timeout(300)
    print('corrupt autosave banner:', page.locator('#save-status').is_visible(), '|', text(page, '#save-warning'))
    print('download unreadable visible:', page.locator('#export-unreadable').is_visible())
    page.screenshot(path=str(OUT / '04_corrupt.png'), full_page=True)

    # --- Guide text and new-game dialog
    page.click('button[data-do="dialog"][data-value="help"]')
    print('guide:', text(page, '#help-dialog .guide')[:1600].replace('\n', ' || '))
    page.click('#help-dialog button[data-do="close"]')
    page.click('header button[data-do="dialog"][data-value="setup"]')
    print('setup rows options:', page.locator('#guild-rows option').all_inner_texts())
    print('opening note:', text(page, '#opening-note'))
    page.screenshot(path=str(OUT / '05_setup.png'))
    print('console errors:', errors)
    b.close()
