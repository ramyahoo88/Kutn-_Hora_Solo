#!/usr/bin/env python3
"""Check the shipped PDF's text against its sources when PyMuPDF is unavailable for build.py --refresh-copy.
Pages 1-4 must carry rules.md word for word, in order. Page 7 must carry the three reference cards' words.
Usage from the repository root: python3 audit/v0.3.11/scripts/pdf-content-check.py   (needs Poppler and Python markdown)"""
import collections, html, importlib.util, pathlib, re, subprocess, sys, unicodedata
root = pathlib.Path(__file__).resolve().parents[3]
pdf = root / 'mincmistr' / 'Mincmistr_Print_and_Play.pdf'
import markdown
def words(text):
    text = unicodedata.normalize('NFKC', text)          # ligatures back to letters
    text = text.replace('’', "'").replace('▸', ' ')
    return re.findall(r"[^\s•●◀▶]+", text)
def page_text(first, last, layout=False):
    args = ['pdftotext', '-f', str(first), '-l', str(last)] + (['-layout'] if layout else []) + [str(pdf), '-']
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout
def plain(markup): return html.unescape(re.sub(r'<[^>]+>', ' ', markup))
rules_md = (root / 'mincmistr' / 'print' / 'rules.md').read_text(encoding='utf-8')
# Compare letters and digits only, ignoring case, spacing and punctuation, so bold runs and table cells cannot split words.
def letters(text):
    text = unicodedata.normalize('NFKC', text).lower()
    return ''.join(ch for ch in text if ch.isalnum())
import difflib
src, out = letters(plain(markdown.markdown(rules_md, extensions=['tables']))), letters(page_text(1, 4))
# Ordered lists print their numbers; markdown source does not carry them as text. Report any other difference.
ops = [(tag, src[i1:i2], out[j1:j2]) for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, src, out, autojunk=False).get_opcodes() if tag != 'equal']
other = [op for op in ops if not (op[0] == 'insert' and op[2].isdigit())]
multiset = not other
print({'rules_characters_source': len(src), 'rules_characters_pdf': len(out), 'list_numbers_added_by_layout': len(ops) - len(other), 'other_differences': other[:8]})
spec = importlib.util.spec_from_file_location('build', root / 'mincmistr' / 'print' / 'build.py'); build = importlib.util.module_from_spec(spec)
sys.argv = ['build.py']
try: spec.loader.exec_module(build)
except IndexError: pass
cards = [letters(plain(card)) for card in build.ref_cards()]
page7 = letters(page_text(7, 7, layout=False))
page7raw = letters(page_text(7, 7, layout=True))
def contains(card):
    # Each sentence of the card must appear on the page (three cards share lines in layout order).
    parts = [letters(x) for x in re.split(r'(?<=[.:;])\s+|<br>|</p>|</li>|</div>', plain(card)) if letters(x)]
    return [x for x in parts if x not in page7]
lacking = [x for card in build.ref_cards() for x in contains(re.sub(r'<(br|/p|/li|/div)[^>]*>', '. ', card))]
print({'reference_card_fragments_missing_from_page_7': lacking[:10]})
head = letters(plain(build.PLAN_CHECKS))
print({'plan_header_count_page_5': letters(page_text(5, 5)).count(head), 'plan_header_count_page_7': page7.count(head)})
sys.exit(0 if multiset and not lacking else 1)
