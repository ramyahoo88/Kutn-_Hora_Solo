# Evidence for the Claude v0.3.5 audit

Report: [docs/Claude_Audit_v0.3.5.md](../../docs/Claude_Audit_v0.3.5.md). Reviewed `v0.3.5-playtest` at `6a6f00e4fe9c6bce205ee55df8d0291023c6b00b`.

Run every command from the repository root with Node.js 22 or 24. The scripts import `src/` relative to this folder and never modify the application.

## Release

```sh
node build.mjs /tmp/rebuilt.html && cmp /tmp/rebuilt.html Kutna_Hora_Solo.html
python3 mincmistr/print/build.py --app-reference /tmp/app-reference.html && cmp /tmp/app-reference.html mincmistr/print/app-reference.html
python3 -I audit/v0.3.5/scripts/export_plans_audit.py /tmp/plans.webp && cmp /tmp/plans.webp src/assets/mincmistr-plans.webp
python3 -I audit/v0.3.5/scripts/pdf-compare.py /tmp/pdf-rebuild      # text and pixel comparison of all 8 pages
node --test test/*.test.mjs
```

`results/release.json` records hashes and every release check.

## Findings

| Finding | Reproduction |
|---|---|
| P1 house-row fallback in rule 6.5 | Import `positions/House_Right_No_Public_Card_Play.json`, press **Play one Plan**. `node audit/v0.3.5/scripts/p1-assert.mjs` asserts the pending position. `house-right-position.mjs` regenerates both saves. `house-right-browser.mjs` reproduces it in the shipped HTML. |
| P2 guild-set assignment | Rules text only (`mincmistr/Mincmistr_Rules.md:19,167`). |
| P3 390 px label wrap | `results/browser/phone-mines.png`, from `browser-probe.mjs` P6. |

## Studies

| Script | What it does | Recorded result |
|---|---|---|
| `scripts/oracle.mjs`, `scripts/parity.mjs 16 claude035` | Independent rules 2, 4–7 and 9 oracle shadowing every Mincmistr decision in 352 digital games | `results/parity.json` |
| `scripts/fuzz.mjs 40 fz-a`, `40 fz-b` | Random and bot games at 2–4 players with `checkGame`, immutability, independent council and final scoring | `results/fuzz-a.txt`, `fuzz-b.txt` |
| `scripts/past-fixes.mjs` | Earlier fixes plus a nearby differing case | `results/past-fixes.txt` |
| `scripts/hidden-info.mjs` | Concealed-state perturbations for Standard, Quick, Planner and Mincmistr | `results/hidden-info.json` (Mincmistr's 4 log differences are the next revealed event only) |
| `scripts/strategy.mjs <seeds> <sd/sf> <2/4> <level> <policies> <out>` | Human-seat strategies against shipped Mincmistrs on matched seeds | `results/strategy-all.jsonl`, `strategy-summary.txt` (`summarize-strategy.py`) |
| `scripts/workload.mjs 8 wl` | Paper workload per Mincmistr | `results/workload.json` |
| `scripts/master-discards.mjs` | Where Master's no-effect cards occur | 16 of 16 on the doubled last turn |
| `scripts/browser-probe.mjs`, `browser-probe2.mjs` | Chromium: full games via controls, Undo depth, Plan faces, Draw only, 390 px, print, long seeds, save protection | `results/browser/results.json`, `results2.json`, screenshots |

The strategy runs used:

```sh
for pre in sd sf; do for lvl in journeyman master; do
  node audit/v0.3.5/scripts/strategy.mjs 12 $pre 2 $lvl standard,quick,builder,miner,council,denial,taxdodge,random audit/v0.3.5/results/strat-$pre-2-$lvl.jsonl
  node audit/v0.3.5/scripts/strategy.mjs 6  $pre 4 $lvl standard,quick,builder,miner,council,denial,taxdodge,random audit/v0.3.5/results/strat-$pre-4-$lvl.jsonl
done; done
cat audit/v0.3.5/results/strat-*.jsonl > audit/v0.3.5/results/strategy-all.jsonl
```

Browser scripts need Playwright. Set `PLAYWRIGHT_MODULE` to its `index.mjs` if it is not resolvable as `playwright`. Set `PLAYWRIGHT_BROWSERS_PATH` if Chromium is installed elsewhere.

## Not covered

DOM smoke under jsdom; Firefox, WebKit, Safari and iPhone; print and duplex at the table; human play. The CGE PDF was read through text extraction only. See section 9 of the report.
