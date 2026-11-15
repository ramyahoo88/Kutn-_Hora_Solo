# Claude audit evidence for v0.2.2 (playtest)

The findings are in [docs/Claude_Audit_v0.2.2.md](../../docs/Claude_Audit_v0.2.2.md). Run each script from this folder, for example `cd audit/v0.2.2 && node fuzz.mjs 600`. The scripts import the engine from `../../src`.

| File | Purpose |
| --- | --- |
| `browser_playtest_steps.py` | Runs README Game 1, Game 2 and the Safari steps through the shipped HTML with Playwright for Python. Set `CHROME=/path/to/chrome` to use an installed browser. |
| `compat.mjs <v0.2.0 src> <v0.2.1 src>` | Saves from earlier engines load unchanged, keep guild rows, and play on to a valid end. Usage is in the file header. |
| `row_orders.mjs [seeds] [seedGroup]` | Rival strength under each of its six house-row orders, on matched seeds |
| `ius_nearby.mjs` | Ius Regale cases near the ruling: 6 tiles left, and a two-tile draw from a one-tile stack |
| `probe_houses.mjs` | v0.2.1 fix recheck: the third house row pays 1, 3, 4 reputation, then 8 VP |
| `fuzz.mjs [games]` | Random-legal full games, with `checkGame` after every step and periodic save round trips |
| `preview_check.mjs` | Planning preview against the committed transition for every legal action |
| `leak.mjs [games]` | Rival decisions are unchanged when hidden information is scrambled |
| `strategies.mjs [pairs] [names] [seedGroup]` | Scripted human-style strategies against the Standard rival |

The last five scripts are copied unchanged from the v0.2.0 audit, so this branch runs on its own.
