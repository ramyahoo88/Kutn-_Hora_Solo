#!/usr/bin/env python3
"""Build the Mincmistr print-and-play: rules pages + Plan cards + reference cards -> one HTML -> PDF.
Card data comes from cards.json, exported from mincmistr.mjs, so the printed deck always matches the code."""
import json, pathlib, re, shutil, subprocess, sys, html
import markdown

HERE = pathlib.Path(__file__).parent
data = json.loads((HERE / 'cards.json').read_text(encoding='utf-8'))
rules_md = (HERE / 'rules.md').read_text(encoding='utf-8')

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

PLAN_CHECKS = '<b>&lt;20 g</b>: Income<br><b>2+ pelicans</b>, or 1 on a prize tile: St. Barbara'

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
      <div class="pre">{PLAN_CHECKS}</div>
      <div class="goals">{''.join(rows)}</div>
      <div class="band {arrow}">{band}</div>
    </div>'''

def back_card():
    return f'''<div class="card back"><div class="backin">
      <div class="coin"><div class="coinin">{ICONS['M']}</div></div>
      <div class="btitle">The Mincmistr</div><div class="bsub">Plan</div></div></div>'''

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
      <p><b style="color:#3d4f63">Mine</b>: use a pool miner, or recruit up to 2 if empty.</p>
      <p><b style="color:#a0761c">St. Barbara</b>: spend a pelican.</p>
      <p><b style="color:#5a4a86">Income</b>: seat the available patrician with the biggest <b>edge ≥ 1</b> if it can pay 10 g. Ties: green, silver, yellow, red.</p>
      <p class="small"><b>Edge</b>: own VP per patrician minus the best opponent's.</p>
      <div class="edge">{dot('#3f8a4a')} 1 per public neighbour of each of its buildings<br>
      {dot('#a9b0b8')} 3 per 2 pelicans used<br>
      {dot('#d8b43a')} 2 per mine in its weakest row (max 2)<br>
      {dot('#b8432f')} 3 per full column of removed houses</div>
      <p class="levels small"><b>Journeyman</b>: as written. <b>Master</b>: play both remaining cards on its last turn in the final 3 rounds. <b>Grandmaster</b>: every round.</p></div>'''
    c3 = f'''{start('Choices')}
      <p><b>Buy Rights</b>: affordable own guild, house left, demand permits building. Most production × price, then cost, higher row, leftmost.</p>
      <p><b>Plot</b>: best dot count of any held right (0 if none), then cost, then arrow.</p>
      <p><b>Build</b>: production (0 for public), dots, arrow, first acquired.</p>
      <p><b>Mine</b>: keep most ★ + ore + VP, then most ★, first drawn. Place by row VP gain, cost, fewest own mines in row, arrow.</p>
      <p><b>Free right</b>: house rewards are public only. St. Barbara 2: eligible public, else eligible own guild. Rank by VP + 2/pelican + 2/rep (public) or production × price (guild). Ties: higher row, leftmost.</p>
      <p><b>Remove house</b>: nonempty row with most removed. Topmost if tied.</p>
      <p class="small"><b>Apprentice</b>: Plot by cost, arrow. Build skips dots. Keep the normal mine tile choice. Place by fewest own mines in row, cost, arrow.</p></div>'''
    return [c1, c2, c3]

CSS = (HERE / 'style.css').read_text()

def sheet(cards, cls='sheet', note=''):
    cells = ''.join(cards) + ''.join('<div class="card blank"></div>' for _ in range(9 - len(cards)))
    foot = f'<div class="sheetnote">{note}</div>' if note else ''
    return f'<section class="{cls}"><div class="grid">{cells}</div>{foot}</section>'

