#!/usr/bin/env python3
"""Build the Mincmistr print packet and the app's offline rules and reference."""
import argparse
from io import BytesIO
import json
import os
from pathlib import Path
import re

import markdown

HERE = Path(__file__).resolve().parent
data = json.loads((HERE / 'cards.json').read_text(encoding='utf-8'))
rules_md = (HERE / 'rules.md').read_text(encoding='utf-8')

ROW_NAMES = {0: 'Mine / Joker', 1: 'Mine / Plot', 2: 'Build / Income', 3: 'Build / Plot', 4: 'Rights / Income', 5: 'Rights / St. Barbara'}

def ref_cards(headings=True):
    def start(title):
        heading = f'<div class="rhead">{title}</div>' if headings else ''
        return f'<div class="card ref">{heading}'

    row = ''.join(f'<li>{ROW_NAMES[c]}</li>' for c in data['row'])
    dot = lambda c: f'<span class="dot" style="background:{c}"></span>'
    c1 = f'''{start('Card play')}
      <ol class="steps">
        <li><b>Flip</b> a Plan. Keep it for bonuses.</li>
        <li>Under <b>20 g</b>: <b>Income</b>.</li>
        <li><b>2+ pelicans</b> or 1 on tile 6–9 or 11: <b>St. Barbara</b>.</li>
        <li>First <b>possible goal</b>, top first.</li>
        <li>Else <b>Income</b>, else <b>Mine</b>, else discard the leftmost card.</li>
      </ol>
      <div class="rhead2">Row</div>
      <div class="rsub">Skip unavailable actions. Use the leftmost matching card. Never use the Joker.</div>
      <ol class="row">{row}</ol>
      <p class="small">Taxes: pays if able.</p></div>'''
    c2 = f'''{start('Goals')}
      <p><b style="color:#9b3b2e">Construct</b>, first possible:<br>
      1. <b>Build</b> with a right and a plot.<br>
      2. <b>Plot</b> if rights &gt; plots and plots &lt; 3.<br>
      3. <b>Rights</b> with fewer than 2 rights.</p>
      <p><b style="color:#3d4f63">Mine</b>: use a pool miner; if empty, pay one permit fee to recruit up to 2. Skip if unable.</p>
      <p><b style="color:#a0761c">St. Barbara</b>: spend a pelican.</p>
      <p><b style="color:#5a4a86">Income</b>: seat the available patrician with the biggest <b>edge ≥ 1</b> if it can pay 10 g. Ties: green, silver, yellow, red.</p>
      <p class="small"><b>Edge</b>: own VP per patrician minus the best opponent's.</p>
      <div class="edge">{dot('#3f8a4a')} 1 per public neighbour of each of its buildings<br>
      {dot('#a9b0b8')} 3 VP per complete pair of used pelicans<br>
      {dot('#d8b43a')} 2 VP with a mine in every row; 4 VP with 2+ in every row<br>
      {dot('#b8432f')} 3 per full column of removed houses</div>
      <p class="levels small"><b>Journeyman</b>: as written. <b>Master</b>: play both remaining cards on its last turn in the final 3 rounds. <b>Grandmaster</b>: every round.</p></div>'''
    c3 = f'''{start('Choices')}
      <p><b>Buy Rights</b>: affordable own guild, house left, enough demand. Most production × price, then cost, higher row, leftmost.</p>
      <p><b>Plot</b>: best dot count of any held right (0 if none), then cost, then arrow.</p>
      <p><b>Build</b>: production (0 for public), dots, arrow, first acquired.</p>
      <p><b>Mine</b>: keep most ★ + ore + VP, then most ★, first drawn. Place by row VP gain, cost, fewest own mines in row, arrow.</p>
      <p><b>Free right</b>: on offer with a slot free. House reward: public only. St. Barbara 2: public, else own guild. Printed public rewards: VP + 2 × pelicans + 2 × reputation. Guild: production × price. Ties: higher row, leftmost.</p>
      <p><b>House row (if a choice)</b>: nonempty row with most removed; topmost if tied.</p>
      <p class="small"><b>Apprentice</b>: Plot by cost, arrow. Build skips dots. Keep the normal mine tile choice. Place by fewest own mines in row, cost, arrow.</p></div>'''
    return [c1, c2, c3]


def aid_markup(filename):
    return markdown.markdown((HERE / filename).read_text(encoding='utf-8'), extensions=['tables'])


