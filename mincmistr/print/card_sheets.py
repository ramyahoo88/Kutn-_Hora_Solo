"""Draw the four Letter card sheets from the deck data and original artwork."""
from io import BytesIO
import re

import fitz
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen.canvas import Canvas

WIDTH, HEIGHT = 180, 252  # 2.5 × 3.5 inches
LEFT, TOP = 36, 18
BROWN, GOLD = '#5b2a1f', '#c9a66b'
GOALS = {
    'C': ('Construct', '#9b3b2e', '#f2ded9', 'Build ▸ Plot ▸ Rights', [
        'Build with a right and plot', 'Plot if rights &gt; plots, under 3 plots', 'Rights if holding fewer than 2',
    ]),
    'M': ('Mine', '#3d4f63', '#e4e9ee', 'Pool miner, else recruit', [
        'Use a pool miner', 'If empty, recruit up to 2', 'Keep most ★ + ore + VP',
    ]),
    'S': ('St. Barbara', '#896015', '#f0e7d2', 'Contribute a pelican', [
        'Needs a pelican', 'Resolve the current tile',
    ]),
}
REMINDERS = '<b>&lt;20 g</b>: Income<br><b>2+ pelicans</b>, or 1 on a prize tile: St. Barbara'


def card_box(index):
    row, column = divmod(index, 3)
    x, y = LEFT + column * WIDTH, TOP + row * HEIGHT
    return fitz.Rect(x, y, x + WIDTH, y + HEIGHT)


def draw_icon(canvas, goal, x, y, size, color):
    """Draw the original roof, mining tools or cathedral silhouette."""
    canvas.saveState()
    canvas.translate(x, y)
    canvas.scale(size / 40, size / 40)
    canvas.setFillColor(HexColor(color))
    canvas.setStrokeColor(HexColor(color))
    canvas.setLineWidth(3.2)
    canvas.setLineCap(1)
    canvas.setLineJoin(1)
    if goal == 'C':
        path = canvas.beginPath()
        path.moveTo(6, 20)
        path.lineTo(20, 7)
        path.lineTo(34, 20)
        canvas.drawPath(path)
        canvas.rect(10, 19, 20, 15, fill=0)
        canvas.rect(17.5, 25, 5, 9, stroke=0, fill=1)
    elif goal == 'M':
        canvas.lines([(9, 35, 29, 12), (12, 12, 31, 34)])
        path = canvas.beginPath()
        path.moveTo(23, 10)
        path.lineTo(34, 9)
        path.lineTo(30, 21)
        path.close()
        canvas.drawPath(path, stroke=0, fill=1)
        canvas.saveState()
        canvas.translate(9, 9)
        canvas.rotate(45)
        canvas.roundRect(-5, -3, 12, 6, 1.5, stroke=0, fill=1)
        canvas.restoreState()
    else:
        for x, top, width in [(6, 13, 9), (15, 6, 10), (25, 13, 9)]:
            path = canvas.beginPath()
            path.moveTo(x, 35)
            path.lineTo(x, top + 10)
            path.lineTo(x + width / 2, top)
            path.lineTo(x + width, top + 10)
            path.lineTo(x + width, 35)
            path.close()
            canvas.drawPath(path, stroke=0, fill=1)
        canvas.setFillColor(HexColor('#fffdf8'))
        canvas.roundRect(18, 26, 4, 9, 2, stroke=0, fill=1)
    canvas.restoreState()


def rounded_box(canvas, x, y, width, height, radius, fill, border, line=1):
    canvas.setFillColor(HexColor(fill))
    canvas.setStrokeColor(HexColor(border))
    canvas.setLineWidth(line)
    canvas.roundRect(x, y, width, height, radius, fill=1)


def draw_frame(canvas, card=None, back=False):
    if back:
        rounded_box(canvas, 7, 7, 166, 238, 6, BROWN, BROWN)
        rounded_box(canvas, 11, 11, 158, 230, 5, BROWN, GOLD, .7)
        canvas.setFillColor(HexColor(GOLD))
        canvas.circle(90, 100, 34, stroke=0, fill=1)
        canvas.setStrokeColor(HexColor('#916d3d'))
        canvas.circle(90, 100, 29, fill=0)
        draw_icon(canvas, 'M', 70, 80, 40, BROWN)
        return

    paper = '#fbf7ef' if card else '#fffdf8'
    rounded_box(canvas, 7, 7, 166, 238, 2, paper, '#6e4b33', 1.25)
    canvas.setStrokeColor(HexColor('#d9cbb3'))
    canvas.setLineWidth(.6)
    canvas.line(15, 32, 165, 32)
    if not card:
        return
    canvas.line(15, 54, 165, 54)
    for goal, top, height in zip(card['goals'], [61, 152], [85, 67]):
        _, ink, background, _, _ = GOALS[goal]
        rounded_box(canvas, 15, top, 150, height, 5, background, ink, .7)
        draw_icon(canvas, goal, 34, top + (height - 27) / 2, 27, ink)
    canvas.setFillColor(HexColor(BROWN))
    canvas.rect(7, 225, 166, 20, stroke=0, fill=1)


