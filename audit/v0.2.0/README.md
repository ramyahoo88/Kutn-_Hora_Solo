# Claude audit evidence for v0.2.0

The findings are in [docs/Claude_Audit_v0.2.0.md](../../docs/Claude_Audit_v0.2.0.md). Run each script from this folder, for example `cd audit/v0.2.0 && node probe_houses.mjs`. The scripts import the engine from `../../src`.

| File | Purpose |
| --- | --- |
| `house-row-3-fix.diff` | F1 fix and regression test. Apply from the repository root with `git apply audit/v0.2.0/house-row-3-fix.diff`. |
| `Kutna_Audit_HouseRow3.json` | Importable save that reproduces F1 in the app |
| `make_save.mjs` | Regenerates that save from the engine |
| `probe_houses.mjs` | F1 assertion against the printed third-row rewards. It prints FAIL on v0.2.0. |
| `probe_edges.mjs` | Q1–Q3 and other rule edges |
| `fuzz.mjs [games]` | Random-legal full games, with `checkGame` after every step and periodic save round trips |
| `preview_check.mjs` | Planning preview against the committed transition for every legal action |
| `leak.mjs [games]` | Rival decisions are unchanged when hidden information is scrambled |
| `strategies.mjs [pairs] [names] [seedGroup]` | Scripted human-style strategies against the Standard rival |
| `house_freq.mjs [games]` | How often seats take row-3 houses beyond the first |
| `browser_probe.py` | Drives the shipped HTML through its controls with Playwright for Python |
| `browser_save_check.py` | Imports the F1 save in the shipped HTML and builds the Tavern |

The browser scripts use Playwright's Chromium. Set `CHROME=/path/to/chrome` to use an installed browser instead.
