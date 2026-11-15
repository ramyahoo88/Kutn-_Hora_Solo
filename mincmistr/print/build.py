#!/usr/bin/env python3
"""Build the Mincmistr print-and-play: rules pages + Plan cards + reference cards -> one HTML -> PDF.
Card data comes from cards.json, exported from mincmistr.mjs, so the printed deck always matches the code."""
import json, pathlib, subprocess, sys, html
import markdown

HERE = pathlib.Path(__file__).parent
data = json.loads((HERE / 'cards.json').read_text())
rules_md = (HERE / 'rules.md').read_text()

GOALS = {
    'C': ('Construct', 'Build ▸ Plot ▸ Rights', '#9b3b2e'),
    'M': ('Mine', 'Pool miner, else recruit', '#3d4f63'),
    'S': ('St. Barbara', 'Contribute a pelican', '#a0761c'),
}
SUBS = {
    'C': ['Build: holds a right and a plot', 'Plot: rights &gt; plots, under 3 plots', 'Rights: holds fewer than 2'],
    'M': ['Use a pool miner', 'Pool empty: recruit up to 2', 'Keep most ★ + ore + VP'],
    'S': ['Needs a pelican', 'Resolve the current tile'],
}

# Simple original icons (no game art).
ICONS = {
    'C': '<svg viewBox="0 0 40 40"><path d="M6 20 L20 7 L34 20" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><rect x="10" y="19" width="20" height="15" fill="none" stroke="currentColor" stroke-width="3.2"/><rect x="17.5" y="25" width="5" height="9" fill="currentColor"/></svg>',
    'M': '<svg viewBox="0 0 40 40"><g stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><line x1="9" y1="31" x2="29" y2="11"/><line x1="11" y1="11" x2="31" y2="31"/></g><path d="M23 6 L34 9 L31 17 Z" fill="currentColor"/><rect x="4" y="5" width="11" height="7" rx="1.5" transform="rotate(45 9.5 8.5)" fill="currentColor"/></svg>',
    'I': '<svg viewBox="0 0 40 40"><circle cx="20" cy="11" r="5.5" fill="currentColor"/><path d="M9 35 C9 24 13 19 20 19 C27 19 31 24 31 35 Z" fill="currentColor"/><path d="M14 23 L20 31 L26 23" fill="none" stroke="#fff" stroke-width="1.8"/></svg>',
    'S': '<svg viewBox="0 0 40 40"><g fill="currentColor"><path d="M6 35 L6 22 L10 13 L14 22 L14 35 Z"/><path d="M15 35 L15 18 L20 6 L25 18 L25 35 Z"/><path d="M26 35 L26 22 L30 13 L34 22 L34 35 Z"/></g><rect x="18" y="27" width="4" height="8" rx="2" fill="#fff"/></svg>',
}

def esc(s): return html.escape(s, quote=False)

def plan_card(card):
    rows = []
    for i, g in enumerate(card['goals']):
        name, sub, color = GOALS[g]
        rows.append(f'''<div class="goal g{i+1}" style="--c:{color}">
          <div class="rank">{i+1}</div><div class="icon">{ICONS[g]}</div>
          <div class="gtext"><div class="gname">{name}</div>{''.join(f'<div class="gsub">{x}</div>' for x in (SUBS[g] if i == 0 else [sub]))}</div></div>''')
    arrow = card['arrow']
    band = ('<span class="arr">◀</span> ties: earliest space' if arrow == 'low'
            else 'ties: latest space <span class="arr">▶</span>')
    return f'''<div class="card plan">
      <div class="phead"><span class="ptitle">Plan</span><span class="pnum">{card['number']}/15</span></div>
      <div class="pre"><b>&lt;20 g</b>: Income<br><b>2 pelicans</b>, or 1 on a prize tile: St. Barbara</div>
      <div class="goals">{''.join(rows)}</div>
      <div class="band {arrow}">{band}</div>
    </div>'''

def back_card():
    return f'''<div class="card back"><div class="backin">
      <div class="coin"><div class="coinin">{ICONS['M']}</div></div>
      <div class="btitle">The Mincmistr</div><div class="bsub">Plan</div></div></div>'''

ROW_NAMES = {0: 'Mine / Joker', 1: 'Mine / Plot', 2: 'Build / Income', 3: 'Build / Plot', 4: 'Rights / Income', 5: 'Rights / St. Barbara'}