def sheet_art(groups):
    stream = BytesIO()
    # Compress the finished packet with the pinned PyMuPDF build.
    canvas = Canvas(stream, pagesize=letter, bottomup=0, invariant=1, pageCompression=0)
    for cards, back in groups:
        for i, card in enumerate(cards):
            box = card_box(i)
            canvas.saveState()
            canvas.translate(box.x0, box.y0)
            draw_frame(canvas, card, back)
            canvas.restoreState()
        canvas.setStrokeColor(HexColor('#b5aa98'))
        canvas.setLineWidth(.35)
        canvas.setDash(2, 2)
        rows = (len(cards) + 2) // 3
        canvas.lines([(LEFT + x * WIDTH, TOP, LEFT + x * WIDTH, TOP + rows * HEIGHT) for x in range(4)])
        canvas.lines([(LEFT, TOP + y * HEIGHT, LEFT + 3 * WIDTH, TOP + y * HEIGHT) for y in range(rows + 1)])
        canvas.setDash()
        canvas.showPage()
    canvas.save()
    return fitz.open(stream=stream.getvalue(), filetype='pdf')


def place_text(page, box, markup, css, archive):
    spare, _ = page.insert_htmlbox(box, markup, css=css, archive=archive, scale_low=1)
    if spare < 0:
        raise ValueError(f'Text does not fit on card sheet page {page.number + 1}: {markup[:70]}')


def add_card_sheets(doc, deck, references, css, archive):
    groups = [(deck[:9], False), ([None] * 9, True), (deck[9:] + [None] * 3, False), ([None] * 6, True)]
    first_page = len(doc)
    with sheet_art(groups) as art:
        doc.insert_pdf(art)
    for offset, (cards, back) in enumerate(groups):
        page = doc[first_page + offset]
        for index, card in enumerate(cards):
            box = card_box(index)

            def label(bounds, markup):
                place_text(page, fitz.Rect(bounds) + tuple(box.tl) * 2, markup, css, archive)

            if back:
                label((13, 152, 167, 205), '<div class="back-title">The Mincmistr<p>PLAN</p></div>')
            elif card:
                label((16, 13, 164, 31), '<div class="card-title">PLAN</div>')
                label((107, 16, 164, 31), f'<div class="plan-number">{card["number"]}/15</div>')
                label((15, 35, 165, 53), f'<div class="reminders">{REMINDERS}</div>')
                for rank, goal in enumerate(card['goals']):
                    name, ink, _, brief, details = GOALS[goal]
                    top, bottom = [(61, 146), (152, 219)][rank]
                    label((21, (top + bottom) / 2 - 8, 34, bottom), f'<b style="color:{ink}">{rank + 1}</b>')
                    body = '<br>'.join(details) if rank == 0 else brief
                    label((69, top + (9 if rank == 0 else 14), 160, bottom - 3),
                          f'<div class="goal-title" style="color:{ink}">{name}</div><div class="goal-copy">{body}</div>')
                early = card['arrow'] == 'low'
                arrow = '◀ ties: earliest space' if early else 'ties: latest space ▶'
                label((16, 229, 164, 244), f'<div class="arrow {"early" if early else "late"}">{arrow}</div>')
            else:
                ref_index = index - 6
                title = ['CARD PLAY', 'GOALS', 'CHOICES'][ref_index]
                body = re.sub(r'<span class="dot" style="background:(#[0-9a-f]+)"></span>',
                              r'<span style="color:\1">●</span>', references[ref_index])
                label((16, 13, 164, 31), f'<div class="card-title">{title}</div>')
                label((16, 34, 164, 242), body)
        note = ('Optional backs · print on the reverse and flip on the long edge'
                if back else 'Print at 100% (actual size) · cut on the dashed lines · cards are 63.5 × 88.9 mm')
        place_text(page, fitz.Rect(36, 777, 576, 792), f'<div class="sheet-note">{note}</div>', css, archive)