def app_reference(out_html):
    cards = ''.join(ref_cards())
    mine = markdown.markdown((HERE / 'mine-aid.md').read_text(encoding='utf-8'), extensions=['tables'])
    reference = markdown.markdown((HERE / 'reference-sheet.md').read_text(encoding='utf-8'))
    rules = markdown.markdown(rules_md, extensions=['tables'])
    # Both modes open the same full rules and can focus the numbered check.
    rules = re.sub(
        r'<(h[23]|p)>(<strong>)?(\d+(?:\.\d+)?)(?=\.?\s)',
        lambda m: f'<{m[1]} id="mincmistr-rule-{m[3]}" tabindex="-1">{m[2] or ""}{m[3]}',
        rules,
    )
    pathlib.Path(out_html).write_text(f'''<div id="paper-ref-cards">{cards}</div>
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

def table_reference(size, out_pdf):
    """Render the same table reference as the app, at full size on one sheet."""
    import os
    import xml.etree.ElementTree as ET
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.platypus import Paragraph, SimpleDocTemplate

    page_size = {'letter': letter, 'a4': A4}[size.lower()]
    fonts = pathlib.Path(os.environ.get('DEJAVU_FONTS', '/usr/share/fonts/truetype/dejavu'))
    for name, suffix in [('TableSans', ''), ('TableSansBold', '-Bold')]:
        pdfmetrics.registerFont(TTFont(name, str(fonts / f'DejaVuSans{suffix}.ttf')))
    pdfmetrics.registerFontFamily('TableSans', normal='TableSans', bold='TableSansBold')

    dark = HexColor('#2c2520')
    accent = HexColor('#5b2a1f')
    margin = 34
    body = ParagraphStyle('Body', fontName='TableSans', fontSize=11, leading=13.5, spaceAfter=4, textColor=dark)
    numbered = ParagraphStyle('Step', parent=body, leftIndent=18, bulletIndent=1, spaceAfter=2)
    title = ParagraphStyle('Title', parent=body, fontName='TableSansBold', fontSize=24, leading=28, spaceAfter=6, textColor=accent)
    heading = ParagraphStyle('Heading', parent=body, fontName='TableSansBold', fontSize=12.2, leading=14,
                             spaceBefore=6, spaceAfter=3, textColor=accent, keepWithNext=True)

    def inline(node):
        body_html = html.escape(node.text or '') + ''.join(ET.tostring(child, encoding='unicode') for child in node)
        return body_html.replace('<strong>', '<b>').replace('</strong>', '</b>')

    story = []
    markup = markdown.markdown((HERE / 'reference-sheet.md').read_text(encoding='utf-8'))
    for node in ET.fromstring(f'<article>{markup}</article>'):
        if node.tag == 'ol':
            story.extend(Paragraph(inline(item), numbered, bulletText=f'{i}.') for i, item in enumerate(node, 1))
        else:
            story.append(Paragraph(inline(node), {'h1': title, 'h2': heading, 'p': body}[node.tag]))

    def footer(canvas, doc):
        if doc.page != 1:
            raise ValueError('The table reference must fit on one page.')
        canvas.setStrokeColor(HexColor('#c9b79c'))
        canvas.line(margin, 31, page_size[0] - margin, 31)
        canvas.setFillColor(accent)
        canvas.setFont('TableSans', 8.5)
        canvas.drawString(margin, 18, f'Table reference · {"A4" if size.lower() == "a4" else "US Letter"} · Print at actual size')

    doc = SimpleDocTemplate(out_pdf, pagesize=page_size, leftMargin=margin, rightMargin=margin,
                            topMargin=32, bottomMargin=42, title='Mincmistr table reference', author='Kutná Hora Solo')
    doc.build(story, onFirstPage=footer, onLaterPages=footer,
              canvasmaker=lambda *args, **kwargs: Canvas(*args, **{**kwargs, 'invariant': 1}))

def refresh_card_text(doc, fonts_css, archive):
    """Replace copy inside the existing frames, keeping the cut marks and backs."""
    import fitz

    plan_css = fonts_css + """
        body { margin: 0; font-family: 'DejaVu Sans'; font-size: 6.2pt;
            line-height: 1.25; color: #6b5a4a; text-align: center; }
    """
    ref_css = fonts_css + CSS.split('/* reference cards */', 1)[1].split('.sheetnote', 1)[0] + """
        body { margin: 0; font-family: 'DejaVu Sans'; }
        .ref { padding: 0; border: 0; background: transparent; }
    """
    refs = [
        re.sub(r'<span class="dot" style="background:(#[0-9a-f]+)"></span>',
               r'<span style="color:\1">●</span>', card)
        for card in ref_cards(headings=False)
    ]
    for page_number, plan_count in [(5, 9), (7, 6)]:
        page = doc[page_number - 1]
        if page.rect != fitz.paper_rect('letter'):
            raise ValueError(f'Expected a Letter card sheet on page {page_number}.')
        boxes = []
        for index in range(9):
            row, column = divmod(index, 3)
            # Centered 3 × 3 grid of 2.5 × 3.5 inch cards on US Letter.
            left, top = 36 + 180 * column, 18 + 252 * row
            if index < plan_count:
                box = fitz.Rect(left + 15, top + 35.5, left + 165, top + 52)
                boxes.append((box, PLAN_CHECKS, plan_css))
                page.add_redact_annot(box, fill=False, cross_out=False)
            else:
                box = fitz.Rect(left + 16.8, top + 36.5, left + 163.5, top + 244)
                boxes.append((box, refs[index - plan_count], ref_css))
                # Cover the old legend's coloured markers as well as the text.
                cover = box + (-2, 0, 2, -2)
                page.add_redact_annot(cover, fill=(1, 253 / 255, 248 / 255), cross_out=False)
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        )
        for index, (box, markup, css) in enumerate(boxes, 1):
            spare, _ = page.insert_htmlbox(box, markup, css=css, archive=archive, scale_low=1)
            if spare < 0:
                raise ValueError(f'Card {index} on page {page_number} no longer fits.')


def refresh_rules(source_pdf, out_pdf, card_text=False):
    """Replace the rules pages and optionally refresh text on the card fronts."""
    from io import BytesIO
    import os
    import fitz

    if pathlib.Path(source_pdf).resolve() == pathlib.Path(out_pdf).resolve():
        raise ValueError('Choose a separate output path for the refreshed PDF.')

    fonts = pathlib.Path(os.environ.get('DEJAVU_FONTS', '/usr/share/fonts/truetype/dejavu'))
    font_faces = []
    for family, stem, italic in [('DejaVu Serif', 'DejaVuSerif', 'Italic'), ('DejaVu Sans', 'DejaVuSans', 'Oblique')]:
        for suffix, style, weight in [('', 'normal', 'normal'), ('-Bold', 'normal', 'bold'), ('-' + italic, 'italic', 'normal')]:
            filename = f'{stem}{suffix}.ttf'
            if not (fonts / filename).is_file():
                raise FileNotFoundError(f'Set DEJAVU_FONTS to the folder containing {filename}.')
            font_faces.append(f"@font-face {{font-family:'{family}';font-style:{style};font-weight:{weight};src:url({filename});}}")
    rules_css = CSS.split('/* ---------- card sheets ---------- */', 1)[0]
    rules_css = '\n'.join(line for line in rules_css.splitlines() if not line.startswith('@page'))
    fonts_css = '\n'.join(font_faces) + '\n'
    css = fonts_css + rules_css + """
        .rules { line-height: 1.14; }
        .rules h2 { margin-top: 8pt; }
        .rules h3 { margin-top: 7pt; }
        .rules p { margin: 2pt 0 3pt; }
        .rules th, .rules td { padding: 1.6pt 5pt; }
    """
    page_starts = ('**4.3 Plan.**', '### 6.5 Bonus steps', '## 10. Two or three Mincmistrs')
    breaks = [0, *(rules_md.index(heading) for heading in page_starts), len(rules_md)]
    stream = BytesIO()
    archive = fitz.Archive(str(fonts))
    with fitz.DocumentWriter(stream, 'compress') as writer:
        for page, (start, end) in enumerate(zip(breaks, breaks[1:]), 1):
            body = markdown.markdown(rules_md[start:end], extensions=['tables'])
            story = fitz.Story(f'<div class="rules">{body}</div>', user_css=css, archive=archive)
            more, _ = story.place(fitz.Rect(46.8, 36, 565.2, 756))
            if more:
                raise ValueError(f'Rules no longer fit page {page}. Adjust page breaks or use the full Chrome build.')
            story.draw(writer.begin_page(fitz.paper_rect('letter')))
            writer.end_page()

    with fitz.open(source_pdf) as source, fitz.open(stream=stream.getvalue(), filetype='pdf') as refreshed:
        if len(source) != 8:
            raise ValueError('Use an eight-page Mincmistr PDF with card sheets on pages 5–8.')
        refreshed.insert_pdf(source, from_page=4, to_page=7)
        if card_text:
            refresh_card_text(refreshed, fonts_css, archive)
        refreshed.subset_fonts()
        refreshed.set_metadata({'title': 'The Mincmistr — print and play'})
        refreshed.save(out_pdf, garbage=4, deflate=True, no_new_id=True)

def main(out_html, out_pdf):
    chrome = shutil.which('google-chrome') or shutil.which('chromium')
    if not chrome:
        raise FileNotFoundError('Install Google Chrome or Chromium to build the print-and-play PDF.')
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
    subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
                    f'--print-to-pdf={out_pdf}', f'file://{pathlib.Path(out_html).resolve()}'], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if __name__ == '__main__':
    if sys.argv[1] == '--app-reference':
        app_reference(sys.argv[2])
    elif sys.argv[1] == '--refresh-rules':
        refresh_rules(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == '--refresh-copy':
        refresh_rules(sys.argv[2], sys.argv[3], card_text=True)
    elif sys.argv[1] == '--table-reference':
        table_reference(sys.argv[2], sys.argv[3])
    else:
        main(sys.argv[1], sys.argv[2])
