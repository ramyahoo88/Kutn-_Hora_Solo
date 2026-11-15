#!/usr/bin/env python3
"""Crop the v1.2.2 Plan fronts into a three-column sprite for the offline app.

Requires Poppler's pdftoppm and Pillow with WebP support.
"""

from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

from PIL import Image


def main():
    project = Path(__file__).resolve().parents[2]
    pdf = project / "mincmistr" / "Mincmistr_Print_and_Play.pdf"
    output = project / "src" / "assets" / "mincmistr-plans.webp"
    dpi = 176
    # The Letter sheets center three 2.5 × 3.5 inch cards in each direction.
    grid_left, grid_top = dpi // 2, dpi // 4
    width, height = dpi * 5 // 2, dpi * 7 // 2
    # Trim the cut marks in the blank margin, preserving the 5:7 proportions.
    inset_x, inset_y = 5, 7
    face_width, face_height = width - 2 * inset_x, height - 2 * inset_y
    sprite = Image.new("RGB", (3 * face_width, 5 * face_height))

    with TemporaryDirectory() as folder:
        for page, first, count in ((5, 0, 9), (7, 9, 6)):
            prefix = Path(folder) / f"page-{page}"
            subprocess.run([
                "pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi),
                "-singlefile", "-png", str(pdf), str(prefix),
            ], check=True)
            with Image.open(prefix.with_suffix(".png")) as sheet:
                if sheet.size != (dpi * 17 // 2, dpi * 11):
                    raise ValueError(f"Expected a Letter card sheet on page {page}")
                for index in range(count):
                    row, column = divmod(index, 3)
                    left, top = grid_left + column * width, grid_top + row * height
                    face = sheet.crop((
                        left + inset_x, top + inset_y, left + width - inset_x, top + height - inset_y,
                    ))
                    sprite.paste(face, (column * face_width, ((first + index) // 3) * face_height))

    sprite.save(output, lossless=True, method=6)


if __name__ == "__main__":
    main()