def app_reference(out_html):
    cards = ''.join(ref_cards())
    mine = aid_markup('mine-aid.md')
    reference = aid_markup('reference-sheet.md')
    rules = markdown.markdown(rules_md, extensions=['tables'])
    # Both modes open the same full rules and can focus the numbered check.
    rules = re.sub(
        r'<(h[23]|p)>(<strong>)?(\d+(?:\.\d+)?)(?=\.?\s)',
        lambda m: f'<{m[1]} id="mincmistr-rule-{m[3]}" tabindex="-1">{m[2] or ""}{m[3]}',
        rules,
    )
    Path(out_html).write_text(f'''<div id="paper-ref-cards">{cards}</div>
<section id="paper-ref-table" class="reference-prose" hidden>
  {reference}
  <button type="button" class="outline" id="paper-print-table">Print table reference</button>
</section>
<section id="paper-ref-mine" class="reference-prose" hidden>
  {mine}
  <button type="button" class="outline" id="paper-print-mine">Print mine aid</button>
</section>
<section id="paper-ref-rules" class="reference-prose" hidden>{rules}</section>
''', encoding='utf-8')


def print_fonts():
    import fitz

    folder = Path(os.environ.get('DEJAVU_FONTS', '/usr/share/fonts/truetype/dejavu'))
    faces = []
    for family, stem, italic in [('DejaVu Serif', 'DejaVuSerif', 'Italic'), ('DejaVu Sans', 'DejaVuSans', 'Oblique')]:
        for suffix, style, weight in [('', 'normal', 'normal'), ('-Bold', 'normal', 'bold'), ('-' + italic, 'italic', 'normal')]:
            name = f'{stem}{suffix}.ttf'
            if not (folder / name).is_file():
                raise FileNotFoundError(f'Set DEJAVU_FONTS to the folder containing {name}.')
            faces.append(f"@font-face {{font-family:'{family}';font-style:{style};font-weight:{weight};src:url({name});}}")
    return '\n'.join(faces), fitz.Archive(str(folder))


def text_pages(sections, css, archive, paper, margin):
    import fitz

    stream = BytesIO()
    with fitz.DocumentWriter(stream, 'compress') as writer:
        for number, body in enumerate(sections, 1):
            story = fitz.Story(body, user_css=css, archive=archive)
            more, _ = story.place(paper + margin)
            if more:
                raise ValueError(f'Text does not fit on page {number}. Adjust spacing or move a section.')
            story.draw(writer.begin_page(paper))
            writer.end_page()
    return fitz.open(stream=stream.getvalue(), filetype='pdf')


def aid_page(filename, paper, fonts, archive):
    css = fonts + (HERE / 'style.css').read_text(encoding='utf-8')
    return text_pages([f'<article class="aid">{aid_markup(filename)}</article>'], css, archive, paper, (34, 32, -34, -32))


def save_pdf(doc, path, title):
    doc.subset_fonts()
    doc.set_metadata({'title': title, 'author': 'Kutná Hora Solo'})
    doc.save(path, garbage=4, deflate=True, no_new_id=True)


def print_packet(output):
    import fitz
    from card_sheets import add_card_sheets

    fonts, archive = print_fonts()
    css = fonts + (HERE / 'style.css').read_text(encoding='utf-8')
    paper = fitz.paper_rect('letter')
    page_starts = ('**4.3 Plan.**', '### 6.5 Bonus steps', '## 9. Difficulty')
    breaks = [0, *(rules_md.index(heading) for heading in page_starts), len(rules_md)]
    sections = []
    for start, end in zip(breaks, breaks[1:]):
        body = markdown.markdown(rules_md[start:end], extensions=['tables'])
        sections.append(f'<article class="rules">{body}</article>')

    with text_pages(sections, css, archive, paper, (46.8, 36, -46.8, -36)) as doc:
        add_card_sheets(doc, data['deck'], ref_cards(headings=False), css, archive)
        for filename in ['reference-sheet.md', 'mine-aid.md']:
            with aid_page(filename, paper, fonts, archive) as aid:
                doc.insert_pdf(aid)
        doc.set_toc([
            [1, 'Rules', 1],
            [1, 'Plan cards 1–9', 5],
            [2, 'Optional backs', 6],
            [1, 'Plan cards 10–15 and reference cards', 7],
            [2, 'Optional backs', 8],
            [1, 'Table reference', 9],
            [1, 'Mine choice aid', 10],
        ])
        save_pdf(doc, output, 'The Mincmistr — print and play')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--pdf', metavar='OUTPUT')
    mode.add_argument('--app-reference', metavar='OUTPUT')
    mode.add_argument('--table-reference', nargs=2, metavar=('SIZE', 'OUTPUT'))
    args = parser.parse_args()
    if args.pdf:
        print_packet(args.pdf)
    elif args.app_reference:
        app_reference(args.app_reference)
    else:
        import fitz

        size, output = args.table_reference
        if size.lower() not in ('letter', 'a4'):
            parser.error('Choose letter or a4 for --table-reference.')
        fonts, archive = print_fonts()
        with aid_page('reference-sheet.md', fitz.paper_rect(size.lower()), fonts, archive) as doc:
            save_pdf(doc, output, 'Mincmistr table reference')