def ref_cards():
    row = ''.join(f'<li>{ROW_NAMES[c]}</li>' for c in data['row'])
    dot = lambda c: f'<span class="dot" style="background:{c}"></span>'
    c1 = f'''<div class="card ref"><div class="rhead">Card play</div>
      <ol class="steps">
        <li><b>Flip</b> a Plan card.</li>
        <li>Fewer than <b>20 g</b>: <b>Income</b>.</li>
        <li><b>2+ pelicans</b>, or 1 on prize tile 6–9 or 11: <b>St. Barbara</b>.</li>
        <li>Else the first <b>possible goal</b> on the Plan card, top to bottom.</li>
        <li>Else <b>Income</b>, else <b>Mine</b>, else discard the leftmost card.</li>
      </ol>
      <div class="rhead2">Row</div>
      <div class="rsub">Left to right. Use the leftmost card that shows the action. Never the Joker.</div>
      <ol class="row">{row}</ol>
      <p class="small">Taxes: pays if able.</p></div>'''
    c2 = f'''<div class="card ref"><div class="rhead">Goals</div>
      <p><b style="color:#9b3b2e">Construct</b>, first possible:<br>
      1. <b>Build</b> if it holds a right and a plot.<br>
      2. <b>Plot</b> if rights &gt; plots and plots &lt; 3.<br>
      3. <b>Rights</b> if it holds fewer than 2 rights.</p>
      <p><b style="color:#3d4f63">Mine</b>: use a pool miner; if none, recruit up to 2.</p>
      <p><b style="color:#a0761c">St. Barbara</b>: contribute a pelican.</p>
      <p><b style="color:#5a4a86">Income</b>: seats the patrician with the biggest <b>edge ≥ 1</b> if it can pay 10 g (ties: green, silver, yellow, red).</p>
      <p class="small">Edge = points one patrician gives it − points it gives you:</p>
      <div class="edge">{dot('#3f8a4a')} 1 per public building next to each of its buildings<br>
      {dot('#a9b0b8')} 3 per 2 pelicans used<br>
      {dot('#d8b43a')} 2 per mine in its weakest row (max 2)<br>
      {dot('#b8432f')} 3 per full column of removed houses</div></div>'''
    c3 = '''<div class="card ref"><div class="rhead">Choices</div>
      <p><b>Rights</b>: buildable guild tile, most production × price. Never public. Ties: cheaper, higher row.</p>
      <p><b>Plot</b>: most town points for a held right. Ties: cheaper, arrow.</p>
      <p><b>Build</b>: most production (public = 0), on the plot with most town points. Ties: arrow.</p>
      <p><b>Mine tile</b>: keep most stars + ore + VP. Place for most row points gained; ties: cheapest, fewest of its mines, arrow.</p>
      <p><b>Free right</b>: public, most VP + 2/pelican + 2/rep. <b>House</b>: row with most removed.</p>
      <div class="rhead2">Difficulty</div>
      <p class="small"><b>Apprentice</b>: no point maths in Plot, Build, Mine.<br><b>Journeyman</b>: as written.<br><b>Master</b>: rounds 4–6, last turn plays both.<br><b>Grandmaster</b>: same, every round.</p></div>'''
    return [c1, c2, c3]

CSS = (HERE / 'style.css').read_text()

def sheet(cards, cls='sheet', note=''):
    cells = ''.join(cards) + ''.join('<div class="card blank"></div>' for _ in range(9 - len(cards)))
    foot = f'<div class="sheetnote">{note}</div>' if note else ''
    return f'<section class="{cls}"><div class="grid">{cells}</div>{foot}</section>'

def main(out_html, out_pdf):
    body = markdown.markdown(rules_md, extensions=['tables'])
    deck = data['deck']
    fronts = [plan_card(c) for c in deck]
    pages = [f'<section class="rules">{body}</section>']
    note = 'The Mincmistr · print at 100% (actual size) · cut on the dashed lines · cards are 63.5 × 88.9 mm'
    pages.append(sheet(fronts[:9], note=note + ' · sheet 1 of 2, fronts'))
    pages.append(sheet([back_card() for _ in range(9)], 'sheet backs', 'Optional backs for sheet 1 · print on the reverse, flip on the long edge'))
    pages.append(sheet(fronts[9:] + ref_cards(), note=note + ' · sheet 2 of 2, fronts'))
    pages.append(sheet([back_card() for _ in range(6)], 'sheet backs', 'Optional backs for sheet 2 · print on the reverse, flip on the long edge · reference cards have no back'))
    doc = f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>The Mincmistr — print and play</title><style>{CSS}</style></head><body>{"".join(pages)}</body></html>'
    pathlib.Path(out_html).write_text(doc)
    subprocess.run(['/usr/bin/google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
                    f'--print-to-pdf={out_pdf}', f'file://{pathlib.Path(out_html).resolve()}'], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
