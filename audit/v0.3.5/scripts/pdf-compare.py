#!/usr/bin/env python3
"""Rebuild the Mincmistr PDF to a separate path and compare it with the shipped one.
The PDF embeds its creation time, so compare extracted text and rendered pixels instead of bytes.
Usage, from the repository root: python3 -I audit/v0.3.5/scripts/pdf-compare.py /tmp/rebuilt
Needs Python markdown, Pillow, Poppler (pdftotext, pdftoppm) and Chrome at /usr/bin/google-chrome."""
import subprocess, sys, pathlib, glob
from PIL import Image, ImageChops
root = pathlib.Path(__file__).resolve().parents[3]
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/mincmistr-rebuild'); out.mkdir(parents=True, exist_ok=True)
shipped = root / 'mincmistr' / 'Mincmistr_Print_and_Play.pdf'
rebuilt = out / 'rebuilt.pdf'
subprocess.run(['python3', str(root / 'mincmistr' / 'print' / 'build.py'), str(out / 'rebuilt.html'), str(rebuilt)], check=True)
for name, pdf in (('shipped', shipped), ('rebuilt', rebuilt)):
    subprocess.run(['pdftotext', '-layout', str(pdf), str(out / f'{name}.txt')], check=True)
    subprocess.run(['pdftoppm', '-r', '60', '-png', str(pdf), str(out / name)], check=True)
same_text = (out / 'shipped.txt').read_bytes() == (out / 'rebuilt.txt').read_bytes()
pages = sorted(glob.glob(str(out / 'shipped-*.png')))
diffs = [ImageChops.difference(Image.open(p).convert('RGB'), Image.open(p.replace('shipped-', 'rebuilt-')).convert('RGB')).getbbox() for p in pages]
print({'pages': len(pages), 'text_identical': same_text, 'pixel_identical_pages': sum(d is None for d in diffs)})
sys.exit(0 if same_text and all(d is None for d in diffs) else 1)
