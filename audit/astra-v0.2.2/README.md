# Astra second audit — v0.2.2 playtest

Target: `def9312a06641648afbcec32cb07a92cb53a136d` on `v0.2.2-playtest`.
The report is [../../docs/Astra_Audit_2_v0.2.2.md](../../docs/Astra_Audit_2_v0.2.2.md).
This folder adds evidence and development tools only. It does not change the app.

Requires Node.js 20 or newer. Recorded runs used Node 24.22.1. Engine checks need no packages. The DOM check uses jsdom 26.1.0; it is **not a real browser test**.

From the repository root:

```sh
node audit/astra-v0.2.2/release.mjs
node --test test/engine.test.mjs
node audit/astra-v0.2.2/core.mjs
node audit/astra-v0.2.2/boundaries.mjs
node audit/astra-v0.2.2/recovery.mjs
node audit/astra-v0.2.2/strategies.mjs
npm install --prefix audit/astra-v0.2.2
node audit/astra-v0.2.2/dom.mjs
node test/arena.mjs 12 baseline,quick,builder,miner,council,denial kutna-v020-fresh
```

`recovery.mjs` writes the tax-floor fixture used by `dom.mjs`; a recorded copy is included. All paths resolve relative to the scripts, except npm's explicit working-directory argument. Scripts overwrite their corresponding evidence files. Timing fields are machine-dependent.

| Script | Scope |
| --- | --- |
| `release.mjs` | Check all 22 original files against GitHub blob hashes; build into a separate temporary directory and compare bytes. It intentionally fails if the reviewed application changes. |
| `core.mjs` | Nine groups: mine regression/scoring, nine guild sets, 1,080 price cells and thresholds, taxes/ties, supplies, shuffle coverage and malformed saves. |
| `boundaries.mjs` | Twenty groups: all ten events and nested actions, limited supplies, repetition, maximum tracks and the documented Ius ruling. Some are artificial unit positions, not complete importable games. |
| `recovery.mjs` | Two actual schema-1 fixtures; preserve hidden order, repair III–3, resume one to completion; play a reachable all-no-effect game to the reputation-floor tax case. |
| `strategies.mjs` | 144 complete games against four independent evaluation policies; paired seats and two seed groups; state checks after every action; 315 hidden-information comparisons; preview-effect checks over four complete six-round games. |
| `dom.mjs` | Execute the **unmodified shipped HTML** in jsdom; real event handlers, simulated storage/dialog/download APIs; one full game, Tavern regression, Undo, reload, import/export/recovery, setup/Ius follow-up and four QoL observations. |

The strategy evaluator is separate from the application's evaluator, but shares its legal engine and public-information sampling. These are scripted opponents, not human difficulty measurements. The same nine setup seeds are reused across policies within each group, then replayed with Standard in each seat; the confirmation group has fresh seed strings. No policy was tuned between groups. Scores and wins are deterministic.

`dom.mjs` stubs dialog open/close, object URLs and the final download click. It verifies the exported/recovered Blob bytes but cannot prove native file download, focus behavior, touch interaction, layout or browser compatibility. Reload is represented by a new jsdom instance with the same storage bytes. Engine preview checks compare only the immediate choice; automatic round transitions are separately counted, not asserted equal to a planning copy.

## Evidence and fixtures

- `evidence/reviewed-tree.json` records the exact original GitHub tree and blob hashes; `release-results.json` records the separate rebuild.
- `evidence/readme-benchmark.jsonl` is the README benchmark's output, one JSON record per line.
- `evidence/independent-strategies.json` contains every seed, setup, assigned seat, result, action counts and summary. The representative trace/save and full DOM trace/save are included separately.
- `fixtures/Tavern_House_Row_3.json` is Claude's v0.2.0 audit save, copied unchanged from commit `02bc7d78c83d99215b33e2c6e845adc32d4295fa`, `audit/v0.2.0/Kutna_Audit_HouseRow3.json`.
- `fixtures/Barbara_7_Preview.json` is a small synthetic, import-valid position created by `dom.mjs`; it is not claimed as a played game.
- `fixtures/Tax_At_Reputation_Floor.json` is reached entirely through legal play by `recovery.mjs`.
- `fixtures/v0.1.0_III-3.json` and `v0.1.0_Completed_Game.json` are unchanged fixtures from the first Astra audit, made with the original v0.1.0 engine. The first is a controlled III–3 position; the second is a completed simulated game.

Core, boundary, DOM and strategy harnesses adapt the first Astra audit's scripts and replace obsolete failure expectations with regression assertions. The numeric `companion-oracle.mjs` preserves facts extracted independently from CGE's companion, not from this application's tables. The original companion bundle SHA-256 is `46380a8c376ba0ebe3e1f96630ecb56a68b4c7fa30c21ec3622b56510ed29287`; its public filename was `main.2dea7b0b.js`. Setup expectations use its `ca[setup][2]` array. Only the game's supported population/ore ranges are compared.

The rulebook, publisher artwork, component images and companion bundle are not redistributed here. Source links and coverage limits are in the report.
