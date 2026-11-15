# The Mincmistr: a tabletop solo opponent for Kutná Hora

The Mincmistr is a card-driven automa for the physical game. It uses a 15-card Plan deck, a fixed row for its six action cards and a four-step checklist. There are no dice and no starting points. It uses normal costs, component limits and scoring, with the action priorities and difficulty changes described in these rules. It never uses the Joker.

Developed and tested against this repository's engine at `v0.3.0-playtest` (`0b28294`). The rules engine in `v0.3.1-playtest` is the same, apart from the new Planner rival setting.

To play without printing, open [Kutná Hora Solo](../Kutna_Hora_Solo.html) and choose **New game → Rival difficulty → Mincmistr**. **Play one Plan** shows changes to the board and resources. Open **Why this move?** to review the checks and tie-breaks. Tap a rule number to open it offline. **View Plan card** shows the printed face and its text.

When playing at the table, choose **Draw only** to use the printed Plan faces as a shared deck. Tap **Draw Plan** before each Mincmistr action card. Import or export a deck to move it between devices. Open **Rules and reference** to print the large-text **Table reference** or the **Mine choice aid**.

## Read or print

- `Mincmistr_Print_and_Play.pdf`: rules on pages 1–4, card sheets on pages 5–8. Print at 100% on Letter or A4.
- `Mincmistr_Rules.md`: the v1.2.4 rulebook text, with clarified bonus timing, placement priorities, Rights and four-player Grandmaster.
- [One-page table reference](print/reference-sheet.md). Print it from the app, or build a Letter or A4 PDF using the command below.
- `Mincmistr_Sim_Report.md`: design history, test method and results.
- `Mincmistr_Sample_Game.md`: two rounds of a simulated game, annotated rule by rule.
- `NOTES.md`: the overnight lab notebook.

To update a printed v1.2.3 set, replace the rules on pages 1–4 and the reference cards on page 7. The earlier Plan deck works with these rules. The new fronts say “2+ pelicans” to make the threshold explicit.

## Strength (holdout seeds, Mincmistr's win rate and margin)

| Level | vs Standard rival (768 games) | vs Quick rival (384 games) |
|---|---|---|
| Apprentice | 20%, −9.1 | 52%, +0.0 |
| Journeyman | 33%, −5.1 | 64%, +3.3 |
| Master | 50%, −0.3 | 77%, +7.6 |
| Grandmaster | 71%, +5.5 | 87%, +12.2 |

Against two or three Mincmistrs, here is how often the Standard rival wins when it takes your seat (fair share 33% / 25%):

| Players | Apprentice | Journeyman | Master | Grandmaster |
|---|---|---|---|---|
| 3 | 70% | 57% | 39% | 18% |
| 4 | 64% | 48% | 25% | 19% |

## Code

Run every command from the repository root. The scripts import the engine from `../src/`.

- `mincmistr.mjs`: the study scripts' entry point to the app's implementation. It exports `createMincmistr(state, seat, level)`, `mincmistrAction(state, m)` and `mincmistrCardsThisTurn(state, m)`.
- `simfinal.mjs` and `summarize.mjs`: evaluation, for example:

  ```
  node mincmistr/simfinal.mjs journeyman standard 24 h1,h2 out.jsonl
  node mincmistr/summarize.mjs out.jsonl
  ```

- `equiv.mjs`: decision-by-decision check of `mincmistr.mjs` against the tuning lab (`automa.mjs` + `base.json`).
- `flowcheck.mjs`: checks each Rule 4 priority and the selected action card against the printed rules. Exits with a failure if a move disagrees.
- `policies.mjs`: rejects rival names the engine does not define, because `botAction` would otherwise play Standard.
- `multisim.mjs` and `multisum.mjs`: three- and four-player tests, covering you against several Mincmistrs, or one Mincmistr at a table of rivals.
- `multi.mjs`, `mirror.mjs`, `overhead.mjs`, `exploit.mjs`, `rollout*.mjs`, `samplegame.mjs`: supporting studies.
- `print/build.py`: rebuilds the PDF from `print/rules.md` and the card data. Needs Python `markdown` and headless Chrome or Chromium:

  ```
  node mincmistr/print/export_cards.mjs
  python3 mincmistr/print/build.py /tmp/mincmistr.html mincmistr/Mincmistr_Print_and_Play.pdf
  ```

  To regenerate only the rules pages and reuse the existing card sheets, install Python `markdown` and `PyMuPDF` with DejaVu fonts. Set `DEJAVU_FONTS` if the fonts live outside `/usr/share/fonts/truetype/dejavu`.

  ```sh
  python3 mincmistr/print/build.py --refresh-rules mincmistr/Mincmistr_Print_and_Play.pdf /tmp/Mincmistr_Print_and_Play.pdf
  ```

  To reproduce the v1.2.4 print release while retaining the card frames and backs, use the PDF from [v0.3.9-playtest](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/v0.3.9-playtest/mincmistr/Mincmistr_Print_and_Play.pdf) as the input to `--refresh-copy`:

  ```sh
  python3 mincmistr/print/build.py --refresh-copy /tmp/Mincmistr_v1.2.3.pdf /tmp/Mincmistr_v1.2.4.pdf
  ```

- `print/export_app_plans.py` crops the Plan fronts from the PDF for the app. After updating the PDF's cards, run `python3 mincmistr/print/export_app_plans.py` with Poppler and Pillow installed, then rebuild the offline HTML.
- `print/mine-aid.md` is the mine choice aid. To refresh the app's offline reference after editing the aid, rules, or reference cards, run `python3 mincmistr/print/build.py --app-reference mincmistr/print/app-reference.html`, then rebuild the offline HTML.
- To render the one-page reference PDF, install Python `markdown`, `reportlab` and DejaVu fonts. Run `python3 mincmistr/print/build.py --table-reference letter /tmp/Mincmistr_Table_Reference.pdf`. Use `a4` for A4 paper.
- `results/`: raw results. `results/v1.0/` holds the version 1.0 holdout runs.
