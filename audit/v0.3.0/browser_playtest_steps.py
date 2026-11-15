"""v0.3.0 shipped page through its controls: README one/two/three-rival checks, full games via the UI,
Play rivals flow, Undo, reload, export/import, and phone width at four players."""
import json, os, pathlib, sys
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).resolve().parent
HTML = (HERE.parents[1] / 'Kutna_Hora_Solo.html').as_uri()
OUT = HERE / 'shots'; OUT.mkdir(exist_ok=True)
KEY = 'kutna-hora-solo-v1'
CHROME = os.environ.get('CHROME')

def st(page):
    raw = page.evaluate(f"localStorage.getItem('{KEY}')")
    return json.loads(raw)['state'] if raw else None

def new_game(page, rivals, card, seed, starter='0', events=False):
    page.click('header button[data-do="dialog"][data-value="setup"]')
    page.select_option('#player-count', str(rivals + 1)); page.wait_for_timeout(50)
    page.select_option('#guild-setup', str(card)); page.wait_for_timeout(50)
    page.select_option('select[name="starter"]', starter)
    if rivals > 1 and events: page.check('input[name="events"]')
    page.fill('input[name="seed"]', seed)
    note = page.locator('#opening-note').inner_text()
    page.click('#setup-form button[type="submit"]'); page.wait_for_timeout(250)
    return note

def step(page):
    """One human-side click: rival button, else commit a pending/tax choice, else play the first available card."""
    if page.locator('button[data-do="rival"]').count():
        page.click('button[data-do="rival"]')
        page.wait_for_function("!document.querySelector('button[data-do=\"rival\"][aria-busy=\"true\"]')", timeout=60000)
        return 'rival'
    s = st(page)
    if s['phase'] == 'tax' or s['pending']:
        page.click('button[data-do="commit"]'); return 'commit'
    cards = page.locator('.cards button[data-do="card"]:not([disabled])')
    if cards.count():
        cards.first.click(); page.wait_for_timeout(30)
        page.click('button[data-do="commit"]'); return 'card'
    page.click('details.pass summary'); page.locator('details.pass button[data-do="card"]').first.click()
    page.click('button[data-do="commit"]'); return 'skip'

def play_out(page, label):
    seen = {'redAfter': None, 'council': set(), 'rounds': 0, 'rivalClicks': 0}
    prev = st(page)
    for _ in range(1500):
        s = st(page)
        if s and s['phase'] == 'end': break
        kind = step(page)
        seen['rivalClicks'] += kind == 'rival'
        s = st(page)
        if s['round'] != prev['round'] or s['phase'] == 'end':
            if seen['redAfter'] is None and any(stk['tiles'][0] in ('town-hall', 'smallcastle', 'school') and len(stk['tiles']) == 1 for row in s['market'] for stk in row):
                seen['redAfter'] = prev['round']
            if any(l['round'] == prev['round'] and 'town council' in l['text'] for l in s['log']): seen['council'].add(prev['round'])
        prev = s
    s = st(page)
    rows = page.locator('#score table tbody tr, .score table tbody tr').count() if s['phase'] == 'end' else 0
    print(f'{label}: phase {s["phase"]} rounds {s["round"]} red after {seen["redAfter"]} council rounds {sorted(seen["council"])} rival clicks {seen["rivalClicks"]} winners {s["result"]["winners"] if s.get("result") else None}')
    print(f'{label}: final headline:', page.locator('#turn-title').inner_text(), '| score columns:', page.locator('table').first.locator('thead th').all_inner_texts()[:6])
    return s

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.goto(HTML); page.wait_for_timeout(300)
    print('version:', page.locator('.eyebrow').inner_text())
    print('1 rival default rows:', page.locator('.player.seat-1 .guild-line').inner_text())

    note = new_game(page, 2, 6, 'app-table-3')
    s = st(page)
    print('2 rivals note:', note)
    print('2 rivals: players', len(s['players']), 'town', len(s['city']), 'mine', len(s['mine']), 'coins', [x['coins'] for x in s['players']], 'events', s['events'], 'guilds', [x['guilds'] for x in s['players']])
    print('2 rivals: town cells', page.locator('.town-grid [data-space], .town-grid > *').count(), '| rival card panels', page.locator('.rival-cards').count(), '| round label', page.locator('#dashboard').inner_text().split('\n')[:3])
    page.screenshot(path=str(OUT / 'two_rivals.png'), full_page=True)
    play_out(page, '2 rivals')

    note = new_game(page, 3, 6, 'app-table-4', starter='1')
    s = st(page)
    print('3 rivals note:', note, '| starter', s['starter'], 'actor', s['actor'], 'coins', [x['coins'] for x in s['players']])
    before = s
    page.click('button[data-do="rival"]')
    page.wait_for_function("!document.querySelector('button[data-do=\"rival\"][aria-busy=\"true\"]')", timeout=60000)
    s = st(page)
    actors = [l['actor'] for l in s['log'] if l['round'] == 1 and l['actor'] is not None]
    print('3 rivals Play rivals -> actor', s['actor'], 'turn', s['turn'], '| journal actors in order', actors[:12])
    print('3 rivals notes:', page.locator('.rival-report').inner_text().replace('\n', ' | ')[:400] if page.locator('.rival-report').count() else '-')
    page.click('#undo'); page.wait_for_timeout(150)
    print('3 rivals Undo restores pre-rival state:', json.dumps(st(page), sort_keys=True) == json.dumps(before, sort_keys=True))
    page.click('button[data-do="rival"]')
    page.wait_for_function("!document.querySelector('button[data-do=\"rival\"][aria-busy=\"true\"]')", timeout=60000)
    with page.expect_download() as dl:
        page.click('footer button[data-do="export"]')
    path = OUT / 'four.json'; dl.value.save_as(str(path)); exported = json.loads(path.read_text())['state']
    page.reload(); page.wait_for_timeout(300)
    print('3 rivals reload keeps position:', json.dumps(st(page), sort_keys=True) == json.dumps(exported, sort_keys=True))
    new_game(page, 1, 1, 'x')
    page.set_input_files('#file', str(path)); page.wait_for_timeout(300)
    print('3 rivals import:', page.locator('#flash').inner_text(), '| identical:', json.dumps(st(page), sort_keys=True) == json.dumps(exported, sort_keys=True))
    page.screenshot(path=str(OUT / 'three_rivals.png'), full_page=True)
    play_out(page, '3 rivals')

    new_game(page, 3, 2, 'events-4p', events=True)
    s = st(page); print('3 rivals + events:', s['events'])
    play_out(page, '3 rivals events')

    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.goto(HTML); m.wait_for_timeout(200)
    m.set_input_files('#file', str(path)); m.wait_for_timeout(300)
    over = m.evaluate('''[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>window.innerWidth+1}).slice(0,6).map(e=>(e.className||e.tagName)+'')''')
    print('phone 4 players: scrollWidth', m.evaluate('document.documentElement.scrollWidth'), '| overflowing:', over)
    m.screenshot(path=str(OUT / 'phone4.png'), full_page=True)
    print('errors:', errs)
    b.close()
