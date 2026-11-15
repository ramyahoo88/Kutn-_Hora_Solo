# v0.3.4 audit evidence

Audited app commit: `5ec3ca8814cb7df04ff9a52a2fcfecfc0bc0878e`. Paper rules: Mincmistr v1.2.2. [Full report](../../docs/Astra_Audit_v0.3.4.md).

These scripts add no product changes. Run commands below from the repository root with Node 24 and Python 3. Tests use deterministic seeds. Competitive result order can vary with worker scheduling; compare by seed, policy, level, target, and seat, not JSONL line order.

## Release and game checks

```sh
node audit/v0.3.4/verify-release.mjs
node --test test/*.test.mjs
node audit/v0.3.4/boundaries.mjs
node audit/v0.3.4/stress.mjs
node audit/v0.3.4/rules-check.mjs audit/v0.3.4/positions
python audit/v0.3.4/verify-sprite.py
```

`verify-release.mjs` writes a build in a fresh temporary directory and compares bytes. `verify-sprite.py` needs Poppler (`pdftoppm`) and Pillow with WebP support; it rebuilds the card sprite separately, without overwriting the shipped asset. It does not rebuild the paper PDF. The rulebook and paper PDF were rendered and read separately; Chromium was unavailable for a new PDF build.

`stress.mjs` covers 240 games and compares preview calculation effects outside phase/round boundaries. `rules-check.mjs` has an independent paper action-priority oracle, regressions and hidden-information checks; it shares the game engine's legal choices. `boundaries.mjs` contains independent expected mine awards and focused state/supply/migration cases. Its small isolated scoring setups are assertions, not complete importable games.

## Shipped HTML controls and confirmed findings

Install the test-only dependency:

```sh
npm install --prefix audit/v0.3.4 --no-save jsdom@26.1.0
node audit/v0.3.4/dom-regression.mjs
node audit/v0.3.4/dom-plan-cards.mjs
node audit/v0.3.4/dom-draw-only.mjs
node audit/v0.3.4/storage-repros.mjs
node audit/v0.3.4/seed-repro.mjs
```

If jsdom already exists elsewhere, set `JSDOM_MODULE` to its absolute `lib/api.js` path. These are **synthetic DOM tests, not real-browser rendering tests**. Dialog, storage and download APIs are stubbed; the shipped HTML and handlers are unchanged.

- `storage-repros.mjs`: F1 stale-tab overwrite in both modes; F2 temporary read failure/recovery in Draw only, with a safer digital-game control. Assertions reproduce the current bugs. After fixes, update them to assert preservation/conflict handling.
- `seed-repro.mjs`: F3 identical individual decks from 53-character seeds, with the distinct 52-character control. Change the equality assertions to inequality after repair.
- `positions/two-tabs-before.json` and `two-tabs-after.json`: valid digital saves documenting the lost mine placement.
- `positions/identical-individual-decks.json`: importable four-player Master setup reproducing F3.
- Other `positions/` files cover the earlier paper rules fixes and a complete four-player action trace. `fixtures/` includes earlier real saves for migration, Tavern, tax and tile-7 regressions.

The recorded `results/dom-results.json` combines 20 first-run passing scenarios and the final legacy-save scenario rerun after replacing a nonportable historical-checkout import with its generated fixture. That first harness-path failure was not a product defect. The final portable script runs all 21 cases. `ONLY_TEST` can select a name substring for a targeted rerun. Re-runs also write control traces under `evidence/`.

## Paper/app comparison

For exact parity against the earlier implementation, provide a separate checkout of commit `e6806e63babe71706650ba80d6fbe96e6da5a806`:

```sh
MINCMISTR_V122_ROOT=/absolute/path/to/that/checkout node audit/v0.3.4/paper-parity.mjs
```

The recorded result is 44 complete matched games, 5,999 decisions and 2,858 Plan draws. This is historical parity, not an independent rules oracle.

## Competitive runs

```sh
node audit/v0.3.4/bench.mjs audit/v0.3.4/configurations.json audit/v0.3.4/results/bench.jsonl
node audit/v0.3.4/bench.mjs audit/v0.3.4/strategy-configurations.json audit/v0.3.4/results/strategies.jsonl
python audit/v0.3.4/summarize.py
```

`MINCMISTR_JOBS` sets the worker count (default six). `MINCMISTR_ROOT` can point to another checkout. Challenger names are validated. Each configuration expands into starting boards and rotates the evaluated seat across all seats. Every row records seed, setup, side, starter, policy, difficulty, table size, scores, coins, winners, card plays, passes and interception count.

- First run: 432 level-check games plus 504 app-policy/rights-interception games against Master.
- Second run: 72 matched Standard controls plus 864 independently evaluated construction/mining/council/denial games against Standard, Planner and paper Master.
- Total: 1,872 competitive games. The independent strategies use their own evaluator but share the legal engine and visibility mask. They are not human-strength estimates.
- `summary.json` contains per-strategy/per-table outcomes, discovery/confirmation results, and approximate 95% bootstrap intervals resampling whole starting boards. The counts are exact; the confidence intervals are descriptive small-sample estimates.
- The paper workload counts are enumerated candidates, not timed human observations.

`results/source-verification.json` identifies all fetched release files and the historical files not fetched. `results/release.json` gives the exact audited hashes. `manifest.sha256` covers this evidence package (excluding itself).
