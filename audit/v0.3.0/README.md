# Claude audit evidence for v0.3.0 (playtest)

The findings are in [docs/Claude_Audit_v0.3.0.md](../../docs/Claude_Audit_v0.3.0.md). The audited build is `0b28294`. Run each script from this folder; they import the engine from `../../src`.

## Data

| File | What it holds |
| --- | --- |
| `fresh-seeds.json` | Every game of the fresh-seed confirmation run: seed, setup card, guild set, starter, events, policies, and each seat's VP, margin, win, reputation, unused rights and plots, tax bills and cards played for no effect. The summary reproduces `node test/rival-study.mjs 12 audit-fresh-nov15`: 30/48, +3.25 VP; affordable bills declined 15/216 against 82/218. |
| `skip-traces/skip-4p-gNN-sNNN.json` | 52 importable saves, one per four-player position where Standard played a card for no effect (seeds `skips-4-0` to `skips-4-23`, all seats Standard). Import one in the app to inspect it. |
| `skip-traces/skip-traces.json` | For each position: seat, hand, coins, the skipped card and its continuation score, every legal option ranked by its continuation score, the best alternative, and the best non-skip action. |
| `skip-traces/skip-traces.md` | The same cases as a table. |

Each option's continuation plays the game to the end with Standard at every seat, using the real hidden decks. It is one hindsight sample, not an expected value. Outcomes for different options in one position vary by about 3.8 VP (standard deviation), so the "best alternative" is inflated by picking the highest of 2–80 samples. Compare a planner's choice with the average alternative, or rescore everything with `skip_regression.mjs --rescore`. In 4 positions two Income options, with and without seating a patrician, share a label.

## Scripts

| Script | Purpose |
| --- | --- |
| `skip_regression.mjs [--rescore]` | Runs the current Standard on every saved skip position and scores its move the same way. With `--rescore`, it also replays the v0.3.0 skip and the best alternative with the current build's bots, so all three numbers come from the same policy. |
| `skip_traces.mjs [games] [shard] [shards]`, `skip_traces.mjs merge` | Regenerates the skip traces. `SKIP_OUT=<folder>` writes elsewhere. About 10 minutes on two cores. |
| `fresh_seeds.mjs [seedsPerGroup] [prefix]` | Regenerates `fresh-seeds.json` |
| `multi_checks.mjs [src] [games]` | Fuzz at 2/3/4 players with `checkGame` and save round trips, preview against commit, and the rival's information boundary at 3–4 players |
| `multi_rules.mjs [src]` | Mine-rank ties, starting groschen, shared guild rights, turn order, optional events and shared first place |
| `classic_equiv.mjs <v0.2.3 src> [games]` | `classic` policy against v0.2.3's Standard, decision for decision. Usage is in the file header. |
| `compat.mjs <v0.2.2 src> <v0.2.3 src>` | Old 2-player saves load unchanged and play on. Usage is in the file header. |
| `strategies.mjs [pairs] [names] [seedGroup]` | Scripted human-style strategies against Standard |
| `profile.mjs [games]` | Rival behaviour profile (card mix, taxes, builds, council, openings, decision time) |
| `browser_playtest_steps.py` | Runs the README one/two/three-rival checks and full games through the shipped HTML with Playwright for Python. Set `CHROME=/path/to/chrome` to use an installed browser. |
