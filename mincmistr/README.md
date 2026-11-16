# The Mincmistr: a tabletop solo opponent for Kutná Hora

The Mincmistr is a card-driven automa for the physical game. It uses a 15-card Plan deck, a fixed row for its six action cards and a four-step checklist. There are no dice and no starting points. It uses normal costs, component limits and scoring, with the action priorities and difficulty changes described in these rules. It never uses the Joker.

The original simulations used engine v0.3.0 (`0b28294`). The latest independent audit compares v1.2.5 with app v0.3.11. [Claude’s audit and evidence](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/86e9a5844f4985fbac1668188ded5eaedb8952f7/docs/Claude_Audit_v0.3.11.md)

To play without printing, open [Kutná Hora Solo](../Kutna_Hora_Solo.html) and choose **New game → Rival difficulty → Mincmistr**. **Play one Plan** shows changes to the board and resources. Open **Why this move?** to review the checks and tie-breaks. Tap a rule number to open it offline. **View Plan card** shows the printed face and its text.

When playing at the table, choose **Draw only** to use the printed Plan faces as a shared deck. Tap **Draw Plan** before each Mincmistr action card. Import or export a deck to move it between devices. Open **Rules and reference** to print the large-text **Table reference** or the **Mine choice aid**.

## Read or print

- [Print-and-play PDF](Mincmistr_Print_and_Play.pdf). Rules on pages 1–4, cards and optional backs on pages 5–8, table reference on page 9, and mine choice aid on page 10. Print cards at 100% on Letter or A4.
- [Mincmistr v1.2.6 rules](Mincmistr_Rules.md). The setup explains how to keep rights and mine tiles in order. Rule 6.5 defines which free rights qualify.
- [Table reference](print/reference-sheet.md) and [mine choice aid](print/mine-aid.md). You can also print both from the app.
- [Simulation report](Mincmistr_Sim_Report.md), [sample game](Mincmistr_Sample_Game.md) and [design notebook](NOTES.md).

For a printed v1.2.5 set, replace pages 1–4 and the Choices card on page 7. You can keep your Plan deck and its backs. Print pages 9 and 10 if you want paper copies of the aids.

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
- `results/`: raw results. `results/v1.0/` holds the version 1.0 holdout runs.

## Build the print packet

The release builds on Ubuntu 24.04 (x86-64) with Node.js 24 and Python 3.12. Install its exact font packages for a byte-for-byte rebuild. On other systems, extract the same font packages and point `DEJAVU_FONTS` to their `.ttf` directory. The PDF uses the rules, deck data, vector card artwork and both aids in `mincmistr/print/`.

```sh
sudo apt-get install fonts-dejavu-core=2.37-8 fonts-dejavu-extra=2.37-8
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r mincmistr/print/requirements.txt
node mincmistr/print/export_cards.mjs
cp mincmistr/print/rules.md mincmistr/Mincmistr_Rules.md
python3 mincmistr/print/build.py --pdf mincmistr/Mincmistr_Print_and_Play.pdf
python3 mincmistr/print/build.py --app-reference mincmistr/print/app-reference.html
python3 mincmistr/print/export_app_plans.py
node build.mjs Kutna_Hora_Solo.html
npm run verify
```

The verification command rebuilds into a temporary directory and compares the files byte for byte. Reproduce release hashes with the Linux build environment and the dependencies above. For a standalone table reference, use `python3 mincmistr/print/build.py --table-reference letter /tmp/Mincmistr_Table_Reference.pdf`. Use `a4` for A4 paper.
